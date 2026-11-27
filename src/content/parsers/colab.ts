import {
  buildUnauthenticatedResult,
  clickElementByTextOrLabel,
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
    return /(?:Colab|Compute\s+Units?|计算单元|GPU|Notebook|笔记本|Sign in|登录)/i.test(text);
  },

  /** 主动后台同步时，仅在 Colab 笔记本页面尝试点击「查看资源 / View resources」（在 /signup 介绍页禁止点击） */
  async prepareForActiveSync(doc) {
    if (window.location.pathname.toLowerCase().includes('/signup')) {
      return;
    }
    const initial = getVisibleText(doc);
    if (/(?:可用|剩余|Available|Balance)[^\n]{0,16}[\d.,]+\s*(?:compute\s+units?|计算单元)/i.test(initial)) {
      return;
    }

    const clickedDirect = clickElementByTextOrLabel(
      doc,
      /^(?:View\s+resources|查看资源)$/i
    );
    if (clickedDirect) {
      await sleepMs(1000);
    }
  },

  parse(doc, url) {
    const text = getVisibleText(doc);
    if (isUnauthenticatedPage(doc, url, text)) {
      return buildUnauthenticatedResult('colab');
    }

    const isSignupPage = url.toLowerCase().includes('/signup');

    // 过滤掉套餐价目表行（避免把 "$49.99 / 月 500 计算单元" 误判成 "剩余 49.99 / 500"）
    const cleanText = text
      .split('\n')
      .filter((line) => !/(?:\$|US\$|¥|€)\s*[\d.,]+|\/\s*(?:月|month|mo\b)|购买|立即订阅|Purchase|Subscribe/i.test(line))
      .join('\n');

    // 1. 仅匹配明确带有「可用 / 剩余 / 余额 / Available / Balance」语义的计算单元，绝不误匹配套餐价目表
    const balancePairMatch = cleanText.match(
      /(?:可用|剩余|当前余额|余额|Available|Remaining|Balance)[^\n\d]{0,18}([\d.,]+)\s*(?:\/|of|共)\s*([\d.,]+)\s*(?:compute\s+units?|计算单元)?/i
    );
    if (balancePairMatch) {
      const rem = parseNumberToken(balancePairMatch[1]);
      const tot = parseNumberToken(balancePairMatch[2]);
      if (rem !== undefined && tot !== undefined && tot > 0 && rem <= tot * 1.5) {
        return {
          benefitId: 'colab',
          status: 'synced',
          metrics: {
            primaryText: `剩余 ${rem} / ${tot} 计算单元`,
            secondaryText: 'Colab Compute Units 可用余额',
            percent: Math.min(100, Math.max(0, Math.round(((tot - rem) / tot) * 100))),
            remainingValue: rem,
            totalValue: tot,
            unit: '单元',
          },
        };
      }
    }

    const balanceSingleMatch =
      cleanText.match(
        /(?:可用计算单元|剩余计算单元|当前余额|Available\s+compute\s+units?|Remaining\s+compute\s+units?|Compute\s+units?\s+available)\s*[:：]?\s*([\d.,]+)/i
      ) ||
      (!isSignupPage
        ? cleanText.match(/([\d.,]+)\s*(?:compute\s+units?|计算单元)\s*(?:available|remaining|可用|剩余)/i)
        : null);

    if (balanceSingleMatch) {
      const rem = parseNumberToken(balanceSingleMatch[1]);
      if (rem !== undefined) {
        return {
          benefitId: 'colab',
          status: 'synced',
          metrics: {
            primaryText: `剩余 ${rem} 计算单元`,
            secondaryText: '来自 Google Colab 资源面板',
            remainingValue: rem,
            unit: '单元',
          },
        };
      }
    }

    // 2. 在 /signup 页若能识别出当前已订阅状态（如 "当前方案 / Current plan" 附近的 Colab Pro）
    const activeTierMatch = cleanText.match(
      /(?:当前方案|已订阅|Current\s+plan|Active)[\s\S]{0,40}?(Colab\s+Pro\+|Colab\s+Pro)/i
    );
    if (activeTierMatch) {
      return {
        benefitId: 'colab',
        status: 'synced',
        metrics: {
          primaryText: `已订阅 ${activeTierMatch[1]}`,
          secondaryText: '打开任意 Colab 笔记本 → 右上角「查看资源」可自动同步精确计算单元',
        },
      };
    }

    return {
      benefitId: 'colab',
      status: 'fallback',
      metrics: {},
      message: 'Colab 介绍页不直接显示个人余额，打开任意笔记本点右上角「查看资源」会自动顺路同步',
    };
  },
};
