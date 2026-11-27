import { BENEFIT_CATALOG, QUICK_SYNC_QUEUE } from '../shared/plans';
import {
  applyParsedSiteResult,
  loadState,
  normalizeState,
  STORAGE_KEY,
  updateSyncProgress,
} from '../shared/storage';
import type {
  ParsedSiteResult,
  RuntimeMessage,
  RuntimeResponse,
  SyncableBenefitId,
} from '../shared/types';
import {
  buildAccountUrl,
  detectBenefitIdFromUrl,
  SINGLE_TAB_TIMEOUT_MS,
  SYNC_COOLDOWN_MS,
} from '../shared/utils';

const AUTO_SYNC_ALARM_NAME = 'google_ai_hub_auto_sync';
let isSyncLocked = false;

/** 根据用户设置维护低频定时同步闹钟（最低 60 分钟，防止高频轮询） */
async function syncAutoAlarmSchedule(intervalMinutes: number): Promise<void> {
  await chrome.alarms.clear(AUTO_SYNC_ALARM_NAME);
  if (intervalMinutes >= 60) {
    chrome.alarms.create(AUTO_SYNC_ALARM_NAME, {
      periodInMinutes: intervalMinutes,
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 等待指定 tab 加载完成或超时 */
function waitForTabComplete(tabId: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      clearTimeout(timer);
      resolve();
    };

    const onUpdated = (updatedTabId: number, info: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && info.status === 'complete') {
        finish();
      }
    };

    const timer = setTimeout(finish, timeoutMs);
    chrome.tabs.onUpdated.addListener(onUpdated);

    chrome.tabs
      .get(tabId)
      .then((tab) => {
        if (tab.status === 'complete') {
          finish();
        }
      })
      .catch(finish);
  });
}

/** 向指定 tab 中的 content script 发送提取请求（带重试，防止刚加载完脚本未就绪） */
async function requestExtractionFromTab(
  tabId: number,
  benefitId: SyncableBenefitId
): Promise<ParsedSiteResult> {
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = (await chrome.tabs.sendMessage(tabId, {
        type: 'EXTRACT_PAGE_DATA',
        benefitId,
      } satisfies RuntimeMessage)) as RuntimeResponse | undefined;

      if (response?.ok && response.data) {
        return response.data;
      }
    } catch {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.url && tab.url.toLowerCase().includes('accounts.google.com')) {
          return {
            benefitId,
            status: 'unauthenticated',
            metrics: {},
            message: '请先在 Chrome 登录 Google 账号',
          };
        }
      } catch {
        break;
      }
    }
    await sleep(900);
  }

  let finalUrl = '';
  try {
    const tab = await chrome.tabs.get(tabId);
    finalUrl = tab.url || '';
  } catch {
    // ignore
  }

  return {
    benefitId,
    status: 'fallback',
    metrics: {},
    debugInfo: {
      url: finalUrl,
      textSnippet: 'Content script 未响应（可能页面跳转到了未放行域名或加载超时）',
    },
    message: '未能从后台标签页读取到内容，可点击直达官网查看',
  };
}

