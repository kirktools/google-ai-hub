import type { ParsedSiteResult, SyncableBenefitId } from '../../shared/types';

export interface SiteParser {
  id: SyncableBenefitId;
  /** 判断页面 DOM 是否已渲染出有意义的内容（用于 SPA 轮询等待） */
  isReady(doc: Document): boolean;
  /** 仅在后台标签页主动同步时触发：展开需要点击才可见的菜单/弹窗（如头像、设置→用量限制、查看资源） */
  prepareForActiveSync?(doc: Document): Promise<void>;
  /** 从当前页面提取结构化可见信息 */
  parse(doc: Document, url: string): ParsedSiteResult;
}

export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 递归收集包含 Shadow DOM 在内的所有匹配元素（兼容 Colab / Polymer / Lit Web Components） */
export function deepQuerySelectorAll<T extends Element = HTMLElement>(
  root: Document | ShadowRoot | Element,
  selector: string
): T[] {
  const results: T[] = Array.from(root.querySelectorAll<T>(selector));
  const allNodes = root.querySelectorAll('*');
  for (const node of allNodes) {
    if (node.shadowRoot) {
      results.push(...deepQuerySelectorAll<T>(node.shadowRoot, selector));
    }
  }
  return results;
}

/** 递归提取包含 Shadow DOM 在内的可见纯文本 */
function collectShadowText(root: Document | ShadowRoot | Element, out: string[]): void {
  const allNodes = root.querySelectorAll('*');
  for (const node of allNodes) {
    if (node.shadowRoot) {
      const txt = (node.shadowRoot.textContent || '').trim();
      if (txt) out.push(txt);
      collectShadowText(node.shadowRoot, out);
    }
  }
}

/** 根据文本或 aria-label 查找并点击可交互按钮（支持穿透 Shadow DOM，禁止点击会打开新前台标签的链接） */
export function clickElementByTextOrLabel(
  doc: Document,
  pattern: RegExp,
  selector = 'button, [role="button"], [role="menuitem"]'
): boolean {
  const candidates = deepQuerySelectorAll<HTMLElement>(doc, selector);
  for (const el of candidates) {
    // 绝对禁止点击会弹出新前台标签页的 <a> 链接，防止抢占用户当前页面焦点
    if (el.tagName === 'A') {
      const target = (el.getAttribute('target') || '').toLowerCase();
      if (target === '_blank' || target === '_top') continue;
    }
    const label = [
      el.getAttribute('aria-label') || '',
      el.getAttribute('title') || '',
      el.innerText || el.textContent || '',
    ]
      .join(' ')
      .trim();
    if (label && pattern.test(label)) {
      el.click();
      return true;
    }
  }
  return false;
}

