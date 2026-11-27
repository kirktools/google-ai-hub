import {
  buildUnauthenticatedResult,
  clickElementByTextOrLabel,
  deepQuerySelectorAll,
  getVisibleText,
  isUnauthenticatedPage,
  parseNumberToken,
  sleepMs,
  type SiteParser,
} from './types';

export const colabParser: SiteParser = {
  id: 'colab',

  isReady(doc) {
    const text = getVisibleText(doc);
    if (text.length < 60) return false;
    return /(?:Colab|Compute\s+Units?|计算单元|代码执行程序|其他连接选项|Additional\s+connection|GPU|Notebook|Sign in|登录)/i.test(
      text
    );
  },

  /** 主动后台同步时，点击右上角「其他连接选项」→「查看资源」展开 <colab-paid-resources> */
  async prepareForActiveSync(doc) {
    if (window.location.pathname.toLowerCase().includes('/signup')) {
      return;
    }

    // 如果资源面板已经打开，直接读取
    if (doc.querySelector('colab-paid-resources')) {
      return;
    }

    const clickedDropdown = clickElementByTextOrLabel(
      doc,
      /其他连接选项|Additional\s+connection\s+options/i
    );
    if (clickedDropdown) {
      await sleepMs(600);
      const clickedViewResources = clickElementByTextOrLabel(
        doc,
        /^(?:查看资源|View\s+resources)$/i
      );
      if (clickedViewResources) {
        await sleepMs(1600);
      }
    }
  },

  parse(doc, url) {
    const text = getVisibleText(doc);
    if (isUnauthenticatedPage(doc, url, text)) {
      return buildUnauthenticatedResult('colab');
    }

    // 1. 优先从精准的 <colab-paid-resources> 组件读取（实地巡检确认的真实 DOM）
    const paidPanels = deepQuerySelectorAll<HTMLElement>(doc, 'colab-paid-resources');
    const panelText = paidPanels
      .map((el) => (el.innerText || el.textContent || '').trim())
      .filter(Boolean)
      .join('\n');

    const targetText = panelText || text;

    // 过滤掉套餐价目表行（避免把 "$49.99 / 月 500 计算单元" 误判成余量）
    const cleanText = targetText
      .split('\n')
      .filter(
        (line) =>
          !/(?:\$|US\$|¥|€)\s*[\d.,]+|\/\s*(?:月|month|mo\b)|购买|立即订阅|Purchase|Subscribe/i.test(
            line
          )
      )
      .join('\n');

    // 匹配 "可用：200.14个计算单元" 或 "Available: 200.14 compute units"
    const exactAvailableMatch =
      cleanText.match(
        /(?:可用|剩余|当前余额|余额|Available|Remaining)\s*[:：]?\s*([\d.,]+)\s*个?\s*(?:计算单元|compute\s+units?)/i
      ) ||
      cleanText.match(
        /([\d.,]+)\s*个?\s*(?:计算单元|compute\s+units?)\s*(?:可用|剩余|available|remaining)/i
      );

    if (exactAvailableMatch) {
      const rem = parseNumberToken(exactAvailableMatch[1]);
      if (rem !== undefined) {
        const tierMatch = cleanText.match(/您已订阅[“"]([^”"]+)[”"]|subscribed\s+to\s+([^\n.]+)/i);
        const tierName = tierMatch?.[1] || tierMatch?.[2] || 'Colab Pro';
        const burnMatch = cleanText.match(/(?:使用率|Usage\s+rate)\s*[:：]\s*([^\n]{2,28})/i);
        const sessionMatch = cleanText.match(/(?:您有\s*\d+\s*个有效会话|You\s+have\s+\d+\s+active\s+sessions?)/i);

        // Colab Pro 基准 200 单元，Pro+ 基准 500 单元（若余量超过基准则按 0% 已用显示）
        const baseQuota = /Pro\+/i.test(tierName) ? 500 : 200;
        const usedPercent =
          rem >= baseQuota
            ? 0
            : Math.min(100, Math.max(0, Math.round(((baseQuota - rem) / baseQuota) * 100)));

        const secondaryParts = [
          `已订阅 ${tierName}`,
          burnMatch ? `使用率：${burnMatch[1].trim()}` : '',
          sessionMatch ? sessionMatch[0].trim() : '',
        ].filter(Boolean);

        return {
          benefitId: 'colab',
          status: 'synced',
          metrics: {
            primaryText: `可用：${rem} 个计算单元`,
            secondaryText: secondaryParts.join(' · '),
            percent: usedPercent,
            remainingValue: rem,
            totalValue: baseQuota,
            unit: '单元',
          },
        };
      }
    }

    return {
      benefitId: 'colab',
      status: 'fallback',
      metrics: {},
      message: '未展开 Colab 资源面板，点击「刷新」或打开 Colab → 右上角「其他连接选项 → 查看资源」自动同步',
    };
  },
};
