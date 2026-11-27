import type { PlanId } from '../../shared/types';
import {
  buildUnauthenticatedResult,
  extractDayOfMonth,
  extractGoogleAccountLabel,
  getVisibleText,
  isUnauthenticatedPage,
  parseNumberToken,
  toGigabytes,
  type SiteParser,
} from './types';

/** 过滤掉 Google One 页面中的升级推广广告文案（避免把「升级到 Google AI Ultra」误判为当前套餐） */
function stripUpsellLines(text: string): string {
  const upsellLinePattern =
    /(?:升级(?:到|至)?|upgrade\s+to|try\s+google\s+ai|get\s+google\s+ai|switch\s+to|切换(?:到|至)?|探索|了解|解锁更多|获取更多|free\s+trial|免费试用|体验\s*Google\s+AI)/i;
  return text
    .split('\n')
    .filter((line) => !upsellLinePattern.test(line))
    .join('\n');
}

function detectPlanFromText(
  rawText: string,
  totalStorageGb: number | undefined
): { planId: PlanId; rawName: string } | null {
  const cleanText = stripUpsellLines(rawText);

  // 1. 优先从明确的「当前方案 / Current plan」上下文附近匹配
  const currentPlanContext = cleanText.match(
    /(?:当前方案|当前套餐|您的方案|我的方案|订阅方案|current\s+plan|your\s+plan|active\s+plan)[\s\S]{0,80}/i
  )?.[0];

  const matchPlanInSnippet = (snippet: string): { planId: PlanId; rawName: string } | null => {
    if (/Google\s+AI\s+Ultra[^\n]{0,24}20x|AI\s+Ultra\s*\(?\s*20x\s*\)?/i.test(snippet)) {
      return { planId: 'ultra_20x', rawName: 'Google AI Ultra (20x)' };
    }
    if (/Google\s+AI\s+Ultra[^\n]{0,24}5x|AI\s+Ultra\s*\(?\s*5x\s*\)?/i.test(snippet)) {
      return { planId: 'ultra_5x', rawName: 'Google AI Ultra (5x)' };
    }
    if (/Google\s+(?:One\s+)?AI\s+(?:Pro|Premium)|Google\s+AI\s*专业版|AI\s*专业版/i.test(snippet)) {
      return { planId: 'pro', rawName: 'Google AI Pro' };
    }
    if (/Google\s+(?:One\s+)?AI\s+Plus|Google\s+AI\s*进阶版/i.test(snippet)) {
      return { planId: 'plus', rawName: 'Google AI Plus' };
    }
    if (/Google\s+AI\s+Ultra/i.test(snippet)) {
      const is20x = /25,?000\s*(?:AI\s*credits|点数|积分)/i.test(snippet);
      return {
        planId: is20x ? 'ultra_20x' : 'ultra_5x',
        rawName: is20x ? 'Google AI Ultra (20x)' : 'Google AI Ultra (5x)',
      };
    }
    return null;
  };

  if (currentPlanContext) {
    const found = matchPlanInSnippet(currentPlanContext);
    if (found) return found;
  }

  // 2. 结合云盘总容量交叉校验，彻底杜绝 Pro (2 TB) 被广告误判成 Ultra (30 TB)
  if (totalStorageGb !== undefined) {
    // 30 TB 左右属于 Ultra
    if (totalStorageGb >= 20 * 1024) {
      const is20x = /20x|25,?000/i.test(cleanText);
      return {
        planId: is20x ? 'ultra_20x' : 'ultra_5x',
        rawName: is20x ? 'Google AI Ultra (20x · 30 TB)' : 'Google AI Ultra (5x · 30 TB)',
      };
    }
    // 2 TB 左右且有 AI 权益属于 Google AI Pro
    if (totalStorageGb >= 1800 && totalStorageGb <= 5200) {
      return { planId: 'pro', rawName: 'Google AI Pro (2 TB)' };
    }
    // 200 GB 左右属于 Google AI Plus / 基础付费
    if (totalStorageGb >= 180 && totalStorageGb <= 250) {
      return { planId: 'plus', rawName: 'Google AI Plus (200 GB)' };
    }
    // 15 GB 属于免费版
    if (totalStorageGb <= 20) {
      return { planId: 'free', rawName: 'Google 免费版 (15 GB)' };
    }
  }

  // 3. 退回在剔除广告行后的文本里匹配（Pro / Plus 优先于无容量支撑的 Ultra 关键词）
  const proMatch = cleanText.match(
    /Google\s+(?:One\s+)?AI\s+(?:Pro|Premium)(?:\s*\([^)\n]{1,20}\))?|Google\s+AI\s*专业版/i
  );
  if (proMatch) {
    return { planId: 'pro', rawName: proMatch[0].trim() };
  }

  const plusMatch = cleanText.match(
    /Google\s+(?:One\s+)?AI\s+Plus(?:\s*\([^)\n]{1,20}\))?|Google\s+AI\s*进阶版/i
  );
  if (plusMatch) {
    return { planId: 'plus', rawName: plusMatch[0].trim() };
  }

  // 只有当明确出现 30 TB 或 12,500/25,000 点数时，才在无「当前方案」锚点的情况下认定为 Ultra
  if (/Google\s+AI\s+Ultra/i.test(cleanText) && /(?:30\s*TB|12,?500|25,?000)/i.test(cleanText)) {
    const is20x = /20x|25,?000/i.test(cleanText);
    return {
      planId: is20x ? 'ultra_20x' : 'ultra_5x',
      rawName: is20x ? 'Google AI Ultra (20x)' : 'Google AI Ultra (5x)',
    };
  }

  return null;
}

