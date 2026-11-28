import type { PlanId } from '../../shared/types';
import {
  buildUnauthenticatedResult,
  getVisibleText,
  isUnauthenticatedPage,
  sleepMs,
  type SiteParser,
} from './types';

interface ModelQuotaGroup {
  fiveHourRemaining?: number;
  weeklyRemaining?: number;
  fiveHourRefresh?: string;
  weeklyRefresh?: string;
}

const QUOTA_LABEL = /Weekly\s+Limit\s+Remaining|每周剩余限额|Five\s+Hour\s+Limit\s+Remaining|5\s*小时剩余限额/gi;
const QUOTA_REFRESH_BUTTON = 'button[aria-label="Refresh quota and credits data"]';
const QUOTA_CIRCLE = '[data-testid="quota-progress-circle"]';

/** 将英文时长（如 "3 hours, 27 minutes" / "5 days, 11 hours"）本地化为简洁中文 */
function localizeDurationToZh(raw: string): string {
  return raw
    .replace(/\b(\d+)\s*days?\b/gi, '$1 天')
    .replace(/\b(\d+)\s*hours?\b/gi, '$1 小时')
    .replace(/\b(\d+)\s*minutes?\b/gi, '$1 分')
    .replace(/\b(\d+)\s*seconds?\b/gi, '$1 秒')
    .replace(/\s*,\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseQuotaGroup(sectionText: string): ModelQuotaGroup {
  const result: ModelQuotaGroup = {};
  const labels = [...sectionText.matchAll(QUOTA_LABEL)];
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const start = label.index + label[0].length;
    const end = Math.min(start + 180, labels[i + 1]?.index ?? sectionText.length);
    const block = sectionText.slice(start, end);
    const pct = block.match(/(\d{1,3})\s*%/);
    const remaining = pct ? Math.min(100, Number(pct[1])) : undefined;
    const refresh = block.match(
      /(?:refresh\s+in|刷新时间|重置于)\s*[:：]?\s*([^\n.]{3,32})/i
    )?.[1].trim();
    if (/^(?:Weekly|每周)/i.test(label[0])) {
      result.weeklyRemaining ??= remaining;
      result.weeklyRefresh ??= refresh;
    } else {
      result.fiveHourRemaining ??= remaining;
      result.fiveHourRefresh ??= refresh;
    }
  }

  return result;
}

function detectPlanFromAntigravity(text: string): { planId: PlanId; rawName: string } | null {
  const match = text.match(/Your\s+plan\s*:\s*([^\n]{3,40})/i);
  if (!match) return null;
  const rawName = match[1].trim();
  if (/Ultra[^\n]{0,12}20x/i.test(rawName)) return { planId: 'ultra_20x', rawName };
  if (/Ultra/i.test(rawName)) return { planId: 'ultra_5x', rawName };
  if (/Pro/i.test(rawName)) return { planId: 'pro', rawName };
  if (/Plus/i.test(rawName)) return { planId: 'plus', rawName };
  if (/Free/i.test(rawName)) return { planId: 'free', rawName };
  return null;
}

function getAntigravityText(doc: Document): string {
  const dialogs = Array.from(doc.querySelectorAll<HTMLElement>('[role="dialog"]'));
  for (const dlg of dialogs) {
    const raw = (dlg.textContent || '').replace(/\s+/g, ' ').trim();
    if (!/Models\s*&\s*Usage/i.test(raw)) continue;
    const visible = dlg.innerText || '';
    // 后台页面可能只在 innerText 中暴露标题，已经挂载的数字仍可从同一面板读取。
    return hasQuotaValues(visible) ? visible : raw;
  }
  return getVisibleText(doc);
}

function hasQuotaValues(text: string): boolean {
  const quota = parseQuotaGroup(text);
  return quota.weeklyRemaining !== undefined || quota.fiveHourRemaining !== undefined;
}

export const antigravityParser: SiteParser = {
  id: 'antigravity',

  isReady(doc) {
    // 兼容设置已展开、侧边栏展开、以及侧边栏折叠（Toggle Sidebar）三种状态
    if (
      doc.querySelector('[role="dialog"]') ||
      doc.querySelector('button[data-testid="settings-button"]') ||
      doc.querySelector('button[aria-label="Toggle Sidebar"]') ||
      doc.querySelector(QUOTA_CIRCLE)
    ) {
      return true;
    }
    const text = getVisibleText(doc);
    return /(?:Models\s*&\s*Usage|Weekly\s+Limit\s+Remaining|New\s+Conversation|Sign in|登录)/i.test(
      text
    );
  },

  /** 等待用量面板加载。首次加载为空时，通过页面自身的按钮重试一次。 */
  async prepareForActiveSync(doc) {
    // 主动同步使用新打开的页面，已读出的额度来自本次导航。
    if (hasQuotaValues(getAntigravityText(doc))) return;

    // 1. 如果页面还没出现 Models & Usage 或设置导航项，先确保侧边栏展开并点击 settings-button
    const textNow = getVisibleText(doc);
    if (
      !/Models\s*&\s*Usage/i.test(textNow) &&
      !doc.querySelector('button[data-testid="settings-nav-item-Models"]')
    ) {
      let settingsBtn = doc.querySelector<HTMLElement>('button[data-testid="settings-button"]');
      if (!settingsBtn) {
        const toggleSidebarBtn = doc.querySelector<HTMLElement>(
          'button[aria-label="Toggle Sidebar"]'
        );
        if (toggleSidebarBtn) {
          toggleSidebarBtn.click();
          await sleepMs(450);
          settingsBtn = doc.querySelector<HTMLElement>('button[data-testid="settings-button"]');
        }
      }
      if (settingsBtn) {
        settingsBtn.click();
        await sleepMs(600);
      }
    }

    // 2. 如果当前在 General 等其他 tab，点击精确的 data-testid="settings-nav-item-Models"
    if (!/Models\s*&\s*Usage/i.test(getVisibleText(doc))) {
      let modelsBtn = doc.querySelector<HTMLElement>(
        'button[data-testid="settings-nav-item-Models"]'
      );
      if (!modelsBtn) {
        const drawerBtn = doc.querySelector<HTMLElement>(
          'button[aria-label="Open settings menu"]'
        );
        if (drawerBtn) {
          drawerBtn.click();
          await sleepMs(450);
          modelsBtn = doc.querySelector<HTMLElement>(
            'button[data-testid="settings-nav-item-Models"]'
          );
        }
      }
      if (modelsBtn) {
        modelsBtn.click();
      }
    }

    // 页面初次取数时会禁用刷新按钮，等它重新可用再点击，避免把无效点击算成重试。
    let refreshed = false;
    for (let i = 0; i < 16; i++) {
      if (hasQuotaValues(getAntigravityText(doc))) return;
      if (!refreshed && i >= 6) {
        const button = doc.querySelector<HTMLButtonElement>(QUOTA_REFRESH_BUTTON);
        if (button && !button.disabled && button.getAttribute('aria-disabled') !== 'true') {
          button.click();
          refreshed = true;
        }
      }
      await sleepMs(500);
    }
  },

  parse(doc, url) {
    const text = getAntigravityText(doc);
    if (isUnauthenticatedPage(doc, url, getVisibleText(doc))) {
      return buildUnauthenticatedResult('antigravity');
    }

    const planHint = detectPlanFromAntigravity(text) ?? undefined;

    // 拆分 Gemini Models 与 Claude and GPT models 两个区块
    const geminiIdx = text.search(/Gemini\s+Models/i);
    const claudeIdx = text.search(/Claude\s+and\s+GPT\s+models/i);

    let geminiSection = '';
    let claudeSection = '';
    if (geminiIdx >= 0) {
      geminiSection =
        claudeIdx > geminiIdx ? text.slice(geminiIdx, claudeIdx) : text.slice(geminiIdx);
    }
    if (claudeIdx >= 0) {
      claudeSection = text.slice(claudeIdx);
    }

    const geminiQuota = parseQuotaGroup(geminiSection || text);
    const claudeQuota = claudeSection ? parseQuotaGroup(claudeSection) : {};

    const hasGeminiData =
      geminiQuota.fiveHourRemaining !== undefined || geminiQuota.weeklyRemaining !== undefined;
    const hasClaudeData =
      claudeQuota.fiveHourRemaining !== undefined || claudeQuota.weeklyRemaining !== undefined;

    if (!hasGeminiData && !hasClaudeData) {
      const hasDialog = Boolean(doc.querySelector('[role="dialog"]'));
      const hasModelsHeading = /Models\s*&\s*Usage/i.test(text);
      const hasSettingsBtn = Boolean(
        doc.querySelector('button[data-testid="settings-button"], button[aria-label="Toggle Sidebar"]')
      );
      const refreshButton = doc.querySelector<HTMLButtonElement>(QUOTA_REFRESH_BUTTON);
      const safeReason = hasModelsHeading
        ? doc.querySelector(QUOTA_CIRCLE)
          ? 'fallback_quota_unreadable'
          : refreshButton?.disabled || refreshButton?.getAttribute('aria-disabled') === 'true'
            ? 'fallback_quota_loading'
            : 'fallback_quota_rpc_empty'
        : hasDialog
          ? 'fallback_dialog_wrong_tab'
          : hasSettingsBtn
            ? 'fallback_dialog_closed'
            : 'fallback_app_not_mounted';

      return {
        benefitId: 'antigravity',
        status: 'fallback',
        metrics: {},
        planHint,
        debugInfo: {
          host: 'antigravity.google.com',
          reason: safeReason,
        },
        message: '未读到 Antigravity Models & Usage 额度，请点击「直达」查看',
      };
    }

    const geminiUsed5h =
      geminiQuota.fiveHourRemaining !== undefined ? 100 - geminiQuota.fiveHourRemaining : undefined;
    const geminiUsedWeekly =
      geminiQuota.weeklyRemaining !== undefined ? 100 - geminiQuota.weeklyRemaining : undefined;
    const claudeUsed5h =
      claudeQuota.fiveHourRemaining !== undefined ? 100 - claudeQuota.fiveHourRemaining : undefined;
    const claudeUsedWeekly =
      claudeQuota.weeklyRemaining !== undefined ? 100 - claudeQuota.weeklyRemaining : undefined;

    const extraBars: Array<{ label: string; percent: number }> = [];
    if (claudeUsed5h !== undefined) {
      extraBars.push({ label: '5 小时窗口已用', percent: claudeUsed5h });
    }
    if (claudeUsedWeekly !== undefined) {
      extraBars.push({ label: '每周限额已用', percent: claudeUsedWeekly });
    }

    const primaryParts: string[] = [];
    if (geminiQuota.fiveHourRemaining !== undefined) {
      primaryParts.push(`Gemini 5h 剩 ${geminiQuota.fiveHourRemaining}%`);
    }
    if (geminiQuota.weeklyRemaining !== undefined) {
      primaryParts.push(`每周剩 ${geminiQuota.weeklyRemaining}%`);
    }

    const claudeParts: string[] = [];
    if (claudeQuota.fiveHourRemaining !== undefined) {
      claudeParts.push(`5h 剩 ${claudeQuota.fiveHourRemaining}%`);
    }
    if (claudeQuota.weeklyRemaining !== undefined) {
      claudeParts.push(`每周剩 ${claudeQuota.weeklyRemaining}%`);
    }

    const geminiRefreshParts: string[] = [];
    if (geminiQuota.fiveHourRefresh) {
      geminiRefreshParts.push(`5h 重置：${localizeDurationToZh(geminiQuota.fiveHourRefresh)}后`);
    }
    if (geminiQuota.weeklyRefresh) {
      geminiRefreshParts.push(`每周重置：${localizeDurationToZh(geminiQuota.weeklyRefresh)}后`);
    }

    const claudeRefreshParts: string[] = [];
    if (claudeQuota.fiveHourRefresh) {
      claudeRefreshParts.push(`5h 重置：${localizeDurationToZh(claudeQuota.fiveHourRefresh)}后`);
    }
    if (claudeQuota.weeklyRefresh) {
      claudeRefreshParts.push(`每周重置：${localizeDurationToZh(claudeQuota.weeklyRefresh)}后`);
    }

    return {
      benefitId: 'antigravity',
      status: 'synced',
      planHint,
      metrics: {
        primaryText:
          primaryParts.length > 0
            ? primaryParts.join(' · ')
            : `Claude/GPT：${claudeParts.join(' · ')}`,
        secondaryText:
          claudeParts.length > 0
            ? `Claude / GPT 模型：${claudeParts.join(' · ')}`
            : '来自 Antigravity Web Models & Usage 实时额度',
        percent: geminiUsed5h,
        secondaryPercent: geminiUsedWeekly,
        extraBars: extraBars.length > 0 ? extraBars : undefined,
        remainingValue: geminiQuota.fiveHourRemaining,
        totalValue: 100,
        unit: '%',
        resetInfo: geminiRefreshParts.length > 0 ? geminiRefreshParts.join(' · ') : undefined,
        secondaryResetInfo:
          claudeRefreshParts.length > 0 ? claudeRefreshParts.join(' · ') : undefined,
      },
    };
  },
};
