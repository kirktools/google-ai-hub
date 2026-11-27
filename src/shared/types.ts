export type PlanId = 'free' | 'plus' | 'pro' | 'ultra_5x' | 'ultra_20x';

export type BenefitId =
  | 'google_one'
  | 'ai_studio'
  | 'flow'
  | 'colab'
  | 'gemini'
  | 'notebooklm'
  | 'antigravity'
  | 'ecosystem';

export type SyncableBenefitId =
  | 'google_one'
  | 'ai_studio'
  | 'flow'
  | 'colab'
  | 'gemini'
  | 'notebooklm'
  | 'antigravity';

export type DataSource = 'auto' | 'manual' | 'default';

export type SyncItemStatus =
  | 'idle'
  | 'synced'
  | 'unauthenticated'
  | 'fallback'
  | 'error';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface BenefitMetrics {
  /** 主展示文案（如 "已用 412 GB / 2 TB" 或 "剩余 850 / 1,000 点"） */
  primaryText?: string;
  /** 副展示文案（如 "AI Credits：剩余 1,200 点" 或 "未领取本月赠金"） */
  secondaryText?: string;
  /** 可选进度百分比（0-100，表示已用占比） */
  percent?: number;
  /** 第二维度已用百分比（例如 Google One 同时有云盘占比 + AI Credits 占比） */
  secondaryPercent?: number;
  /** 数值型已用量 */
  usedValue?: number;
  /** 数值型剩余量（用于防浪费提醒判断） */
  remainingValue?: number;
  /** 数值型总量 */
  totalValue?: number;
  /** 单位（如 "点"、"GB"、"USD"、"单元"） */
  unit?: string;
  /** 下次重置/刷新日期 ISO 字符串或简短描述 */
  resetInfo?: string;
  /** 自定义备注（常用于手动校准或 Antigravity 5小时滚动刷新记录） */
  note?: string;
}

export interface BenefitRecord {
  id: BenefitId;
  status: SyncItemStatus;
  source: DataSource;
  updatedAt: number | null;
  metrics: BenefitMetrics;
  /** 检测到未登录或其他提示信息 */
  message?: string;
  /** 仅用于本地排查的脱敏诊断摘要（只含站点域名与错误类别，绝不存页面正文或账号 ID） */
  debugInfo?: {
    host: string;
    reason: string;
  };
  /** 当用户手动校准过，保留手动数据不被低置信度 fallback 覆盖 */
  manualOverride?: BenefitMetrics | null;
}

export interface PlanDetectionState {
  /** 自动从 Google One / Gemini 识别出的套餐 */
  detectedPlanId: PlanId | null;
  /** 识别到的原始套餐名称（如 "Google AI Pro (2 TB)"） */
  detectedPlanRawName?: string;
  /** 识别到的当前登录 Google 账号展示名（仅存本地，导出 JSON 时自动脱敏移除） */
  detectedAccountLabel?: string;
  /** 识别到的每月重置/续费日（1-31） */
  detectedResetDay: number | null;
  /** 识别到的下次重置日期文本 */
  detectedResetDateText?: string;
  /** 最近一次识别时间 */
  detectedAt: number | null;
}

export interface SyncProgressState {
  running: boolean;
  mode: 'all' | 'single' | null;
  currentStep: number;
  totalSteps: number;
  currentTargetId: SyncableBenefitId | null;
  currentLabel: string;
  lastSyncedAt: number | null;
  lastCooldownUntil: number | null;
  lastError?: string;
}

export interface UserSettings {
  /** 手动覆盖套餐（null 表示跟随自动识别） */
  manualPlanOverride: PlanId | null;
  /** 手动覆盖账单/额度重置日（1-31，null 表示跟随自动识别） */
  manualResetDay: number | null;
  /** 主题模式 */
  theme: ThemeMode;
  /** 卡片展示顺序 */
  cardOrder: BenefitId[];
  /** 已折叠的卡片集合 */
  collapsedCards: BenefitId[];
  /** 是否开启月度防浪费提醒（距重置日 <= 5 天） */
  wasteAlertEnabled: boolean;
  /** 低频定时自动同步间隔（分钟）：0 表示关闭，最低 60 分钟（1 小时） */
  autoSyncIntervalMinutes: number;
}

export interface HubStorageState {
  version: number;
  settings: UserSettings;
  planDetection: PlanDetectionState;
  syncProgress: SyncProgressState;
  benefits: Record<BenefitId, BenefitRecord>;
}

/** 站点解析器输出结构 */
export interface ParsedSiteResult {
  benefitId: SyncableBenefitId;
  status: 'synced' | 'unauthenticated' | 'fallback';
  metrics: BenefitMetrics;
  message?: string;
  /** 从 Google 账号头像/侧边栏提取的当前登录账号名称（仅本地展示，不外发、不导出） */
  accountLabel?: string;
  /** 脱敏后的站点域名与状态类别（绝不含页面正文、用户名或账单 ID） */
  debugInfo?: {
    host: string;
    reason: string;
  };
  /** 如果需要进一步跳转到二级真实数据页（例如 Cloud /billing -> /billing/<ID>/credits/all） */
  redirectUrl?: string;
  /** 返回套餐识别信息（google_one 权威，gemini 可辅助识别） */
  planHint?: {
    planId: PlanId;
    rawName: string;
    resetDay?: number | null;
    resetDateText?: string;
  };
}

/** Extension 内部消息协议 */
export type RuntimeMessage =
  | { type: 'SYNC_ALL'; force?: boolean }
  | { type: 'SYNC_SINGLE'; benefitId: SyncableBenefitId }
  | { type: 'PASSIVE_PARSE_RESULT'; payload: ParsedSiteResult }
  | { type: 'EXTRACT_PAGE_DATA'; benefitId: SyncableBenefitId };

export interface RuntimeResponse {
  ok: boolean;
  error?: string;
  cooldownRemainingMs?: number;
  data?: ParsedSiteResult;
}
