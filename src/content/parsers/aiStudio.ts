import {
  buildUnauthenticatedResult,
  getVisibleText,
  isUnauthenticatedPage,
  parseNumberToken,
  type SiteParser,
} from './types';

export const aiStudioParser: SiteParser = {
  id: 'ai_studio',

  isReady(doc) {
    const text = getVisibleText(doc);
    if (text.length < 80) return false;
    return /(?:Builders Hub|AI Studio|生成式\s*AI|Cloud\s*赠金|Billing|Credits?|赠金|结算账号|Sign in|登录)/i.test(
      text
    );
  },

  parse(doc, url) {
    const text = getVisibleText(doc);
    if (isUnauthenticatedPage(doc, url, text)) {
      return buildUnauthenticatedResult('ai_studio');
    }

    // 1. 优先解析 Google Builders Hub (me.developers.google.com/benefits) 真实赠金卡片
    const monthlyCreditMatch =
      text.match(/每月\s*\$\s*([\d,.]+)\s*的?\s*(?:生成式\s*AI|GenAI|Google\s*Cloud|Cloud)[^\n]{0,20}(?:赠金|抵用金|抵扣金)/i) ||
      text.match(/\$\s*([\d,.]+)\s*(?:monthly|\/\s*month)?\s*(?:GenAI|Generative\s+AI|Google\s+Cloud|Cloud)\s*(?:and\s+Cloud\s+)?credits?/i);

    const expiryMatch = text.match(/(?:到期时间|Expires?|Valid\s+until)\s*[:：]?\s*([^\n]{4,24})/i);
    const expiryInfo = expiryMatch ? `有效期至 ${expiryMatch[1].trim()}` : undefined;

    if (monthlyCreditMatch) {
      const amount = parseNumberToken(monthlyCreditMatch[1]);
      const amountLabel = amount !== undefined ? `$${amount}` : `$${monthlyCreditMatch[1]}`;

      // 判断是否尚未绑定结算账号 / 待激活
      const needsBillingSetup =
        /Action\s+Required|没有可用的结算账号|Create\s+Google\s+Cloud\s+Billing\s+Account|创建.*结算账号/i.test(
          text
        );
      const isClaimed =
        /(?:已领取|已兑换|已应用|已激活|Claimed|Applied|Active\s+credit)/i.test(text) &&
        !needsBillingSetup;

      if (needsBillingSetup) {
        return {
          benefitId: 'ai_studio',
          status: 'synced',
          metrics: {
            primaryText: `待领取：每月 ${amountLabel} 生成式 AI 与 Cloud 赠金`,
            secondaryText: '需先创建/绑定 Google Cloud 结算账号后返回福利页激活',
            percent: 0,
            remainingValue: amount ?? 10,
            totalValue: amount ?? 10,
            unit: 'USD',
            resetInfo: expiryInfo,
          },
        };
      }

      if (isClaimed) {
        return {
          benefitId: 'ai_studio',
          status: 'synced',
          metrics: {
            primaryText: `已激活：每月 ${amountLabel} 生成式 AI 与 Cloud 赠金`,
            secondaryText: '来自 Google Builders Hub 福利页',
            remainingValue: amount ?? 10,
            totalValue: amount ?? 10,
            unit: 'USD',
            resetInfo: expiryInfo,
          },
        };
      }

      return {
        benefitId: 'ai_studio',
        status: 'synced',
        metrics: {
          primaryText: `可享每月 ${amountLabel} 生成式 AI 与 Cloud 赠金`,
          secondaryText: '点击直达 Google Builders Hub 确认领取状态',
          remainingValue: amount ?? 10,
          totalValue: amount ?? 10,
          unit: 'USD',
          resetInfo: expiryInfo,
        },
      };
    }

    // 2. 兼容 AI Studio (aistudio.google.com/usage) 美元余额解析
    const dollarPair = text.match(
      /\$\s*([\d,.]+)\s*(?:\/|of)\s*\$\s*([\d,.]+)\s*(?:credits?|赠金|remaining|剩余)?/i
    );
    if (dollarPair) {
      const rem = parseNumberToken(dollarPair[1]);
      const tot = parseNumberToken(dollarPair[2]);
      if (rem !== undefined && tot !== undefined && tot > 0) {
        return {
          benefitId: 'ai_studio',
          status: 'synced',
          metrics: {
            primaryText: `赠金余额：$${rem.toFixed(2)} / $${tot.toFixed(2)}`,
            secondaryText: '来自 AI Studio 页面可见信息',
            percent: Math.min(100, Math.max(0, Math.round(((tot - rem) / tot) * 100))),
            remainingValue: rem,
            totalValue: tot,
            unit: 'USD',
          },
        };
      }
    }

    const dollarSingle =
      text.match(/(?:credits?|balance|赠金|余额|抵扣金)[^\n$]{0,20}\$\s*([\d,.]+)/i) ||
      text.match(/\$\s*([\d,.]+)\s*(?:in\s+)?(?:monthly\s+)?(?:credits?|赠金|credit\s+remaining)/i);
    if (dollarSingle) {
      const rem = parseNumberToken(dollarSingle[1]);
      if (rem !== undefined) {
        return {
          benefitId: 'ai_studio',
          status: 'synced',
          metrics: {
            primaryText: `可用赠金：$${rem.toFixed(2)}`,
            secondaryText: '建议月底前消耗，避免过期浪费',
            remainingValue: rem,
            unit: 'USD',
          },
        };
      }
    }

    return {
      benefitId: 'ai_studio',
      status: 'fallback',
      metrics: {},
      message: '未读到赠金状态，可点击直达 Google Builders Hub 查看或领取',
    };
  },
};
