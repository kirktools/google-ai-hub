import { DEFAULT_CARD_ORDER } from './plans';
import type {
  BenefitId,
  BenefitMetrics,
  BenefitRecord,
  HubStorageState,
  ParsedSiteResult,
  SyncProgressState,
  UserSettings,
} from './types';

export const STORAGE_KEY = 'google_ai_hub_state_v1';
const SCHEMA_VERSION = 1;

function createEmptyBenefit(id: BenefitId): BenefitRecord {
  return {
    id,
    status: 'idle',
    source: 'default',
    updatedAt: null,
    metrics: {},
    manualOverride: null,
  };
}

export function createInitialState(): HubStorageState {
  const benefits = {} as Record<BenefitId, BenefitRecord>;
  for (const id of DEFAULT_CARD_ORDER) {
    benefits[id] = createEmptyBenefit(id);
  }

  return {
    version: SCHEMA_VERSION,
    settings: {
      manualPlanOverride: null,
      manualResetDay: null,
      theme: 'system',
      progressBarMode: 'remaining',
      cardOrder: [...DEFAULT_CARD_ORDER],
      collapsedCards: ['ecosystem'],
      wasteAlertEnabled: true,
      autoSyncIntervalMinutes: 60,
    },
    planDetection: {
      detectedPlanId: null,
      detectedResetDay: null,
      detectedAt: null,
    },
    syncProgress: {
      running: false,
      mode: null,
      currentStep: 0,
      totalSteps: 0,
      currentTargetId: null,
      currentLabel: '',
      lastSyncedAt: null,
      lastCooldownUntil: null,
    },
    benefits,
  };
}

/** 合并并规范化读取出的状态，避免版本升级后缺字段 */
export function normalizeState(raw: unknown): HubStorageState {
  const base = createInitialState();
  if (!raw || typeof raw !== 'object') return base;
  const data = raw as Partial<HubStorageState>;

  const mergedSettings: UserSettings = {
    ...base.settings,
    ...(data.settings ?? {}),
  };

  // 确保 cardOrder 包含所有合法卡片且无重复
  const validSet = new Set<BenefitId>(DEFAULT_CARD_ORDER);
  const dedupedOrder = (mergedSettings.cardOrder ?? []).filter((id): id is BenefitId =>
    validSet.has(id)
  );
  for (const id of DEFAULT_CARD_ORDER) {
    if (!dedupedOrder.includes(id)) dedupedOrder.push(id);
  }
  mergedSettings.cardOrder = Array.from(new Set(dedupedOrder));
  const rawInterval = mergedSettings.autoSyncIntervalMinutes;
  mergedSettings.autoSyncIntervalMinutes =
    typeof rawInterval === 'number' && rawInterval >= 60 ? Math.floor(rawInterval) : 0;
  mergedSettings.progressBarMode =
    mergedSettings.progressBarMode === 'used' ? 'used' : 'remaining';

  const mergedBenefits = { ...base.benefits };
  if (data.benefits && typeof data.benefits === 'object') {
    for (const id of DEFAULT_CARD_ORDER) {
      if (data.benefits[id]) {
        const rawDebug = data.benefits[id].debugInfo as
          | { host?: string; reason?: string; textSnippet?: string }
          | undefined;
        // 清理旧版本缓存中可能残留的页面正文片段
        const cleanDebug =
          rawDebug && typeof rawDebug.host === 'string' && typeof rawDebug.reason === 'string'
            ? { host: rawDebug.host, reason: rawDebug.reason }
            : undefined;
        const stored = data.benefits[id];
        // 旧版本在刷新失败后仍沿用缓存的 synced 状态。
        const wasFailedRefresh =
          stored.status === 'synced' &&
          cleanDebug &&
          (cleanDebug.reason === 'fallback' ||
            cleanDebug.reason.startsWith('fallback_') ||
            cleanDebug.reason === 'content_script_unresponsive');
        mergedBenefits[id] = {
          ...base.benefits[id],
          ...stored,
          id,
          status: wasFailedRefresh ? 'fallback' : (stored.status ?? base.benefits[id].status),
          debugInfo: cleanDebug,
          metrics: { ...(stored.metrics ?? {}) },
        };
      }
    }
  }

  return {
    version: SCHEMA_VERSION,
    settings: mergedSettings,
    planDetection: {
      ...base.planDetection,
      ...(data.planDetection ?? {}),
    },
    syncProgress: {
      ...base.syncProgress,
      ...(data.syncProgress ?? {}),
    },
    benefits: mergedBenefits,
  };
}

export async function loadState(): Promise<HubStorageState> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeState(result[STORAGE_KEY]);
}

