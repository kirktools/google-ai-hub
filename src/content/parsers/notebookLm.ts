import {
  buildUnauthenticatedResult,
  clickElementByTextOrLabel,
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
    return /(?:NotebookLM|Gemini\s+Notebook|Notebooks?|笔记本|精选笔记本|新建|Create\s+new|Sign in|登录)/i.test(
      text
    );
  },

  /** 主动后台同步时，点击右上角 <title-bar-settings> →「显示用量对话框 / 用量」展开真实 AI 用量与限额 */
  async prepareForActiveSync(doc) {
    if (doc.querySelector('usage-limits-dialog')) {
      return;
    }

    // 优先精准定位 <title-bar-settings> 内的按钮
    const settingsBtn =
      doc.querySelector<HTMLElement>('title-bar-settings button, title-bar-settings [role="button"]');
    const openedMenu = settingsBtn
      ? (settingsBtn.click(), true)
      : clickElementByTextOrLabel(doc, /^(?:settings|设置|Settings)$/i);

    if (openedMenu) {
      await sleepMs(600);
      const clickedUsage = clickElementByTextOrLabel(
        doc,
        /显示用量对话框|用量|Usage\s*limits?|Show\s+usage/i
      );
      if (clickedUsage) {
        await sleepMs(1000);
      }
    }
  },

  parse(doc, url) {
    const text = getVisibleText(doc);
    if (isUnauthenticatedPage(doc, url, text)) {
      return buildUnauthenticatedResult('notebooklm');
    }

    const isUltra = /NotebookLM\s+Ultra|\bULTRA\b/.test(text);
    const hasProBadge = Boolean(doc.querySelector('pro-badge, .pro-badge'));
    const isPlus =
      hasProBadge ||
      /NotebookLM\s+(?:Plus|Pro)|\bPRO\b|\bPLUS\b/i.test(text) ||
      /(?:^|\n)\s*(?:Plus|Pro)\s*(?:\n|$)/i.test(text);

    // 1. 精准解析 <usage-limits-dialog> 中的「当前用量」与「每周限额」
    let currentPercent: number | undefined;
    let weeklyPercent: number | undefined;
    let currentResetText: string | undefined;
    let weeklyResetText: string | undefined;

    const currentBox = doc.querySelector<HTMLElement>('.usage-box.current-usage-box');
    if (currentBox) {
      const boxText = (currentBox.innerText || currentBox.textContent || '').trim();
      const pctMatch = boxText.match(/(\d{1,3})\s*%/);
      if (pctMatch) currentPercent = Number(pctMatch[1]);
      const rstMatch = boxText.match(/(?:重置时间|Resets?)\s*[:：]\s*([^\n]{2,20})/i);
      if (rstMatch) currentResetText = `当前重置：${rstMatch[1].trim()}`;
    }

    const weeklyBox = doc.querySelector<HTMLElement>('.usage-box.weekly-usage-box');
    if (weeklyBox) {
      const boxText = (weeklyBox.innerText || weeklyBox.textContent || '').trim();
      const pctMatch = boxText.match(/(\d{1,3})\s*%/);
      if (pctMatch) weeklyPercent = Number(pctMatch[1]);
      const rstMatch = boxText.match(/(?:重置时间|Resets?)\s*[:：]\s*([^\n]{2,20})/i);
      if (rstMatch) weeklyResetText = `每周重置：${rstMatch[1].trim()}`;
    }

    // 2. 精准统计用户自己的笔记本数量（限定在 .my-projects-container 内，绝不把精选笔记本算进去）
    let count: number | undefined;
    const myContainer = doc.querySelector<HTMLElement>('.my-projects-container');
    if (myContainer) {
      const items = Array.from(myContainer.querySelectorAll<HTMLElement>('project-button')).filter(
        (el) => {
          const t = (el.innerText || el.textContent || '').trim();
          return !/^(?:add_2\s*)?(?:新建|新建笔记本|Create\s+new|New\s+notebook)$/i.test(t);
        }
      );
      count = items.length;
    }

    if (count === undefined) {
      const recentSection = text.match(
        /(?:最近打开过的笔记本|我的笔记本|Recent\s+notebooks?|My\s+notebooks?)[\s\S]*/i
      )?.[0];
      if (recentSection) {
        const sourceMatches = recentSection.match(/\d+\s*(?:个来源|sources?)/gi);
        if (sourceMatches) count = sourceMatches.length;
      }
    }

    if (count === undefined) {
      const countMatch = text.match(/(\d+)\s*(?:notebooks?|个笔记本)/i);
      count = parseNumberToken(countMatch?.[1]);
    }

    const isLoggedInHome =
      Boolean(myContainer) ||
      /(?:Gemini\s+Notebook|最近打开过的笔记本|新建笔记本|Create\s+new|精选笔记本)/i.test(text) ||
      Boolean(extractGoogleAccountLabel(doc));

    const cap = isUltra || isPlus ? 500 : 100;
    const effectiveCount = count ?? (isLoggedInHome ? 0 : undefined);
    const resetParts = [currentResetText, weeklyResetText].filter(Boolean);
    const resetInfo = resetParts.length > 0 ? resetParts.join(' · ') : undefined;

    // 兜底：若弹窗 DOM 没有 .usage-box 类名，但存在 progressbar，也读取其进度
    if (currentPercent === undefined && doc.querySelector('usage-limits-dialog')) {
      const bars = deepQuerySelectorAll<HTMLElement>(
        doc.querySelector('usage-limits-dialog')!,
        '[role="progressbar"]'
      );
      if (bars[0]) {
        const v = Number(bars[0].getAttribute('aria-valuenow'));
        if (Number.isFinite(v)) currentPercent = Math.min(100, Math.max(0, Math.round(v)));
      }
      if (bars[1]) {
        const v = Number(bars[1].getAttribute('aria-valuenow'));
        if (Number.isFinite(v)) weeklyPercent = Math.min(100, Math.max(0, Math.round(v)));
      }
    }

    if (isUltra || isPlus || isLoggedInHome || currentPercent !== undefined) {
      const tierLabel = isUltra
        ? 'Gemini Notebook Ultra'
        : isPlus
          ? 'Gemini Notebook Pro'
          : 'NotebookLM 已登录';

      const primaryText =
        currentPercent !== undefined
          ? `${tierLabel} · 当前已用 ${currentPercent}%${weeklyPercent !== undefined ? ` / 本周 ${weeklyPercent}%` : ''}`
          : effectiveCount !== undefined
            ? `${tierLabel} · 已建 ${effectiveCount} / ${cap} 个笔记本`
            : tierLabel;

      const secondaryText =
        currentPercent !== undefined && effectiveCount !== undefined
          ? `已建 ${effectiveCount} / ${cap} 个笔记本 · 来自官方用量对话框`
          : '对话与音频播客共享滚动算力窗口 · 单来源上限 200 MB / 50 万字';

      return {
        benefitId: 'notebooklm',
        status: 'synced',
        accountLabel: extractGoogleAccountLabel(doc),
        metrics: {
          primaryText,
          secondaryText,
          percent: currentPercent,
          secondaryPercent: weeklyPercent,
          usedValue: effectiveCount,
          totalValue: cap,
          unit: '个',
          resetInfo,
        },
      };
    }

    return {
      benefitId: 'notebooklm',
      status: 'fallback',
      metrics: {},
      message: '已访问 NotebookLM，暂未读取到用量信息',
    };
  },
};
