import { BENEFIT_CATALOG } from './plans';
import type { BenefitId, HubStorageState, PlanId } from './types';

/** 一键同步防抖冷却时间：3 分钟 */
export const SYNC_COOLDOWN_MS = 3 * 60 * 1000;

/** 单个后台标签页同步最大超时：16 秒 */
export const SINGLE_TAB_TIMEOUT_MS = 16_000;

/** 距重置日 <= 5 天时触发月度防浪费提醒 */
export const WASTE_ALERT_DAYS_THRESHOLD = 5;

/** 获取对应平台的直达 URL（直接使用 Chrome 当前默认登录的 Google 账号） */
export function buildAccountUrl(benefitId: BenefitId): string {
  return BENEFIT_CATALOG[benefitId].baseUrl;
}

/** 计算当前生效的套餐 ID（手动覆盖优先，其次自动识别，最后默认 free） */
export function getActivePlanId(state: HubStorageState): PlanId {
  return state.settings.manualPlanOverride ?? state.planDetection.detectedPlanId ?? 'free';
}

/** 获取当前生效的账单/额度重置日（1-31） */
export function getActiveResetDay(state: HubStorageState): number | null {
  return state.settings.manualResetDay ?? state.planDetection.detectedResetDay ?? null;
}

/** 根据每月重置日（1-31）计算距离下次重置还有多少天 */
export function getDaysUntilReset(resetDay: number | null, now = new Date()): number | null {
  if (!resetDay || resetDay < 1 || resetDay > 31) return null;

  const year = now.getFullYear();
  const month = now.getMonth();
  const today = new Date(year, month, now.getDate());

  const clampDay = (y: number, m: number, d: number) => {
    const lastDay = new Date(y, m + 1, 0).getDate();
    return Math.min(d, lastDay);
  };

  let target = new Date(year, month, clampDay(year, month, resetDay));
  if (target < today) {
    target = new Date(year, month + 1, clampDay(year, month + 1, resetDay));
  }

  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

/** 格式化相对时间（简体中文） */
export function formatRelativeTime(timestamp: number | null, nowMs = Date.now()): string {
  if (!timestamp) return '尚未同步';
  const diffSec = Math.max(0, Math.floor((nowMs - timestamp) / 1000));
  if (diffSec < 30) return '刚刚';
  if (diffSec < 60) return `${diffSec} 秒前`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小时前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay} 天前`;
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/** 格式化剩余冷却时间 */
export function formatCooldown(ms: number): string {
  const sec = Math.max(1, Math.ceil(ms / 1000));
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min <= 0) return `${remSec} 秒`;
  return remSec > 0 ? `${min} 分 ${remSec} 秒` : `${min} 分钟`;
}

/** 判断 URL 对应哪个可同步平台 */
export function detectBenefitIdFromUrl(urlStr: string): BenefitId | null {
  try {
    const parsedUrl = new URL(urlStr);
    const host = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname.toLowerCase();
    if (host === 'one.google.com') {
      return pathname.includes('/ai/activity') ? 'flow' : 'google_one';
    }
    if (
      host === 'aistudio.google.com' ||
      host === 'me.developers.google.com' ||
      host === 'console.cloud.google.com'
    ) {
      return 'ai_studio';
    }
    if (host === 'flow.google.com' || host === 'labs.google') return 'flow';
    if (host === 'colab.research.google.com') return 'colab';
    if (host === 'gemini.google.com') return 'gemini';
    if (host === 'notebooklm.google.com' || host === 'notebook.google.com') return 'notebooklm';
    return null;
  } catch {
    return null;
  }
}