export const googleOneParser: SiteParser = {
  id: 'google_one',

  isReady(doc) {
    const text = getVisibleText(doc);
    if (text.length < 120) return false;
    return /(?:GB|TB|AI\s*Credits|Google\s+AI|Google\s+One|存储空间|云端硬盘|已使用|已用|登录|Sign in)/i.test(
      text
    );
  },

  parse(doc, url) {
    const text = getVisibleText(doc);
    if (isUnauthenticatedPage(doc, url, text)) {
      return buildUnauthenticatedResult('google_one');
    }

    // 1. 解析云盘空间（支持跨行、中文括号、英文 of、斜杠等多种排版）
    let storageText: string | undefined;
    let percent: number | undefined;
    let usedGb: number | undefined;
    let totalGb: number | undefined;

    const storagePatterns = [
      // 中文：已使用 156.4 GB，共 2 TB / 已用 156.4 GB（共 2 TB） / 已使用 156.4 GB\n共 2 TB
      /(?:已使用|已用)\s*([\d.,]+)\s*(MB|GB|TB)[\s，,（(]{0,8}(?:共|总额度|\/|总计)\s*([\d.,]+)\s*(MB|GB|TB)/i,
      // 英文：156.4 GB of 2 TB used / 156.4 GB used of 2 TB
      /([\d.,]+)\s*(MB|GB|TB)\s*(?:used\s+)?(?:of|\/)\s*([\d.,]+)\s*(MB|GB|TB)\s*(?:used)?/i,
      // 紧凑跨行：156.4 GB\n/\n2 TB
      /([\d.,]+)\s*(MB|GB|TB)\s*\/\s*([\d.,]+)\s*(MB|GB|TB)/i,
      // 反向中文：共 2 TB，已使用 156.4 GB
      /(?:共|总计)\s*([\d.,]+)\s*(MB|GB|TB)[\s，,]{0,8}(?:已使用|已用)\s*([\d.,]+)\s*(MB|GB|TB)/i,
    ];

    for (let idx = 0; idx < storagePatterns.length; idx++) {
      const m = text.match(storagePatterns[idx]);
      if (!m) continue;

      const isReversed = idx === 3;
      const usedRaw = isReversed ? m[3] : m[1];
      const usedUnit = (isReversed ? m[4] : m[2]).toUpperCase();
      const totalRaw = isReversed ? m[1] : m[3];
      const totalUnit = (isReversed ? m[2] : m[4]).toUpperCase();

      const usedNum = parseNumberToken(usedRaw);
      const totalNum = parseNumberToken(totalRaw);
      if (usedNum !== undefined && totalNum !== undefined && totalNum > 0) {
        const uGb = toGigabytes(usedNum, usedUnit);
        const tGb = toGigabytes(totalNum, totalUnit);
        // 过滤明显不合理的匹配（例如已用大于总量 2 倍以上）
        if (tGb >= 10 && uGb <= tGb * 1.5) {
          usedGb = Math.round(uGb * 10) / 10;
          totalGb = Math.round(tGb * 10) / 10;
          storageText = `已用 ${usedRaw} ${usedUnit} / ${totalRaw} ${totalUnit}`;
          percent = Math.min(100, Math.max(0, Math.round((uGb / tGb) * 100)));
          break;
        }
      }
    }

    // 如果页面直接写了百分比（例如 "已使用 14%" / "14% used"），作为百分比兜底
    if (percent === undefined) {
      const pctMatch =
        text.match(/(?:已使用|已用)\s*(\d{1,3})\s*%/) ||
        text.match(/(\d{1,3})\s*%\s*(?:used|of\s+storage)/i);
      if (pctMatch) {
        const p = Number(pctMatch[1]);
        if (p >= 0 && p <= 100) percent = p;
      }
    }

    // 2. 结合云盘总量准确识别当前套餐
    const planMatch = detectPlanFromText(text, totalGb);

    // 3. 解析 AI Credits 剩余点数（支持跨行）
    let creditsText: string | undefined;
    let remainingCredits: number | undefined;
    let totalCredits: number | undefined;
    let secondaryPercent: number | undefined;

    const creditsPairMatch =
      text.match(
        /(?:AI\s*credits?|AI\s*点数|AI\s*积分)[\s\S]{0,24}?([\d,]+)\s*(?:\/|of|共)\s*([\d,]+)/i
      ) ||
      text.match(
        /([\d,]+)\s*(?:\/|of)\s*([\d,]+)\s*(?:AI\s*credits?|AI\s*点数|AI\s*积分)/i
      );

    if (creditsPairMatch) {
      remainingCredits = parseNumberToken(creditsPairMatch[1]);
      totalCredits = parseNumberToken(creditsPairMatch[2]);
      if (remainingCredits !== undefined && totalCredits !== undefined && totalCredits > 0) {
        creditsText = `AI Credits：剩余 ${remainingCredits.toLocaleString()} / ${totalCredits.toLocaleString()} 点`;
        secondaryPercent = Math.min(
          100,
          Math.max(0, Math.round(((totalCredits - remainingCredits) / totalCredits) * 100))
        );
      }
    } else {
      const creditsSingleMatch =
        text.match(/(?:AI\s*credits?|AI\s*点数|AI\s*积分)[^\n\d]{0,16}([\d,]+)/i) ||
        text.match(/([\d,]+)\s*(?:AI\s*credits?|AI\s*点数|AI\s*积分)/i);
      if (creditsSingleMatch) {
        remainingCredits = parseNumberToken(creditsSingleMatch[1]);
        if (remainingCredits !== undefined) {
          creditsText = `AI Credits：剩余 ${remainingCredits.toLocaleString()} 点`;
        }
      }
    }

    // 4. 解析续费/重置日期（若无明确续费日，兼容「自 2026年11月26日起成为会员」推算每月账单日）
    let resetDateText: string | undefined;
    let resetDay: number | null = null;
    const resetMatch =
      text.match(
        /(?:renews?(?:\s+on)?|resets?(?:\s+on)?|next\s+billing\s+date|续费日期|下次续费|重置日期|将于)[^\n]{0,28}/i
      ) ||
      text.match(/(?:自\s*\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日(?:起)?成为会员|Member\s+since[^\n]{4,24})/i);
    if (resetMatch) {
      const snippet = resetMatch[0].trim();
      const day = extractDayOfMonth(snippet);
      if (day) {
        resetDay = day;
        resetDateText = `每月 ${day} 日重置`;
      }
    }

    const accountLabel = extractGoogleAccountLabel(doc);
    const hasUsefulData = Boolean(storageText || creditsText || planMatch);

    if (!hasUsefulData) {
      return {
        benefitId: 'google_one',
        status: 'fallback',
        metrics: {},
        accountLabel,
        message: '页面结构暂未匹配到具体数值，可点击直达官网查看或手动校准',
      };
    }

    return {
      benefitId: 'google_one',
      status: 'synced',
      accountLabel,
      metrics: {
        primaryText: storageText ?? (planMatch ? `当前订阅：${planMatch.rawName}` : undefined),
        secondaryText: creditsText,
        percent,
        secondaryPercent,
        usedValue: usedGb,
        remainingValue: remainingCredits,
        totalValue: totalCredits ?? totalGb,
        unit: remainingCredits !== undefined ? '点' : totalGb !== undefined ? 'GB' : undefined,
        resetInfo: resetDateText,
      },
      planHint: planMatch
        ? {
            planId: planMatch.planId,
            rawName: planMatch.rawName,
            resetDay,
            resetDateText,
          }
        : undefined,
    };
  },
};
