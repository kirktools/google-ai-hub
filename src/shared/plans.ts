import type { BenefitId, PlanId, SyncableBenefitId } from './types';

export interface BenefitPlanMeta {
  /** 该套餐是否包含或推荐使用该项 */
  included: boolean;
  /** 套餐默认配额/权益说明 */
  defaultSummary: string;
  /** 补充提示 */
  defaultSecondary?: string;
  /** 是否属于按月重置、需要防浪费提醒的额度型权益 */
  monthlyReset?: boolean;
}

export interface EcosystemPerk {
  name: string;
  detail: string;
  included: boolean;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  shortName: string;
  badgeColor: string;
  tagline: string;
  monthlyPriceHint: string;
  benefits: Record<Exclude<BenefitId, 'ecosystem'>, BenefitPlanMeta>;
  ecosystemPerks: EcosystemPerk[];
}

export interface BenefitCatalogItem {
  id: BenefitId;
  title: string;
  subtitle: string;
  baseUrl: string;
  /** 拼接多账号参数的策略 */
  accountUrlStrategy: 'u_path' | 'authuser_query' | 'none';
  /** 是否支持自动后台标签页同步 */
  syncable: boolean;
  /** 是否在「一键同步」默认队列中 */
  inQuickSyncQueue: boolean;
  /** 队列顺序（越小越先同步，google_one 必须最先） */
  syncPriority: number;
  /** 官网按钮文案 */
  openLabel: string;
  /** 如需手动领取，提供官方直达领取链接 */
  claimUrl?: string;
  /** 领取按钮文案 */
  claimLabel?: string;
  /** 额外提示 */
  helperTip?: string;
}

export const BENEFIT_CATALOG: Record<BenefitId, BenefitCatalogItem> = {
  google_one: {
    id: 'google_one',
    title: 'Google One 云盘 & AI Credits',
    subtitle: '订阅套餐识别、云盘空间与月度 AI Credits 点数',
    baseUrl: 'https://one.google.com/storage',
    accountUrlStrategy: 'u_path',
    syncable: true,
    inQuickSyncQueue: true,
    syncPriority: 1,
    openLabel: '打开 Google One',
  },
  ai_studio: {
    id: 'ai_studio',
    title: 'Google AI Studio / Cloud 赠金',
    subtitle: 'Google Cloud 赠金余额与每月 Developer 抵用金',
    baseUrl: 'https://console.cloud.google.com/billing',
    accountUrlStrategy: 'authuser_query',
    syncable: true,
    inQuickSyncQueue: true,
    syncPriority: 2,
    openLabel: '打开结算页',
    claimUrl: 'https://me.developers.google.com/benefits',
    claimLabel: '直达 Google Builders Hub 领取',
  },
  flow: {
    id: 'flow',
    title: 'Google Flow',
    subtitle: 'Veo 视频/图片/音乐月度点数、每日赠送点数与 AI 点数',
    baseUrl:
      'https://one.google.com/ai/activity?utm_source=flow&utm_medium=web&utm_campaign=flow_ai_credits_page',
    accountUrlStrategy: 'u_path',
    syncable: true,
    inQuickSyncQueue: true,
    syncPriority: 3,
    openLabel: '查看点数明细',
  },
  colab: {
    id: 'colab',
    title: 'Google Colab',
    subtitle: '每月 GPU / TPU 计算单元（Compute Units）余量',
    baseUrl: 'https://colab.research.google.com/notebooks/empty.ipynb',
    accountUrlStrategy: 'authuser_query',
    syncable: true,
    inQuickSyncQueue: true,
    syncPriority: 4,
    openLabel: '打开 Colab',
  },
  gemini: {
    id: 'gemini',
    title: 'Gemini 网页版',
    subtitle: '旗舰模型对话、Deep Research 与 5 小时滚动用量限额',
    baseUrl: 'https://gemini.google.com/usage',
    accountUrlStrategy: 'authuser_query',
    syncable: true,
    inQuickSyncQueue: true,
    syncPriority: 5,
    openLabel: '打开用量页',
  },
  notebooklm: {
    id: 'notebooklm',
    title: 'NotebookLM',
    subtitle: '进阶笔记本上限、更多来源与音频播客概览',
    baseUrl: 'https://notebook.google.com/',
    accountUrlStrategy: 'authuser_query',
    syncable: true,
    inQuickSyncQueue: true,
    syncPriority: 6,
    openLabel: '打开 NotebookLM',
  },
  antigravity: {
    id: 'antigravity',
    title: 'Google Antigravity',
    subtitle: 'AI 编码代理额度（Gemini & Claude/GPT 5 小时 + 每周限额）',
    baseUrl: 'https://antigravity.google.com/remote?settingsOpen=true&settingsScreen=Models',
    accountUrlStrategy: 'none',
    syncable: true,
    inQuickSyncQueue: true,
    syncPriority: 7,
    openLabel: '打开用量页',
  },
  ecosystem: {
    id: 'ecosystem',
    title: '生态附加福利',
    subtitle: 'Workspace AI、YouTube Premium 与家庭组共享等权益',
    baseUrl: 'https://one.google.com/benefits',
    accountUrlStrategy: 'u_path',
    syncable: false,
    inQuickSyncQueue: false,
    syncPriority: 8,
    openLabel: '查看全部福利',
  },
};

