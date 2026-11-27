import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Pencil,
  RefreshCw,
} from 'lucide-react';
import type { BenefitCatalogItem } from '../../../shared/plans';
import type { BenefitRecord } from '../../../shared/types';
import { formatRelativeTime } from '../../../shared/utils';

interface CardShellProps {
  icon: ReactNode;
  catalog: BenefitCatalogItem;
  record: BenefitRecord;
  collapsedSummary: string;
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
  children: ReactNode;
}

export function CardShell({
  icon,
  catalog,
  record,
  collapsedSummary,
  collapsed,
  isSyncingThis,
  isGlobalSyncing,
  canMoveUp,
  canMoveDown,
  onToggleCollapse,
  onMoveUp,
  onMoveDown,
  onOpenSite,
  onRefreshSingle,
  onCalibrate,
  children,
}: CardShellProps) {
  const isUnauth = record.status === 'unauthenticated';

  const sourceBadge = isUnauth
    ? {
        text: '未登录',
        cls: 'bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300',
      }
    : record.source === 'manual'
      ? {
          text: '手动校准',
          cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300',
        }
      : record.source === 'auto' && record.status === 'synced'
        ? {
            text: '已同步',
            cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300',
          }
        : {
            text: '套餐参考',
            cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
          };

  return (
    <article className="group rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm transition hover:border-indigo-200 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-900">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                {catalog.title}
              </h2>
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${sourceBadge.cls}`}
              >
                {sourceBadge.text}
              </span>
            </div>
            {collapsed && (
              <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                {collapsedSummary}
              </p>
            )}
          </div>
          <span className="shrink-0 text-slate-400">
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
        </button>

        <div className="flex shrink-0 items-center opacity-50 transition group-hover:opacity-100">
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={onMoveUp}
            title="上移卡片"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <ArrowUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            disabled={!canMoveDown}
            onClick={onMoveDown}
            title="下移卡片"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <ArrowDown className="h-3 w-3" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="mt-2.5 space-y-2 border-t border-slate-100 pt-2.5 dark:border-slate-800/80">
          {isUnauth ? (
            <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-2.5 py-2 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{record.message || '请先在 Chrome 登录 Google 账号'}</span>
            </div>
          ) : (
            <>
              {children}
              {record.metrics.note && (
                <p className="rounded-md bg-slate-50 px-2 py-1 text-[11px] text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                  备注：{record.metrics.note}
                </p>
              )}
            </>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              更新：{formatRelativeTime(record.updatedAt)}
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onCalibrate}
                title="手动校准 / 记录用量"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <Pencil className="h-3 w-3" />
                校准
              </button>

              {catalog.syncable && onRefreshSingle && (
                <button
                  type="button"
                  onClick={onRefreshSingle}
                  disabled={isGlobalSyncing}
                  title="单独静默刷新此平台"
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-600 transition hover:bg-slate-100 hover:text-indigo-600 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
                >
                  <RefreshCw className={`h-3 w-3 ${isSyncingThis ? 'animate-spin' : ''}`} />
                  刷新
                </button>
              )}

              <button
                type="button"
                onClick={onOpenSite}
                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-indigo-950 dark:hover:text-indigo-300"
              >
                直达
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