/** 优先尝试复用用户当前已经打开的同站点标签页（零闪烁，不新建标签） */
async function tryExtractFromExistingTab(
  benefitId: SyncableBenefitId
): Promise<ParsedSiteResult | null> {
  try {
    const tabs = await chrome.tabs.query({});
    const matches = tabs.filter(
      (t) => t.id !== undefined && t.url && detectBenefitIdFromUrl(t.url) === benefitId
    );
    if (matches.length === 0) return null;

    // 对于 ai_studio，优先读取已打开的 console.cloud.google.com/billing 结算页（含 $300 + $10 精确余额）
    matches.sort((a, b) => {
      const score = (url?: string) => {
        if (!url) return 0;
        const lower = url.toLowerCase();
        if (lower.includes('console.cloud.google.com/billing') && lower.includes('credits')) return 3;
        if (lower.includes('console.cloud.google.com/billing')) return 2;
        if (lower.includes('me.developers.google.com')) return 1;
        return 0;
      };
      return score(b.url) - score(a.url);
    });

    for (const match of matches) {
      if (!match.id) continue;
      try {
        const response = (await chrome.tabs.sendMessage(match.id, {
          type: 'EXTRACT_PAGE_DATA',
          benefitId,
        } satisfies RuntimeMessage)) as RuntimeResponse | undefined;

        if (response?.ok && response.data && response.data.status !== 'fallback') {
          return response.data;
        }
      } catch {
        // 该标签可能未注入脚本，继续尝试下一个匹配标签
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** 使用同一个可复用的后台标签页完成单个站点同步，避免反复打开关闭多个标签 */
async function syncSiteInReusableTab(
  benefitId: SyncableBenefitId,
  sharedTabId: number | undefined
): Promise<{ result: ParsedSiteResult; tabId: number | undefined }> {
  const url = buildAccountUrl(benefitId);
  let tabId = sharedTabId;

  try {
    if (tabId === undefined) {
      const tab = await chrome.tabs.create({ url, active: false });
      tabId = tab.id;
    } else {
      await chrome.tabs.update(tabId, { url, active: false });
    }

    if (tabId === undefined) {
      throw new Error('无法创建后台标签页');
    }

    await waitForTabComplete(tabId, Math.floor(SINGLE_TAB_TIMEOUT_MS * 0.65));

    const currentTab = await chrome.tabs.get(tabId);
    if (currentTab.url && currentTab.url.toLowerCase().includes('accounts.google.com')) {
      return {
        tabId,
        result: {
          benefitId,
          status: 'unauthenticated',
          metrics: {},
          message: '请先在 Chrome 登录 Google 账号',
        },
      };
    }

    await sleep(800);
    let result = await requestExtractionFromTab(tabId, benefitId);

    // 如果解析器返回了二级精准数据页（例如 Cloud /billing -> /billing/<ID>/credits/all），自动在同标签页跟进一次
    if (result.redirectUrl) {
      await chrome.tabs.update(tabId, { url: result.redirectUrl, active: false });
      await waitForTabComplete(tabId, Math.floor(SINGLE_TAB_TIMEOUT_MS * 0.75));
      await sleep(2200);
      result = await requestExtractionFromTab(tabId, benefitId);
    }

    return { tabId, result };
  } catch {
    return {
      tabId,
      result: {
        benefitId,
        status: 'fallback',
        metrics: {},
        message: '后台同步中断，可点击直达官网查看',
      },
    };
  }
}

async function runSyncQueue(
  targets: SyncableBenefitId[],
  mode: 'all' | 'single'
): Promise<void> {
  if (isSyncLocked) return;
  isSyncLocked = true;

  let reusableTabId: number | undefined;

  try {
    const state = await loadState();

    await updateSyncProgress({
      running: true,
      mode,
      currentStep: 0,
      totalSteps: targets.length,
      currentTargetId: null,
      currentLabel: '准备开始同步…',
      lastError: undefined,
    });

    for (let i = 0; i < targets.length; i++) {
      const targetId = targets[i];
      const meta = BENEFIT_CATALOG[targetId];

      await updateSyncProgress({
        running: true,
        mode,
        currentStep: i + 1,
        totalSteps: targets.length,
        currentTargetId: targetId,
        currentLabel: `正在同步 ${i + 1}/${targets.length}：${meta.title}`,
      });

      // 1. 优先复用已打开的同平台标签页（零新建、零闪烁）
      const existingResult = await tryExtractFromExistingTab(targetId);
      if (existingResult) {
        await applyParsedSiteResult(existingResult);
      } else {
        // 2. 否则复用唯一一个后台标签页顺序跳转，避免标签栏反复开合
        const { result, tabId } = await syncSiteInReusableTab(targetId, reusableTabId);
        reusableTabId = tabId;
        await applyParsedSiteResult(result);
      }

      if (i < targets.length - 1) {
        await sleep(400);
      }
    }

    const finishedAt = Date.now();
    await updateSyncProgress({
      running: false,
      mode: null,
      currentStep: targets.length,
      totalSteps: targets.length,
      currentTargetId: null,
      currentLabel: '同步完成',
      lastSyncedAt: finishedAt,
      lastCooldownUntil:
        mode === 'all' ? finishedAt + SYNC_COOLDOWN_MS : state.syncProgress.lastCooldownUntil,
      lastError: undefined,
    });
  } catch (err) {
    await updateSyncProgress({
      running: false,
      mode: null,
      currentTargetId: null,
      currentLabel: '',
      lastError: err instanceof Error ? err.message : '同步过程发生异常',
    });
  } finally {
    // 整个队列完成后统一关闭这唯一一个临时后台标签页
    if (reusableTabId !== undefined) {
      chrome.tabs.remove(reusableTabId).catch(() => {
        // 若用户已手动关闭，静默忽略
      });
    }
    isSyncLocked = false;
  }
}

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse: (res: RuntimeResponse) => void) => {
    if (!message || typeof message !== 'object') {
      return undefined;
    }

    if (message.type === 'PASSIVE_PARSE_RESULT') {
      applyParsedSiteResult(message.payload)
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }

    if (message.type === 'SYNC_ALL') {
      loadState()
        .then((state) => {
          if (isSyncLocked || state.syncProgress.running) {
            sendResponse({ ok: false, error: '当前正在同步中，请稍候…' });
            return;
          }

          const now = Date.now();
          const cooldownUntil = state.syncProgress.lastCooldownUntil ?? 0;
          if (!message.force && cooldownUntil > now) {
            sendResponse({
              ok: false,
              error: '为避免频繁刷新触发风控，请稍后再试',
              cooldownRemainingMs: cooldownUntil - now,
            });
            return;
          }

          void runSyncQueue(QUICK_SYNC_QUEUE, 'all');
          sendResponse({ ok: true });
        })
        .catch(() => sendResponse({ ok: false, error: '读取本地状态失败' }));
      return true;
    }

    if (message.type === 'SYNC_SINGLE') {
      loadState()
        .then((state) => {
          if (isSyncLocked || state.syncProgress.running) {
            sendResponse({ ok: false, error: '当前正在同步中，请稍候…' });
            return;
          }
          void runSyncQueue([message.benefitId], 'single');
          sendResponse({ ok: true });
        })
        .catch(() => sendResponse({ ok: false, error: '读取本地状态失败' }));
      return true;
    }

    return undefined;
  }
);

// 低频定时同步触发
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== AUTO_SYNC_ALARM_NAME) return;
  void loadState().then((state) => {
    if (isSyncLocked || state.syncProgress.running) return;
    if (state.settings.autoSyncIntervalMinutes < 60) return;
    void runSyncQueue(QUICK_SYNC_QUEUE, 'all');
  });
});

// 当用户在设置页修改定时同步间隔时，立即更新闹钟计划
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[STORAGE_KEY]) return;
  const next = normalizeState(changes[STORAGE_KEY].newValue);
  const prev = normalizeState(changes[STORAGE_KEY].oldValue);
  if (next.settings.autoSyncIntervalMinutes !== prev.settings.autoSyncIntervalMinutes) {
    void syncAutoAlarmSchedule(next.settings.autoSyncIntervalMinutes);
  }
});

chrome.runtime.onStartup.addListener(() => {
  void updateSyncProgress({ running: false, mode: null, currentTargetId: null }).then((state) =>
    syncAutoAlarmSchedule(state.settings.autoSyncIntervalMinutes)
  );
});

chrome.runtime.onInstalled.addListener(() => {
  void updateSyncProgress({ running: false, mode: null, currentTargetId: null }).then((state) =>
    syncAutoAlarmSchedule(state.settings.autoSyncIntervalMinutes)
  );
});