export const DEFAULT_CARD_ORDER: BenefitId[] = [
  'antigravity',
  'gemini',
  'google_one',
  'ai_studio',
  'flow',
  'colab',
  'notebooklm',
  'ecosystem',
];

export const QUICK_SYNC_QUEUE: SyncableBenefitId[] = [
  'google_one',
  'gemini',
  'ai_studio',
  'flow',
  'colab',
  'notebooklm',
  'antigravity',
];

export const PLAN_DEFINITIONS: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    name: '免费版（Free）',
    shortName: 'Free',
    badgeColor: 'slate',
    tagline: '基础免费配额，适合轻度体验',
    monthlyPriceHint: '$0 / 月',
    benefits: {
      google_one: {
        included: true,
        defaultSummary: '15 GB 免费云盘空间',
        defaultSecondary: '不含月度 AI Credits',
        monthlyReset: false,
      },
      ai_studio: {
        included: true,
        defaultSummary: '免费层 API 速率限额',
        defaultSecondary: '无月度 Cloud 赠金',
        monthlyReset: false,
      },
      flow: {
        included: false,
        defaultSummary: '基础试用体验',
        defaultSecondary: '升级 AI 订阅可解锁月度点数',
        monthlyReset: false,
      },
      colab: {
        included: true,
        defaultSummary: '免费动态 GPU / CPU 配额',
        defaultSecondary: '不含月度固定 Compute Units',
        monthlyReset: false,
      },
      gemini: {
        included: true,
        defaultSummary: '标准模型对话 + 有限体验次数',
        defaultSecondary: '适合日常问答与轻度写作',
      },
      notebooklm: {
        included: true,
        defaultSummary: '标准版 NotebookLM',
        defaultSecondary: '基础笔记本与播客生成配额',
      },
      antigravity: {
        included: true,
        defaultSummary: '免费基础滚动额度',
        defaultSecondary: '5 小时滚动窗口刷新（桌面端）',
      },
    },
    ecosystemPerks: [
      { name: 'Gmail / Docs / Sheets 中的 Gemini', detail: '需升级 Plus / Pro / Ultra 解锁', included: false },
      { name: 'YouTube Premium 个人会员', detail: '仅部分 Ultra 档位包含', included: false },
      { name: '家庭组共享（最多 5 人）', detail: '免费版仅个人使用', included: false },
    ],
  },

  plus: {
    id: 'plus',
    name: 'Google AI Plus',
    shortName: 'AI Plus',
    badgeColor: 'sky',
    tagline: '高性价比入门 AI 订阅，含基础云盘与月度 AI 点数',
    monthlyPriceHint: '约 $7.99 / 月',
    benefits: {
      google_one: {
        included: true,
        defaultSummary: '200 GB 云盘空间',
        defaultSecondary: '含月度 AI Credits（约 200 点/月）',
        monthlyReset: true,
      },
      ai_studio: {
        included: true,
        defaultSummary: '开发者基础配额',
        defaultSecondary: '以 Google One / AI Studio 账单页为准',
        monthlyReset: false,
      },
      flow: {
        included: true,
        defaultSummary: '共享月度 AI Credits',
        defaultSecondary: '可用于 Flow 创意生成',
        monthlyReset: true,
      },
      colab: {
        included: true,
        defaultSummary: '免费层算力为主',
        defaultSecondary: '可按需单独购买 Compute Units',
        monthlyReset: false,
      },
      gemini: {
        included: true,
        defaultSummary: '更高额度的进阶模型与 Deep Research',
        defaultSecondary: '支持文档分析与多模态创作',
      },
      notebooklm: {
        included: true,
        defaultSummary: 'NotebookLM 进阶配额',
        defaultSecondary: '更高音频概览与笔记本来源上限',
      },
      antigravity: {
        included: true,
        defaultSummary: 'Plus 档位编码额度',
        defaultSecondary: '5 小时滚动窗口刷新（桌面端）',
      },
    },
    ecosystemPerks: [
      { name: 'Google Workspace 中的 Gemini', detail: 'Gmail、Docs、Sheets 等内置 AI 助手', included: true },
      { name: '家庭组共享（最多 5 人）', detail: '支持共享 200 GB 云盘空间', included: true },
      { name: 'YouTube Premium 个人会员', detail: '不包含（Ultra 档位专属）', included: false },
    ],
  },

  pro: {
    id: 'pro',
    name: 'Google AI Pro',
    shortName: 'AI Pro',
    badgeColor: 'indigo',
    tagline: '主力个人 AI 订阅：2 TB 云盘 + AI Credits + 月度赠金',
    monthlyPriceHint: '约 $19.99 / 月',
    benefits: {
      google_one: {
        included: true,
        defaultSummary: '2 TB 云盘空间',
        defaultSecondary: '月度 AI Credits（约 1,000 点/月）',
        monthlyReset: true,
      },
      ai_studio: {
        included: true,
        defaultSummary: '每月 $10 Cloud / AI Studio 赠金',
        defaultSecondary: '记得每月确认领取与使用状态',
        monthlyReset: true,
      },
      flow: {
        included: true,
        defaultSummary: '共享月度 1,000 AI Credits',
        defaultSecondary: '支持 Veo 视频与图片创作',
        monthlyReset: true,
      },
      colab: {
        included: true,
        defaultSummary: '每月含 Colab Pro 计算单元（约 200 单元）',
        defaultSecondary: '以 Colab 资源页显示余量为准',
        monthlyReset: true,
      },
      gemini: {
        included: true,
        defaultSummary: '旗舰 Pro 模型 + 高频 Deep Research',
        defaultSecondary: '支持 1M 上下文与深度分析',
      },
      notebooklm: {
        included: true,
        defaultSummary: 'NotebookLM Plus（5 倍配额）',
        defaultSecondary: '更多笔记本、来源与自定义播客',
      },
      antigravity: {
        included: true,
        defaultSummary: 'Pro 档位编码额度',
        defaultSecondary: '5 小时滚动窗口刷新（桌面端）',
      },
    },
    ecosystemPerks: [
      { name: 'Google Workspace 中的 Gemini', detail: 'Gmail、Docs、Slides、Meet 全套 AI 助手', included: true },
      { name: '家庭组共享（最多 5 人）', detail: '支持共享 2 TB 云盘与部分会员权益', included: true },
      { name: 'YouTube Premium 个人会员', detail: '不包含（Ultra 档位专属）', included: false },
    ],
  },

  ultra_5x: {
    id: 'ultra_5x',
    name: 'Google AI Ultra (5x)',
    shortName: 'Ultra 5x',
    badgeColor: 'violet',
    tagline: '高阶创作者与开发者档位：大额 AI Credits + 30 TB 云盘',
    monthlyPriceHint: 'Ultra 档位',
    benefits: {
      google_one: {
        included: true,
        defaultSummary: '30 TB 云盘空间',
        defaultSecondary: '高额月度 AI Credits（约 12,500+ 点/月）',
        monthlyReset: true,
      },
      ai_studio: {
        included: true,
        defaultSummary: '每月约 $40~$50 Cloud / AI Studio 赠金',
        defaultSecondary: '按月刷新，建议优先消耗',
        monthlyReset: true,
      },
      flow: {
        included: true,
        defaultSummary: '超高月度 Veo / Flow 创作点数',
        defaultSecondary: '支持更高分辨率与优先生成队列',
        monthlyReset: true,
      },
      colab: {
        included: true,
        defaultSummary: '高阶 Colab Pro+ 计算单元（约 500 单元/月）',
        defaultSecondary: '优先分配高显存 GPU',
        monthlyReset: true,
      },
      gemini: {
        included: true,
        defaultSummary: '最高优先级旗舰模型 + Deep Think / Research',
        defaultSecondary: '大幅提升每日调用上限',
      },
      notebooklm: {
        included: true,
        defaultSummary: 'NotebookLM Ultra 最高配额',
        defaultSecondary: '最高来源容量与无水印音频/演示',
      },
      antigravity: {
        included: true,
        defaultSummary: 'Ultra 5x 高频编码额度',
        defaultSecondary: '5 小时滚动窗口刷新，配额显著提升',
      },
    },
    ecosystemPerks: [
      { name: 'Google Workspace 中的 Gemini', detail: '全套 Workspace 最高档 AI 特性', included: true },
      { name: 'YouTube Premium 个人会员', detail: '已包含无广告与后台播放权益', included: true },
      { name: '家庭组共享（最多 5 人）', detail: '支持共享 30 TB 云盘存储空间', included: true },
    ],
  },

  ultra_20x: {
    id: 'ultra_20x',
    name: 'Google AI Ultra (20x)',
    shortName: 'Ultra 20x',
    badgeColor: 'amber',
    tagline: '旗舰顶配订阅：最高 20x 额度、海量创作点数与生态全享',
    monthlyPriceHint: 'Ultra 旗舰档位',
    benefits: {
      google_one: {
        included: true,
        defaultSummary: '30 TB 云盘空间',
        defaultSecondary: '顶配月度 AI Credits（约 25,000+ 点/月）',
        monthlyReset: true,
      },
      ai_studio: {
        included: true,
        defaultSummary: '每月最高 $100 Cloud / AI Studio 赠金',
        defaultSecondary: '按月刷新，避免月底过期浪费',
        monthlyReset: true,
      },
      flow: {
        included: true,
        defaultSummary: '旗舰月度 Veo / Flow 创作点数',
        defaultSecondary: '最高并发与优先渲染通道',
        monthlyReset: true,
      },
      colab: {
        included: true,
        defaultSummary: '旗舰 Colab 计算单元配额',
        defaultSecondary: '高优先级 GPU / TPU 资源访问',
        monthlyReset: true,
      },
      gemini: {
        included: true,
        defaultSummary: '顶配旗舰模型 + Deep Think 最高限额',
        defaultSecondary: '优先体验最新实验能力',
      },
      notebooklm: {
        included: true,
        defaultSummary: 'NotebookLM 顶配上限',
        defaultSecondary: '最高笔记本与音频概览额度',
      },
      antigravity: {
        included: true,
        defaultSummary: 'Ultra 20x 顶配编码额度',
        defaultSecondary: '5 小时滚动窗口刷新，极高并发余量',
      },
    },
    ecosystemPerks: [
      { name: 'Google Workspace 中的 Gemini', detail: '全套 Workspace 顶配 AI 特性', included: true },
      { name: 'YouTube Premium 个人会员', detail: '已包含个人会员权益', included: true },
      { name: '家庭组共享（最多 5 人）', detail: '支持共享 30 TB 云盘存储空间', included: true },
    ],
  },
};

export const PLAN_LIST: PlanDefinition[] = [
  PLAN_DEFINITIONS.free,
  PLAN_DEFINITIONS.plus,
  PLAN_DEFINITIONS.pro,
  PLAN_DEFINITIONS.ultra_5x,
  PLAN_DEFINITIONS.ultra_20x,
];
