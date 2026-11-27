import {
  buildUnauthenticatedResult,
  clickElementByTextOrLabel,
  getVisibleText,
  isUnauthenticatedPage,
  parseNumberToken,
  sleepMs,
  type SiteParser,
} from './types';

function parseGoogleOneFlowActivity(text: string) {
  // 1. 解析方案月度基准 & 每日额外赠送（如 "已包含 1,000 个 Google Flow 点数... 每天还会额外获得 50 个 Google Flow 点数"）
  const monthlyQuotaMatch =
    text.match(/(?:已包含|includes?)\s*([\d,]+)\s*个?\s*(?:Google\s+Flow\s*)?(?:点数|credits?)/i);
  const dailyQuotaMatch =
    text.match(/(?:每天(?:还会)?额外获得|daily\s+bonus[^\d]{0,12}|per\s+day[^\d]{0,12})\s*([\d,]+)\s*个?\s*(?:Google\s+Flow\s*)?(?:点数|credits?)/i);

  const monthlyQuota = parseNumberToken(monthlyQuotaMatch?.[1]);
  const dailyQuota = parseNumberToken(dailyQuotaMatch?.[1]);

  // 2. 解析「Google Flow 抵用金」卡片大数字（如 "Google Flow 抵用金\n1,050"）
  const flowTotalMatch =
    text.match(/Google\s+Flow\s*(?:抵用金|点数|credits?)\s*[\n:：]+\s*([\d,]+)/i) ||
    text.match(/Flow\s+credits?\s*[\n:：]+\s*([\d,]+)/i);
  const flowTotal = parseNumberToken(flowTotalMatch?.[1]);

  // 3. 解析「今天还剩 50 个 Flow 点数」
  const dailyRemainMatch =
    text.match(/(?:今天还剩|今日剩余|today[^\d]{0,16})\s*([\d,]+)\s*个?\s*(?:Google\s+)?Flow\s*(?:点数|credits?)/i);
  const dailyRemaining = parseNumberToken(dailyRemainMatch?.[1]);

  // 4. 解析右侧「AI 点数」大数字（如 "AI 点数\n0"）
  const extraAiMatch = text.match(/(?:^|\n)\s*(?:AI\s*点数|AI\s*credits?)\s*[\n:：]+\s*([\d,]+)/i);
  const extraAiCredits = parseNumberToken(extraAiMatch?.[1]);

  if (flowTotal === undefined && monthlyQuota === undefined) {
    return null;
  }

  const totalRem = flowTotal ?? 0;
  const effDailyQuota = dailyQuota ?? (dailyRemaining !== undefined && dailyRemaining > 0 ? dailyRemaining : undefined);
  const effDailyRem = dailyRemaining ?? 0;

  // 计算月度点数剩余与已用百分比
  let monthlyPercent: number | undefined;
  let monthlyRemainText = '';
  if (monthlyQuota !== undefined && monthlyQuota > 0) {
    const monthlyRem = Math.min(monthlyQuota, Math.max(0, totalRem - effDailyRem));
    monthlyPercent = Math.min(
      100,
      Math.max(0, Math.round(((monthlyQuota - monthlyRem) / monthlyQuota) * 100))
    );
    monthlyRemainText = `月度 ${monthlyRem.toLocaleString()}/${monthlyQuota.toLocaleString()}`;
  }

  // 计算今日赠送点数已用百分比
  let dailyPercent: number | undefined;
  let dailyRemainText = '';
  if (effDailyQuota !== undefined && effDailyQuota > 0 && dailyRemaining !== undefined) {
    dailyPercent = Math.min(
      100,
      Math.max(0, Math.round(((effDailyQuota - dailyRemaining) / effDailyQuota) * 100))
    );
    dailyRemainText = `今日赠送 ${dailyRemaining}/${effDailyQuota}（优先消耗·每日重置）`;
  }

  const detailParts = [
    monthlyRemainText,
    dailyRemainText,
    extraAiCredits !== undefined ? `额外 AI 点数：${extraAiCredits.toLocaleString()}` : '',
  ].filter(Boolean);

  return {
    benefitId: 'flow' as const,
    status: 'synced' as const,
    metrics: {
      primaryText: `Flow 总可用点数：${totalRem.toLocaleString()} 点`,
      secondaryText:
        detailParts.length > 0
          ? detailParts.join(' · ')
          : '来自 Google Flow 活动记录页',
      percent: monthlyPercent,
      secondaryPercent: dailyPercent,
      remainingValue: totalRem,
      totalValue: (monthlyQuota ?? 0) + (effDailyQuota ?? 0) || undefined,
      unit: '点',
    },
  };
}

