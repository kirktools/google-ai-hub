import {
  buildUnauthenticatedResult,
  deepQuerySelectorAll,
  extractGoogleAccountLabel,
  getVisibleText,
  isUnauthenticatedPage,
  parseNumberToken,
  sleepMs,
  type SiteParser,
} from './types';

export const notebookLmParser: SiteParser = {
  id: 'notebooklm',

  isReady(doc) {
    const text = getVisibleText(doc);
    if (text.length < 30) return false;
    return /(?:NotebookLM|Notebooks?|笔记本|Audio Overview|音频概览|新建|Create\s+new|欢迎使用|Welcome|Sign in|登录)/i.test(
      text
    );
  },

  async prepareForActiveSync() {
    await sleepMs(1200);
  },

  parse(doc, url) {
    const text = getVisibleText(doc);
    if (isUnauthenticatedPage(doc, url, text)) {
      return buildUnauthenticatedResult('notebooklm');
    }

    const isUltra = /NotebookLM\s+Ultra|\bULTRA\b/.test(text);
    const isPlus =
      /NotebookLM\s+(?:Plus|Pro)|\bPRO\b|\bPLUS\b/i.test(text) ||
      /(?:^|\n)\s*(?:Plus|Pro)\s*(?:\n|$)/i.test(text);

    // 1. 先从文字中找明确笔记本计数
    const countMatch =
      text.match(/(\d+)\s*(?:notebooks?|个笔记本)/i) ||
      text.match(/(?:我的笔记本|My\s+notebooks?|所有笔记本|All\s+notebooks?)[^\n\d]{0,12}(\d+)/i);
    let count = parseNumberToken(countMatch?.[1]);

    // 2. 穿透 Shadow DOM 统计页面中已渲染的笔记本卡片（排除「新建笔记本」按钮）
    if (count === undefined) {
      const cardSelectors = [
        'project-button',
        'a[href*="/notebook/"]',
        '[data-notebook-id]',
        '.project-button-card',
        'mat-card.project-button-box',
      ];
      for (const sel of cardSelectors) {
        const nodes = deepQuerySelectorAll<HTMLElement>(doc, sel).filter((el) => {
          const t = (el.innerText || el.textContent || '').trim();
          return !/^(?:新建|新建笔记本|Create\s+new|New\s+notebook)$/i.test(t);
        });
        if (nodes.length > 0) {
          count = nodes.length;
          break;
        }
      }
    }

    // 3. 若能看到「新建 / Create new」且有头像/已登录页面特征，即便笔记本数为 0 也算同步成功
    const isLoggedInHome =
      /(?:新建|新建笔记本|Create\s+new|我的笔记本|My\s+notebooks?|精选笔记本|Featured)/i.test(
        text
      ) || Boolean(extractGoogleAccountLabel(doc));

    const cap = isUltra || isPlus ? 500 : 100;
    const effectiveCount = count ?? (isLoggedInHome ? 0 : undefined);
    const percent =
      effectiveCount !== undefined
        ? Math.min(100, Math.max(0, Math.round((effectiveCount / cap) * 100)))
        : undefined;

    if (isUltra || isPlus || isLoggedInHome) {
      const tierLabel = isUltra
        ? 'NotebookLM Ultra 已激活'
        : isPlus
          ? 'NotebookLM Pro / Plus 已激活'
          : 'NotebookLM 已登录';
      return {
        benefitId: 'notebooklm',
        status: 'synced',
        accountLabel: extractGoogleAccountLabel(doc),
        metrics: {
          primaryText:
            effectiveCount !== undefined
              ? `${tierLabel} · 已建 ${effectiveCount} / ${cap} 个笔记本`
              : tierLabel,
          secondaryText: '对话与音频播客共享 5 小时滚动算力窗口 · 单来源上限 200 MB / 50 万字',
          percent,
          usedValue: effectiveCount,
          totalValue: cap,
          unit: '个',
        },
      };
    }

    return {
      benefitId: 'notebooklm',
      status: 'fallback',
      metrics: {},
      message: '已访问 NotebookLM，暂未统计到笔记本数量',
    };
  },
};
