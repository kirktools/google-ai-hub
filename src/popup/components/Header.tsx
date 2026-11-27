import {
  ArrowLeft,
  CalendarClock,
  Moon,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
} from 'lucide-react';
import type { PlanDefinition } from '../../shared/plans';
import type { SyncProgressState, ThemeMode } from '../../shared/types';
import { formatCooldown, formatRelativeTime } from '../../shared/utils';

interface HeaderProps {
  plan: PlanDefinition;
  planSource: 'manual' | 'detected' | 'pending';
  daysUntilReset: number | null;
  resetDay: number | null;
  syncProgress: SyncProgressState;
  cooldownRemainingMs: number;
  theme: ThemeMode;
  view: 'dashboard' | 'settings';
  onToggleView: () => void;
  onCycleTheme: () => void;
  onSyncAll: () => void;
}

const PLAN_BADGE_STYLES: Record<string, string> = {
  slate:
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
  sky: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-800',
  indigo:
    'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800',
  violet:
    'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/70 dark:text-violet-300 dark:border-violet-800',
  amber:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800',
};

export function Header({
  plan,
  planSource,
  daysUntilReset,
  resetDay,
  syncProgress,
  cooldownRemainingMs,
  theme,
  view,
  onToggleView,
  onCycleTheme,
  onSyncAll,
}: HeaderProps) {
  const badgeStyle =
    planSource === 'pending'
      ? PLAN_BADGE_STYLES.slate
      : PLAN_BADGE_STYLES[plan.badgeColor] ?? PLAN_BADGE_STYLES.indigo;
  const inCooldown = !syncProgress.running && cooldownRemainingMs > 0;
  const progressPercent =
    syncProgress.running && syncProgress.totalSteps > 0
      ? Math.round((syncProgress.currentStep / syncProgress.totalSteps) * 100)
      : 0;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-4 pb-3 pt-3.5 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/90">
      {/* 顶部标题与操作栏 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                Google AI Hub
              </h1>
              <span
                title="纯本地运行，零外发请求"
                className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300"
              >
                <ShieldCheck className="h-2.5 w-2.5" />
                本地安全
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              最近刷新尝试：{formatRelativeTime(syncProgress.lastSyncedAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCycleTheme}
            title={`切换主题（当前：${theme === 'system' ? '跟随系统' : theme === 'dark' ? '深色' : '浅色'}）`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onToggleView}
            title={view === 'settings' ? '返回看板' : '设置与备份'}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            {view === 'settings' ? (
              <ArrowLeft className="h-4 w-4" />
            ) : (
              <Settings className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* 看板模式下展示套餐总览与一键同步按钮 */}
      {view === 'dashboard' && (
        <div className="mt-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-semibold ${badgeStyle}`}
              >
                {planSource === 'pending' ? '待同步识别套餐' : plan.name}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                {planSource === 'manual'
                  ? '手动兜底'
                  : planSource === 'detected'
                    ? '自动识别'
                    : '点击右侧同步'}
              </span>
              {daysUntilReset !== null && resetDay !== null && (
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <CalendarClock className="h-3 w-3 text-indigo-500" />
                  {daysUntilReset === 0 ? '今日重置' : `${daysUntilReset} 天后重置`}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onSyncAll}
              disabled={syncProgress.running || inCooldown}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                syncProgress.running
                  ? 'cursor-wait bg-indigo-500/80 text-white'
                  : inCooldown
                    ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                    : 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 active:scale-[0.98]'
              }`}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${syncProgress.running ? 'animate-spin' : ''}`}
              />
              {syncProgress.running
                ? `同步中 ${syncProgress.currentStep}/${syncProgress.totalSteps}`
                : inCooldown
                  ? `冷却 ${formatCooldown(cooldownRemainingMs)}`
                  : '一键同步'}
            </button>
          </div>

          {syncProgress.running && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-indigo-600 dark:text-indigo-400">
                <span className="truncate">{syncProgress.currentLabel || '正在静默同步…'}</span>
                <span className="shrink-0 font-medium">{progressPercent}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-950">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all duration-300 dark:bg-indigo-400"
                  style={{ width: `${Math.max(10, progressPercent)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
