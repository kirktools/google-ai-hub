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

function parseCloudBillingCredits(doc: Document, text: string) {
  // 1. 解析赠金表格行（例如 Welcome credit $300.00 + Google Developer Program premium benefit $10.00）
  const rows = deepQuerySelectorAll<HTMLElement>(
    doc,
    'table tbody tr, [role="row"], mat-row'
  );
  let totalOriginal = 0;
  let totalRemaining = 0;
  let hasRemainingCol = false;
  let matchedRows = 0;
  let hasMonthlyDevCredit = false;
  let hasWelcomeCredit = false;

  for (const row of rows) {
    const rowText = (row.innerText || row.textContent || '').replace(/\s+/g, ' ').trim();
    if (!rowText || /赠金名称|Credit\s+name/i.test(rowText)) continue;

    // 匹配该行中所有美元金额（通常为剩余值与原始值，或仅原始值）
    const amounts = Array.from(rowText.matchAll(/\$\s*([\d,]+\.\d{2}|\d[\d,]*)/g))
      .map((m) => parseNumberToken(m[1]))
      .filter((v): v is number => v !== undefined && v > 0);

    if (amounts.length === 0) continue;

    matchedRows++;
    if (/Developer\s+Program|CREDIT_TYPE_MONTHLY/i.test(rowText)) {
      hasMonthlyDevCredit = true;
    }
    if (/Welcome\s+credit|免费试用|Free\s+trial/i.test(rowText)) {
      hasWelcomeCredit = true;
    }

    if (amounts.length >= 2) {
      // 通常第一列是剩余值、第二列是原始值（或取较小值为剩余、较大值为原始）
      const orig = Math.max(amounts[0], amounts[1]);
      const rem = Math.min(amounts[0], amounts[1]);
      totalOriginal += orig;
      totalRemaining += rem;
      hasRemainingCol = true;
    } else {
      totalOriginal += amounts[0];
      totalRemaining += amounts[0];
    }
  }

  // 2. 顶部免费试用横幅兜底（"剩余 $300.00 赠金和 90 天时间"）
  const trialBanner =
    text.match(/剩余\s*\$\s*([\d,.]+)\s*赠金(?:和\s*(\d+)\s*天)?/i) ||
    text.match(/\$\s*([\d,.]+)\s*(?:in\s+)?(?:free\s+trial\s+)?credit\s+remaining/i);

  if (matchedRows > 0 && totalOriginal > 0) {
    const parts: string[] = [];
    if (hasMonthlyDevCredit) parts.push('含每月 Developer 赠金');
    if (hasWelcomeCredit) parts.push('含 $300 欢迎/试用赠金');
    if (trialBanner?.[2]) parts.push(`试用剩 ${trialBanner[2]} 天`);

    const usedPercent = hasRemainingCol
      ? Math.min(100, Math.max(0, Math.round(((totalOriginal - totalRemaining) / totalOriginal) * 100)))
      : 0;

    return {
      benefitId: 'ai_studio' as const,
      status: 'synced' as const,
      metrics: {
        primaryText: hasRemainingCol
          ? `Cloud 赠金剩余：$${totalRemaining.toFixed(2)} / $${totalOriginal.toFixed(2)}`
          : `Cloud 有效赠金合计：$${totalOriginal.toFixed(2)}（${matchedRows} 笔）`,
        secondaryText:
          parts.length > 0
            ? `来自 Google Cloud 结算页 · ${parts.join(' · ')}`
            : '来自 Google Cloud 结算赠金明细页',
        percent: usedPercent,
        remainingValue: totalRemaining,
        totalValue: totalOriginal,
        unit: 'USD',
      },
    };
  }

  if (trialBanner) {
    const rem = parseNumberToken(trialBanner[1]);
    if (rem !== undefined) {
      return {
        benefitId: 'ai_studio' as const,
        status: 'synced' as const,
        metrics: {
          primaryText: `Cloud 试用赠金剩余：$${rem.toFixed(2)}`,
          secondaryText: trialBanner[2]
            ? `剩余 ${trialBanner[2]} 天 · 来自 Google Cloud 结算页`
            : '来自 Google Cloud 结算页',
          remainingValue: rem,
          unit: 'USD',
        },
      };
    }
  }

  return null;
}

