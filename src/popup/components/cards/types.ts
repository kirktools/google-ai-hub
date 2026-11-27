import type { BenefitCatalogItem, BenefitPlanMeta, PlanDefinition } from '../../../shared/plans';
import type { BenefitRecord } from '../../../shared/types';

export interface PlatformCardProps {
  catalog: BenefitCatalogItem;
  plan: PlanDefinition;
  planMeta: BenefitPlanMeta;
  record: BenefitRecord;
  daysUntilReset: number | null;
  collapsed: boolean;
  isSyncingThis: boolean;
  isGlobalSyncing: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggleCollapse: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onOpenSite: () => void;
  onRefreshSingle?: () => void;
  onCalibrate: () => void;
}
