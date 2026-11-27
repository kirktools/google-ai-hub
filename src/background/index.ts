import { BENEFIT_CATALOG, QUICK_SYNC_QUEUE } from '../shared/plans';
import {
  applyParsedSiteResult,
  loadState,
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

let isSyncLocked = false;

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
            message: '请先在 Chrome 登录 Google 账号，或检查设置中的账号索引（/u/0/）',
          };
        }
      } catch {
        break;
      }
    }
    await sleep(900);
  }

  return {
    benefitId,
    status: 'fallback',
    metrics: {},
    message: '未能从后台标签页读取到内容，可点击直达官网查看',
  };
}

/** 优先尝试复用用户当前已经打开的同站点标签页（零闪烁，不新建标签） */
async function tryExtractFromExistingTab(
  benefitId: SyncableBenefitId
): Promise<ParsedSiteResult | null> {
  try {
    const tabs = await chrome.tabs.query({});
    const match = tabs.find(
      (t) => t.id !== undefined && t.url && detectBenefitIdFromUrl(t.url) === benefitId
    );
    if (!match?.id) return null;

    // 仅在不打扰用户的前提下尝试一次提取；若该标签是安装扩展前打开的（未注入 content script）则回退
    const response = (await chrome.tabs.sendMessage(match.id, {
      type: 'EXTRACT_PAGE_DATA',
      benefitId,
    } satisfies RuntimeMessage)) as RuntimeResponse | undefined;

    if (response?.ok && response.data && response.data.status !== 'fallback') {
      return response.data;
    }
    return null;
  } catch {
    return null;
  }
}

/** 使用同一个可复用的后台标签页完成单个站点同步，避免反复打开关闭多个标签 */
async function syncSiteInReusableTab(
  benefitId: SyncableBenefitId,
  accountIndex: number,
  sharedTabId: number | undefined
): Promise<{ result: ParsedSiteResult; tabId: number | undefined }> {
  const url = buildAccountUrl(benefitId, accountIndex);
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
          message: '请先在 Chrome 登录 Google 账号，或检查设置中的账号索引（/u/0/）',
        },
      };
    }

    await sleep(800);
    const result = await requestExtractionFromTab(tabId, benefitId);
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
    const accountIndex = state.settings.accountIndex;

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
        const { result, tabId } = await syncSiteInReusableTab(
          targetId,
          accountIndex,
          reusableTabId
        );
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

chrome.runtime.onStartup.addListener(() => {
  void updateSyncProgress({ running: false, mode: null, currentTargetId: null });
});

chrome.runtime.onInstalled.addListener(() => {
  void updateSyncProgress({ running: false, mode: null, currentTargetId: null });
});