export const aiStudioParser: SiteParser = {
  id: 'ai_studio',

  isReady(doc) {
    const text = getVisibleText(doc);
    if (text.length < 80) return false;
    return /(?:Builders Hub|AI Studio|生成式\s*AI|Cloud\s*赠金|Welcome\s+credit|Billing|Credits?|赠金|结算|Sign in|登录)/i.test(
      text
    );
  },

  /** 主动后台同步时，如果落在 Cloud 结算概览页，自动点击左侧「赠金 / Credits」进入明细表 */
  async prepareForActiveSync(doc) {
    const href = window.location.href.toLowerCase();
    if (!href.includes('console.cloud.google.com/billing')) return;
    if (href.includes('/credits')) {
      // 已经在赠金页，等表格数据渲染完
      await sleepMs(1600);
      return;
    }

    // 如果落在结算账号列表或概览页，尝试点进左侧「赠金 / Credits」
    const clickedCredits = clickElementByTextOrLabel(
      doc,
      /^(?:赠金|所有赠金|Credits|All\s+credits)$/i,
      'a, button, [role="menuitem"], [role="treeitem"]'
    );
    if (clickedCredits) {
      await sleepMs(2200);
    }
  },

  parse(doc, url) {
    const text = getVisibleText(doc);
    if (isUnauthenticatedPage(doc, url, text)) {
      return buildUnauthenticatedResult('ai_studio');
    }

    // 0. 优先解析 Google Cloud 结算赠金页 (console.cloud.google.com/billing)
    if (url.toLowerCase().includes('console.cloud.google.com')) {
      const billingResult = parseCloudBillingCredits(doc, text);
      if (billingResult) return billingResult;

      // 如果当前停在结算账号列表页（未进入 /credits），提取 6-6-6 格式结算账号 ID 并自动跳转至 /credits/all
      if (!url.toLowerCase().includes('/credits')) {
        const accountIdMatch = text.match(/\b([A-F0-9]{6}-[A-F0-9]{6}-[A-F0-9]{6})\b/);
        if (accountIdMatch) {
          const authMatch = url.match(/[?&]authuser=(\d+)/i);
          const authQuery = authMatch ? `?authuser=${authMatch[1]}` : '';
          return {
            benefitId: 'ai_studio',
            status: 'fallback',
            metrics: {},
            redirectUrl: `https://console.cloud.google.com/billing/${accountIdMatch[1]}/credits/all${authQuery}`,
            message: '正在自动跳转至 Cloud 赠金明细页…',
          };
        }
      }
    }

    // 1. 解析 Google Builders Hub (me.developers.google.com/benefits) 真实赠金卡片
    const monthlyCreditMatch =
      text.match(
        /每月\s*\$\s*([\d,.]+)\s*的?\s*(?:生成式\s*AI|GenAI|Google\s*Cloud|Cloud)[^\n]{0,20}(?:赠金|抵用金|抵扣金)/i
      ) ||
      text.match(
        /\$\s*([\d,.]+)\s*(?:monthly|\/\s*month)?\s*(?:GenAI|Generative\s+AI|Google\s+Cloud|Cloud)\s*(?:and\s+Cloud\s+)?credits?/i
      );

    const expiryMatch = text.match(/(?:到期时间|Expires?|Valid\s+until)\s*[:：]?\s*([^\n]{4,24})/i);
    const expiryInfo = expiryMatch ? `有效期至 ${expiryMatch[1].trim()}` : undefined;

    if (monthlyCreditMatch) {
      const amount = parseNumberToken(monthlyCreditMatch[1]);
      const amountLabel = amount !== undefined ? `$${amount}` : `$${monthlyCreditMatch[1]}`;

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
            secondaryText: '打开 Cloud 结算赠金页可自动同步 $300 / $10 等精确余额',
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
          secondaryText: '打开 Google Cloud 结算赠金页可顺路同步精确美元余额',
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
      message: '未读到赠金余额，可打开 Google Cloud 结算赠金页自动同步',
    };
  },
};
