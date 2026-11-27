import {
  buildUnauthenticatedResult,
  deepQuerySelectorAll,
  extractGoogleAccountLabel,
  getVisibleText,
  isUnauthenticatedPage,
  sleepMs,
  type SiteParser,
} from './types';

export const geminiParser: SiteParser = {
  id: 'gemini',

  isReady(doc) {
    const text = getVisibleText(doc);
    if (text.length < 40) return false;
    return /(?:Gemini|用量限额|Usage\s*limits?|Deep Research|Pro|Ultra|Sign in|登录)/i.test(text);
  },

  /** 主动后台同步时，直连 /usage 后留出一点时间等待进度条与限额文本渲染 */
  async prepareForActiveSync() {
    await sleepMs(1200);
  },

  parse(doc, url) {
    const text = getVisibleText(doc);
    if (isUnauthenticatedPage(doc, url, text)) {
      return buildUnauthenticatedResult('gemini');
    }

    const hasUltra =
      /\bGemini\s+(?:AI\s+)?Ultra\b/i.test(text) || /(?:^|\n)\s*Ultra\s*(?:\n|$)/i.test(text);
    const hasPro =
      /\bGemini\s+(?:Advanced|Pro)\b/i.test(text) ||
      /(?:^|\n)\s*(?:Pro|AI\s+Pro)\s*(?:\n|$)/i.test(text);
    const hasPlus = /(?:^|\n)\s*(?:Plus|AI\s+Plus)\s*(?:\n|$)/i.test(text);
    const hasDeepResearch = /Deep\s+Research|深度研究/i.test(text);

    // 1. 解析文本中的用量百分比（兼容「已使用 XX%」「已用 XX%」「剩余 XX%」「XX% used」「XX% remaining」）
    let usagePercent: number | undefined;
    let resetInfo: string | undefined;

    const usedPctMatch =
      text.match(/(?:已使用|已用|used)\s*(\d{1,3})\s*%/i) ||
      text.match(/(\d{1,3})\s*%\s*(?:used|已使用|已用)/i);
    const remainPctMatch =
      text.match(/(?:剩余|remaining|left)\s*(\d{1,3})\s*%/i) ||
      text.match(/(\d{1,3})\s*%\s*(?:remaining|left|剩余)/i);

    if (usedPctMatch) {
      const p = Number(usedPctMatch[1]);
      if (p >= 0 && p <= 100) usagePercent = p;
    } else if (remainPctMatch) {
      const r = Number(remainPctMatch[1]);
      if (r >= 0 && r <= 100) usagePercent = 100 - r;
    }

    // 2. 如果文本里没直接写数字，读取页面上 progressbar 的 aria-valuenow
    if (usagePercent === undefined) {
      const bars = deepQuerySelectorAll<HTMLElement>(doc, '[role="progressbar"], progress');
      for (const bar of bars) {
        const valStr = bar.getAttribute('aria-valuenow') ?? bar.getAttribute('value');
        const maxStr = bar.getAttribute('aria-valuemax') ?? bar.getAttribute('max') ?? '100';
        const val = valStr !== null ? Number(valStr) : NaN;
        const max = Number(maxStr);
        if (Number.isFinite(val) && Number.isFinite(max) && max > 0 && val >= 0 && val <= max) {
          usagePercent = Math.round((val / max) * 100);
          break;
        }
      }
    }

    const refreshMatch = text.match(
      /(?:刷新时间|重置时间|恢复时间|将于[^\n]{2,18}(?:重置|刷新)|refreshes?(?:\s+at|\s+in)?[^\n]{1,22}|resets?(?:\s+at|\s+in)?[^\n]{1,22})/i
    );
    if (refreshMatch) {
      resetInfo = refreshMatch[0].trim();
    }

    const accountLabel = extractGoogleAccountLabel(doc);

    if (hasUltra || hasPro || hasPlus || hasDeepResearch || usagePercent !== undefined) {
      const tierLabel = hasUltra
        ? 'Gemini Ultra 权益已激活'
        : hasPro
          ? 'Gemini Pro 权益已激活'
          : hasPlus
            ? 'Gemini Plus 权益已激活'
            : 'Gemini 网页版已登录';

      return {
        benefitId: 'gemini',
        status: 'synced',
        accountLabel,
        metrics: {
          primaryText:
            usagePercent !== undefined
              ? `${tierLabel} · 当前窗口已用 ${usagePercent}%`
              : tierLabel,
          secondaryText:
            usagePercent !== undefined
              ? '来自 Gemini 用量限额页（5 小时滚动刷新）'
              : '点击「直达」查看 Gemini 用量限额详情',
          percent: usagePercent,
          resetInfo,
        },
        planHint: hasUltra
          ? { planId: 'ultra_5x', rawName: 'Google AI Ultra (来自 Gemini 页面)' }
          : hasPro
            ? { planId: 'pro', rawName: 'Google AI Pro (来自 Gemini 页面)' }
            : hasPlus
              ? { planId: 'plus', rawName: 'Google AI Plus (来自 Gemini 页面)' }
              : undefined,
      };
    }

    return {
      benefitId: 'gemini',
      status: 'fallback',
      accountLabel,
      metrics: {},
      message: '已访问 Gemini 用量页，可点击直达查看详情',
    };
  },
};
