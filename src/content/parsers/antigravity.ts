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

  const weeklyBlock = sectionText.match(
    /(?:Weekly\s+Limit\s+Remaining|每周剩余限额)[\s\S]{0,180}/i
  )?.[0];
  if (weeklyBlock) {
    const pct = weeklyBlock.match(/(\d{1,3})\s*%/);
    if (pct) result.weeklyRemaining = Math.min(100, Math.max(0, Number(pct[1])));
    const ref = weeklyBlock.match(
      /(?:refresh\s+in|刷新时间|重置于)\s*[:：]?\s*([^\n.]{3,32})/i
    );
    if (ref) result.weeklyRefresh = ref[1].trim();
  }

  const fiveHourBlock = sectionText.match(
    /(?:Five\s+Hour\s+Limit\s+Remaining|5\s*小时剩余限额)[\s\S]{0,180}/i
  )?.[0];
  if (fiveHourBlock) {
    const pct = fiveHourBlock.match(/(\d{1,3})\s*%/);
    if (pct) result.fiveHourRemaining = Math.min(100, Math.max(0, Number(pct[1])));
    const ref = fiveHourBlock.match(
      /(?:refresh\s+in|刷新时间|重置于)\s*[:：]?\s*([^\n.]{3,32})/i
    );
    if (ref) result.fiveHourRefresh = ref[1].trim();
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
  const visible = getVisibleText(doc);
  if (/Weekly\s+Limit\s+Remaining|Five\s+Hour\s+Limit\s+Remaining/i.test(visible)) {
    return visible;
  }
  // 后台未绘制标签页中 innerText 有时缺失未布局节点，回退读取 dialog 的 textContent
  const dialogs = Array.from(doc.querySelectorAll<HTMLElement>('[role="dialog"]'));
  for (const dlg of dialogs) {
    const tc = (dlg.textContent || '').replace(/\s+/g, ' ').trim();
    if (/Weekly\s+Limit\s+Remaining|Five\s+Hour\s+Limit\s+Remaining/i.test(tc)) {
      return tc;
    }
  }
  return visible;
}

function hasRenderedQuotaCircles(doc: Document): boolean {
  const text = getAntigravityText(doc);
  return /(?:Weekly\s+Limit\s+Remaining|Five\s+Hour\s+Limit\s+Remaining)[\s\S]{0,180}\d{1,3}\s*%/i.test(
    text
  );
}

export const antigravityParser: SiteParser = {
  id: 'antigravity',

  isReady(doc) {
    // 兼容设置已展开、侧边栏展开、以及侧边栏折叠（Toggle Sidebar）三种状态
    if (
      doc.querySelector('[role="dialog"]') ||
      doc.querySelector('button[data-testid="settings-button"]') ||
      doc.querySelector('button[aria-label="Toggle Sidebar"]') ||
      doc.querySelector('[data-testid="quota-progress-circle"]')
    ) {
      return true;
    }
    const text = getVisibleText(doc);
    return /(?:Models\s*&\s*Usage|Weekly\s+Limit\s+Remaining|New\s+Conversation|Sign in|登录)/i.test(
      text
    );
  },

  /** 主动后台同步时，确保 Models & Usage 弹层打开，并轮询等待 GetUserQuotaSummary RPC 渲染完百分比 */
  async prepareForActiveSync(doc) {
    if (hasRenderedQuotaCircles(doc)) {
      return;
    }

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

    // 3. 轮询等待百分比数字渲染完成；若 3 秒后仍未出数，主动点一次面板内的刷新额度按钮触发 RPC
    for (let i = 0; i < 16; i++) {
      if (hasRenderedQuotaCircles(doc)) {
        await sleepMs(250);
        break;
      }
      if (i === 6) {
        const refreshQuotaBtn = doc.querySelector<HTMLElement>(
          'button[aria-label="Refresh quota and credits data"]'
        );
        refreshQuotaBtn?.click();
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
      const safeReason = hasModelsHeading
        ? 'fallback_quota_rpc_empty'
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

    const refreshParts: string[] = [];
    if (geminiQuota.fiveHourRefresh) {
      refreshParts.push(`5h 重置：${localizeDurationToZh(geminiQuota.fiveHourRefresh)}后`);
    }
    if (geminiQuota.weeklyRefresh) {
      refreshParts.push(`每周重置：${localizeDurationToZh(geminiQuota.weeklyRefresh)}后`);
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
        remainingValue: geminiQuota.fiveHourRemaining,
        totalValue: 100,
        unit: '%',
        resetInfo: refreshParts.length > 0 ? refreshParts.join(' · ') : undefined,
      },
    };
  },
};
