import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Gift,
  MinusCircle,
} from 'lucide-react';
import type { EcosystemPerk } from '../../shared/plans';

interface EcosystemCardProps {
  perks: EcosystemPerk[];
  collapsed: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggleCollapse: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onOpenBenefits: () => void;
}

export function EcosystemCard({
  perks,
  collapsed,
  canMoveUp,
  canMoveDown,
  onToggleCollapse,
  onMoveUp,
  onMoveDown,
  onOpenBenefits,
}: EcosystemCardProps) {
  const includedCount = perks.filter((p) => p.included).length;

  return (
    <article className="group rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
            <Gift className="h-4 w-4 text-rose-500 dark:text-rose-400" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                生态附加福利
              </h2>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                已含 {includedCount}/{perks.length}
              </span>
            </div>
            {collapsed && (
              <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                Workspace AI、YouTube Premium、家庭组共享等
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
          <ul className="space-y-1.5">
            {perks.map((perk) => (
              <li
                key={perk.name}
                className="flex items-start gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800/60"
              >
                {perk.included ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                ) : (
                  <MinusCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                )}
                <div className="min-w-0">
                  <p
                    className={`text-xs font-medium ${
                      perk.included
                        ? 'text-slate-800 dark:text-slate-100'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {perk.name}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{perk.detail}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onOpenBenefits}
              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-indigo-950 dark:hover:text-indigo-300"
            >
              前往 Google One 福利页
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