export async function saveState(state: HubStorageState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

export async function updateSettings(patch: Partial<UserSettings>): Promise<HubStorageState> {
  const state = await loadState();
  state.settings = { ...state.settings, ...patch };
  await saveState(state);
  return state;
}

export async function updateSyncProgress(
  patch: Partial<SyncProgressState>
): Promise<HubStorageState> {
  const state = await loadState();
  state.syncProgress = { ...state.syncProgress, ...patch };
  await saveState(state);
  return state;
}

export async function applyParsedSiteResult(
  parsed: ParsedSiteResult
): Promise<HubStorageState> {
  const state = await loadState();
  const now = Date.now();
  const prev = state.benefits[parsed.benefitId] ?? createEmptyBenefit(parsed.benefitId);

  // 如果本次只是低置信度 fallback，保留用户手动校准值，也保留上一次已成功同步的有效数值（防止偶发超时把好数据冲掉）
  const keepManual = parsed.status === 'fallback' && Boolean(prev.manualOverride);
  const keepPreviousMetrics =
    parsed.status === 'fallback' &&
    !keepManual &&
    prev.source === 'auto' &&
    (prev.status === 'synced' || prev.status === 'fallback') &&
    Boolean(prev.metrics.primaryText);

  state.benefits[parsed.benefitId] = {
    ...prev,
    id: parsed.benefitId,
    status: parsed.status,
    source: keepManual
      ? 'manual'
      : parsed.status === 'synced' || keepPreviousMetrics
        ? 'auto'
        : 'default',
    updatedAt:
      keepManual || keepPreviousMetrics ? prev.updatedAt : parsed.status === 'fallback' ? null : now,
    metrics: keepManual || keepPreviousMetrics ? prev.metrics : parsed.metrics,
    message: parsed.message,
    debugInfo: parsed.debugInfo,
  };

  // 更新识别到的当前账号展示名（仅本地展示）
  if (parsed.accountLabel) {
    state.planDetection.detectedAccountLabel = parsed.accountLabel;
  }

  // 更新套餐自动识别状态：google_one 具有最高权威；其他站点（如 gemini）在尚未识别到时可作为辅助信号
  if (parsed.planHint) {
    const isAuthoritative = parsed.benefitId === 'google_one';
    const shouldUpdatePlan =
      isAuthoritative ||
      state.planDetection.detectedPlanId === null ||
      state.planDetection.detectedPlanId === 'free';

    if (shouldUpdatePlan) {
      state.planDetection = {
        ...state.planDetection,
        detectedPlanId: parsed.planHint.planId,
        detectedPlanRawName: parsed.planHint.rawName,
        detectedResetDay: parsed.planHint.resetDay ?? state.planDetection.detectedResetDay,
        detectedResetDateText:
          parsed.planHint.resetDateText ?? state.planDetection.detectedResetDateText,
        detectedAt: now,
      };
    }
  }

  await saveState(state);
  return state;
}

export async function saveManualCalibration(
  benefitId: BenefitId,
  metrics: BenefitMetrics | null
): Promise<HubStorageState> {
  const state = await loadState();
  const prev = state.benefits[benefitId] ?? createEmptyBenefit(benefitId);

  if (metrics === null) {
    // 清除手动校准，恢复为默认或自动同步值
    state.benefits[benefitId] = {
      ...prev,
      manualOverride: null,
      source: prev.status === 'synced' ? 'auto' : 'default',
    };
  } else {
    state.benefits[benefitId] = {
      ...prev,
      source: 'manual',
      updatedAt: Date.now(),
      manualOverride: metrics,
      metrics,
      message: undefined,
    };
  }

  await saveState(state);
  return state;
}

export async function clearAllCache(): Promise<HubStorageState> {
  const fresh = createInitialState();
  await saveState(fresh);
  return fresh;
}

/** 导出纯本地 JSON 备份（仅含通用用量数据与偏好设置，自动脱敏不含账号名/邮箱/凭据） */
export async function exportBackupJson(): Promise<string> {
  const state = await loadState();
  const sanitizedBenefits = { ...state.benefits };
  for (const key of Object.keys(sanitizedBenefits) as BenefitId[]) {
    sanitizedBenefits[key] = { ...sanitizedBenefits[key], debugInfo: undefined };
  }
  const payload = {
    app: 'Google AI Hub',
    exportedAt: new Date().toISOString(),
    data: {
      ...state,
      benefits: sanitizedBenefits,
      planDetection: {
        ...state.planDetection,
        detectedAccountLabel: undefined,
      },
      syncProgress: {
        ...state.syncProgress,
        running: false,
        mode: null,
        currentStep: 0,
        totalSteps: 0,
        currentTargetId: null,
        currentLabel: '',
      },
    },
  };
  return JSON.stringify(payload, null, 2);
}

/** 从 JSON 备份导入恢复 */
export async function importBackupJson(jsonText: string): Promise<HubStorageState> {
  const parsed = JSON.parse(jsonText) as { data?: unknown } | HubStorageState;
  const candidate =
    parsed && typeof parsed === 'object' && 'data' in parsed && parsed.data
      ? parsed.data
      : parsed;
  const normalized = normalizeState(candidate);
  normalized.syncProgress.running = false;
  await saveState(normalized);
  return normalized;
}
