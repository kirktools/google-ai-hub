import {
  buildUnauthenticatedResult,
  getVisibleText,
  isUnauthenticatedPage,
  parseNumberToken,
  type SiteParser,
} from './types';

export const notebookLmParser: SiteParser = {
  id: 'notebooklm',

  isReady(doc) {
    const text = getVisibleText(doc);
    if (text.length < 40) return false;
    return /(?:NotebookLM|Notebooks?|笔记本|Audio Overview|音频概览|新建|Create new|Sign in|登录)/i.test(
      text
    );
  },

  parse(doc, url) {
    const text = getVisibleText(doc);
    if (isUnauthenticatedPage(doc, url, text)) {
      return buildUnauthenticatedResult('notebooklm');
    }

    const isUltra = /NotebookLM\s+Ultra/i.test(text);
    const isPlus =
      /NotebookLM\s+(?:Plus|Pro)/i.test(text) ||
      /(?:^|\n)\s*(?:Plus|Pro)\s*(?:\n|$)/i.test(text);

    // 1. 先从文字中找明确笔记本计数
    const countMatch =
      text.match(/(\d+)\s*(?:notebooks?|个笔记本)/i) ||
      text.match(/(?:我的笔记本|My notebooks)[^\n\d]{0,12}(\d+)/i);
    let count = parseNumberToken(countMatch?.[1]);

    // 2. 若文字未写总数，统计页面中已渲染的笔记本卡片 DOM 数量（排除「新建笔记本」按钮）
    if (count === undefined) {
      const notebookLinks = doc.querySelectorAll(
        'a[href*="/notebook/"], [data-notebook-id], project-button, .project-button-card'
      );
      if (notebookLinks.length > 0) {
        count = notebookLinks.length;
      }
    }

    const cap = isUltra || isPlus ? 500 : 100;
    const percent =
      count !== undefined ? Math.min(100, Math.max(0, Math.round((count / cap) * 100))) : undefined;

    if (isUltra || isPlus || count !== undefined) {
      const tierLabel = isUltra
        ? 'NotebookLM Ultra 已激活'
        : isPlus
          ? 'NotebookLM Pro / Plus 已激活'
          : 'NotebookLM 已登录';
      return {
        benefitId: 'notebooklm',
        status: 'synced',
        metrics: {
          primaryText:
            count !== undefined
              ? `${tierLabel} · 已建 ${count} / ${cap} 个笔记本`
              : tierLabel,
          secondaryText:
            '对话与音频播客共享 5 小时滚动算力窗口，单来源上限 200 MB / 50 万字',
          percent,
          usedValue: count,
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