/** 提取页面规范化后的可见纯文本（自动穿透 Shadow DOM） */
export function getVisibleText(doc: Document): string {
  const chunks: string[] = [];
  const mainText = doc.body?.innerText || doc.documentElement?.textContent || '';
  if (mainText) chunks.push(mainText);
  collectShadowText(doc, chunks);
  return chunks
    .join('\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 生成严格脱敏的诊断信息（仅保留主机名与状态类别，绝不采集页面正文、标题或账单 ID） */
export function buildSanitizedDebugInfo(url: string, reason: string): {
  host: string;
  reason: string;
} {
  let host = 'unknown';
  try {
    host = new URL(url).hostname;
  } catch {
    host = 'invalid-url';
  }
  return { host, reason };
}

/** 通用未登录状态检测（兼容中英文 Google 登录页与登录按钮） */
export function isUnauthenticatedPage(doc: Document, url: string, text: string): boolean {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('accounts.google.com') || lowerUrl.includes('/servicelogin')) {
    return true;
  }

  // 检查页面中是否存在显式 Google 登录链接且缺少已登录头像标识
  const hasAvatar = Boolean(
    doc.querySelector(
      'a[href*="SignOutOptions"], img[src*="googleusercontent.com/a/"], [aria-label*="Google Account"], [aria-label*="Google 账号"], [aria-label*="Google 帐号"]'
    )
  );
  if (hasAvatar) return false;

  const signInLinks = doc.querySelectorAll(
    'a[href*="accounts.google.com/ServiceLogin"], a[href*="accounts.google.com/v3/signin"]'
  );
  if (signInLinks.length > 0 && text.length < 2500) {
    return true;
  }

  // 仅当页面主体很短且明确提示登录时判定未登录，避免误判已登录页面上的帮助文案
  if (
    text.length < 900 &&
    /(?:^|\n)\s*(?:Sign in|Log in|登录|立即登录|使用 Google 账号登录)\s*(?:\n|$)/i.test(text)
  ) {
    return true;
  }

  return false;
}

/** 将带逗号的数字字符串转为 number */
export function parseNumberToken(token: string | undefined): number | undefined {
  if (!token) return undefined;
  const cleaned = token.replace(/,/g, '').trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : undefined;
}

/** 将容量（MB / GB / TB）统一换算为 GB，便于计算百分比 */
export function toGigabytes(value: number, unit: string): number {
  const u = unit.toUpperCase();
  if (u === 'TB') return value * 1024;
  if (u === 'MB') return value / 1024;
  if (u === 'KB') return value / (1024 * 1024);
  return value;
}

/** 从常见中英文日期文本中提取每月的“日”（1-31） */
export function extractDayOfMonth(dateText: string): number | null {
  // 中文格式：2026年12月15日 / 12月15日 / 每月15日
  const zhMatch = dateText.match(/(?:(?:\d{4}\s*年\s*)?\d{1,2}\s*月|每月)\s*(\d{1,2})\s*[日号]?/);
  if (zhMatch) {
    const day = Number(zhMatch[1]);
    if (day >= 1 && day <= 31) return day;
  }

  // 英文格式：Dec 15, 2026 / December 15 / 15 Dec
  const enMonthFirst = dateText.match(
    /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?/i
  );
  if (enMonthFirst) {
    const day = Number(enMonthFirst[1]);
    if (day >= 1 && day <= 31) return day;
  }

  const enDayFirst = dateText.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/i
  );
  if (enDayFirst) {
    const day = Number(enDayFirst[1]);
    if (day >= 1 && day <= 31) return day;
  }

  // ISO 或斜杠格式：2026-12-15 或 2026/12/15
  const isoMatch = dateText.match(/\b\d{4}[-/]\d{1,2}[-/](\d{1,2})\b/);
  if (isoMatch) {
    const day = Number(isoMatch[1]);
    if (day >= 1 && day <= 31) return day;
  }

  return null;
}

/** 遮盖邮箱中间字符（例如 a***@gmail.com） */
function maskEmailInLabel(raw: string): string {
  return raw.replace(
    /\b([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g,
    '$1***$2'
  );
}

/** 提取当前页面已登录 Google 账号的脱敏展示名称（仅用于本地确认登录态） */
export function extractGoogleAccountLabel(doc: Document): string | undefined {
  const el = doc.querySelector<HTMLElement>(
    'a[aria-label*="Google Account"], a[aria-label*="Google 账号"], a[aria-label*="Google 帐号"], button[aria-label*="Google Account"], button[aria-label*="Google 账号"], button[aria-label*="Google 帐号"]'
  );
  const rawLabel = el?.getAttribute('aria-label') || '';
  if (rawLabel) {
    const cleaned = maskEmailInLabel(
      rawLabel
        .replace(/^Google\s*(?:Account|账号|帐号)\s*[:：]\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim()
    );
    if (cleaned.length > 0 && cleaned.length <= 80) {
      return cleaned;
    }
  }
  return undefined;
}

export function buildUnauthenticatedResult(benefitId: SyncableBenefitId): ParsedSiteResult {
  return {
    benefitId,
    status: 'unauthenticated',
    metrics: {},
    message: '请先在 Chrome 登录 Google 账号',
  };
}
