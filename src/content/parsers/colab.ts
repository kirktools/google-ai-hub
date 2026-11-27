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

  /** 主动后台同步时，尝试点击「查看资源 / View resources」入口展开计算单元余额 */
  async prepareForActiveSync(doc) {
    const initial = getVisibleText(doc);
    if (/[\d.,]+\s*(?:compute\s+units?|计算单元)/i.test(initial)) {
      return;
    }

    // 尝试点击 RAM/Disk 或「查看资源」按钮
    const clickedDirect = clickElementByTextOrLabel(
      doc,
      /View\s+resources|查看资源|RAM|磁盘|Compute\s+units|计算单元/i
    );
    if (clickedDirect) {
      await sleepMs(1000);
      // 如果先展开了下拉菜单，再点一次「查看资源」
      clickElementByTextOrLabel(doc, /View\s+resources|查看资源/i);
      await sleepMs(800);
    }
  },

  parse(doc, url) {
    const text = getVisibleText(doc);
    if (isUnauthenticatedPage(doc, url, text)) {
      return buildUnauthenticatedResult('colab');
    }

    // 匹配 "84.5 / 100 compute units" 或 "计算单元：84.5 / 100"
    const pairMatch =
      text.match(
        /(?:compute\s+units?|计算单元)[\s\S]{0,20}?([\d.,]+)\s*(?:\/|of|共)\s*([\d.,]+)/i
      ) ||
      text.match(/([\d.,]+)\s*(?:\/|of)\s*([\d.,]+)\s*(?:compute\s+units?|计算单元)/i);

    if (pairMatch) {
      const rem = parseNumberToken(pairMatch[1]);
      const tot = parseNumberToken(pairMatch[2]);
      if (rem !== undefined && tot !== undefined && tot > 0) {
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

    // 匹配单个计算单元余量（如 "Available: 96.42 compute units" / "可用计算单元 96.42"）
    const singleMatch =
      text.match(/([\d.,]+)\s*(?:compute\s+units?|计算单元)/i) ||
      text.match(/(?:compute\s+units?|计算单元)[^\n\d]{0,16}([\d.,]+)/i);

    if (singleMatch) {
      const rem = parseNumberToken(singleMatch[1]);
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

    // 识别订阅等级提示
    const tierMatch = text.match(/Colab\s+Pro\+|Colab\s+Pro/i);
    if (tierMatch) {
      return {
        benefitId: 'colab',
        status: 'synced',
        metrics: {
          primaryText: `已识别为 ${tierMatch[0]}`,
          secondaryText: '打开任意笔记本 → 点右上角「RAM/磁盘 → 查看资源」可自动同步精确余额',
        },
      };
    }

    return {
      benefitId: 'colab',
      status: 'fallback',
      metrics: {},
      message: '需打开任意 Colab 笔记本并点右上角「RAM/磁盘 → 查看资源」，打开后会自动顺路同步',
    };
  },
};