export const flowParser: SiteParser = {
  id: 'flow',

  isReady(doc) {
    const text = getVisibleText(doc);
    if (text.length < 40) return false;
    return /(?:Flow|Veo|抵用金|AI\s*点数|credits?|点数|积分|Create|创作|Labs|Sign in|登录)/i.test(
      text
    );
  },

  /** 主动后台同步时，若落在 flow.google.com 则点击头像；若落在 one.google.com/ai/activity 则直接等待数据加载 */
  async prepareForActiveSync(doc) {
    if (window.location.hostname.includes('one.google.com')) {
      await sleepMs(1000);
      return;
    }

    const initial = getVisibleText(doc);
    if (/\d[\d,]*\s*个?\s*(?:Google\s+Flow\s*)?(?:AI\s*credits?|credits?|点数|积分)/i.test(initial)) {
      return;
    }

    const clickedByLabel = clickElementByTextOrLabel(
      doc,
      /Google\s*(?:Account|账号|帐号)|Profile|个人资料|账户|账号|Credits|点数/i
    );

    if (!clickedByLabel) {
      const avatarImg = doc.querySelector<HTMLImageElement>(
        'img[src*="googleusercontent.com"]'
      );
      const clickableParent = avatarImg?.closest<HTMLElement>('button, [role="button"]');
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

    // 1. 优先解析 Google One「Google Flow 活动记录」详细页（one.google.com/ai/activity?utm_source=flow...）
    if (url.toLowerCase().includes('one.google.com')) {
      const activityResult = parseGoogleOneFlowActivity(text);
      if (activityResult) return activityResult;
      // 防止没有 utm_source=flow 时把「AI 点数 0」误当成 Flow 点数
      return {
        benefitId: 'flow',
        status: 'fallback',
        metrics: {},
        message: '当前打开的是通用 AI 点数页，未包含 Flow 明细，请点「刷新」重新同步',
      };
    }

    // 2. 兼容 flow.google.com 头像浮层解析
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

    const resetMatch = text.match(
      /(?:重置时间|刷新时间|Resets?(?:\s+on)?)\s*[:：]?\s*([^\n]{3,24})/i
    );
    const resetInfo = resetMatch ? `重置时间：${resetMatch[1].trim()}` : undefined;

    const singleMatch =
      text.match(/([\d,]+)\s*个?\s*(?:Google\s+Flow\s*)?(?:AI\s*credits?|credits?|AI\s*点数|点数|积分)/i) ||
      text.match(/(?:AI\s*credits?|AI\s*点数|剩余点数|可用点数|credits?)[\s:：]{0,16}([\d,]+)/i) ||
      text.match(/切换账号[\s\S]{0,80}?\b([\d,]{2,6})\b/);

    if (singleMatch) {
      const rem = parseNumberToken(singleMatch[1]);
      if (rem !== undefined) {
        return {
          benefitId: 'flow',
          status: 'synced',
          metrics: {
            primaryText: `剩余 ${rem.toLocaleString()} 个 Google Flow 点数`,
            secondaryText: '来自 Google Flow 头像浮层实时余额',
            remainingValue: rem,
            unit: '点',
            resetInfo,
          },
        };
      }
    }

    return {
      benefitId: 'flow',
      status: 'fallback',
      metrics: {},
      message: '未检测到 Flow 点数明细，可点击直达查看',
    };
  },
};
