import {
  buildUnauthenticatedResult,
  clickElementByTextOrLabel,
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
    return /(?:Gemini|Deep Research|Pro|Ultra|Advanced|Ask Gemini|问问 Gemini|Sign in|登录)/i.test(
      text
    );
  },

  /** 主动后台同步时，尝试点击左下角「设置」→「用量限制 / Usage limits」展开真实用量 */
  async prepareForActiveSync(doc) {
    const clickedSettings = clickElementByTextOrLabel(
      doc,
      /^(?:Settings|设置|Settings\s*&\s*help|设置和帮助)$/i
    );
    if (!clickedSettings) {
      // 兜底查找包含 settings 图标或 aria-label 的按钮
      clickElementByTextOrLabel(doc, /Settings|设置/i);
    }
    await sleepMs(700);

    // 点击二级菜单中的「用量限制 / Usage limits」
    const clickedUsage = clickElementByTextOrLabel(
      doc,
      /Usage\s*limits?|用量限制|使用限额|配额|用量/i
    );
    if (clickedUsage) {
      await sleepMs(900);
    }
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

    // 尝试解析「用量限制 / Usage limits」弹窗中的剩余百分比或重置时间
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

    const refreshMatch = text.match(
      /(?:刷新时间|重置时间|恢复时间|refreshes?(?:\s+at|\s+in)?|resets?(?:\s+at|\s+in)?|available\s+after)[^\n]{0,28}/i
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
              ? '来自 Gemini「设置 → 用量限制」（5 小时滚动刷新）'
              : hasDeepResearch
                ? '5 小时滚动刷新 · 可在 Gemini 左下角「设置 → 用量限制」查看详细窗口'
                : '点击直达 Gemini 网页版对话',
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
      message: '已访问 Gemini，可在左下角「设置 → 用量限制」查看 5 小时滚动窗口',
    };
  },
};
