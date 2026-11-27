import {
  buildUnauthenticatedResult,
  clickElementByTextOrLabel,
  getVisibleText,
  isUnauthenticatedPage,
  parseNumberToken,
  sleepMs,
  type SiteParser,
} from './types';

export const flowParser: SiteParser = {
  id: 'flow',

  isReady(doc) {
    const text = getVisibleText(doc);
    if (text.length < 40) return false;
    return /(?:Flow|Veo|credits?|点数|积分|Create|创作|Labs|Sign in|登录)/i.test(text);
  },

  /** 主动后台同步时，尝试点击右上角头像/账号按钮展开 AI Credits 点数浮层 */
  async prepareForActiveSync(doc) {
    // 如果页面里已经直接出现 credits 数字，无需点击
    const initial = getVisibleText(doc);
    if (/\d[\d,]*\s*(?:AI\s*credits?|credits?|点数|积分)/i.test(initial)) {
      return;
    }

    // 尝试点击头像按钮（带 Google Account / 账号 aria-label 或包含 googleusercontent 头像图片的按钮）
    const clickedByLabel = clickElementByTextOrLabel(
      doc,
      /Google\s*(?:Account|账号|帐号)|Profile|个人资料|账户|账号|Credits|点数/i
    );

    if (!clickedByLabel) {
      const avatarImg = doc.querySelector<HTMLImageElement>(
        'img[src*="googleusercontent.com"]'
      );
      const clickableParent = avatarImg?.closest<HTMLElement>('button, [role="button"], a');
      if (clickableParent) {
        clickableParent.click();
      }
    }

    await sleepMs(1600);
  },

  parse(doc, url) {
    const text = getVisibleText(doc);
    if (isUnauthenticatedPage(doc, url, text)) {
      return buildUnauthenticatedResult('flow');
    }

    // 匹配 "850 / 1,000 credits" 或跨行 "AI 点数\n850 / 1,000"
    const pairMatch =
      text.match(
        /(?:AI\s*credits?|credits?|AI\s*点数|点数|积分)[\s\S]{0,28}?([\d,]+)\s*(?:\/|of|共)\s*([\d,]+)/i
      ) ||
      text.match(/([\d,]+)\s*(?:\/|of)\s*([\d,]+)\s*(?:AI\s*credits?|credits?|AI\s*点数|点数|积分)/i);

    if (pairMatch) {
      const rem = parseNumberToken(pairMatch[1]);
      const tot = parseNumberToken(pairMatch[2]);
      if (rem !== undefined && tot !== undefined && tot > 0) {
        return {
          benefitId: 'flow',
          status: 'synced',
          metrics: {
            primaryText: `剩余 ${rem.toLocaleString()} / ${tot.toLocaleString()} 点`,
            secondaryText: 'Veo 视频 / 图片 / 音乐创作可用点数',
            percent: Math.min(100, Math.max(0, Math.round(((tot - rem) / tot) * 100))),
            remainingValue: rem,
            totalValue: tot,
            unit: '点',
          },
        };
      }
    }

    // 匹配单个点数数值（支持数字与单位跨行，如 "1,000\nAI 点数" 或 "AI credits\n1,000" 或 "movie_filter\n1,000"）
    const singleMatch =
      text.match(/([\d,]+)\s*(?:AI\s*credits?|credits?|AI\s*点数|点\s*AI\s*点数|积分)/i) ||
      text.match(/(?:AI\s*credits?|AI\s*点数|剩余点数|可用点数|credits?)[\s:：]{0,16}([\d,]+)/i) ||
      text.match(/切换账号[\s\S]{0,80}?\b([\d,]{2,6})\b/);

    if (singleMatch) {
      const rem = parseNumberToken(singleMatch[1]);
      if (rem !== undefined) {
        return {
          benefitId: 'flow',
          status: 'synced',
          metrics: {
            primaryText: `剩余 ${rem.toLocaleString()} 点`,
            secondaryText: '来自 Google Flow 页面 / 头像浮层余额',
            remainingValue: rem,
            unit: '点',
          },
        };
      }
    }

    return {
      benefitId: 'flow',
      status: 'fallback',
      metrics: {},
      message: '未从 Flow 头像浮层读到点数（可点击直达 Flow 点开头像查看，打开时会自动顺路同步）',
    };
  },
};
