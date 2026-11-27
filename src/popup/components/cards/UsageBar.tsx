interface UsageBarProps {
  label: string;
  /** 已用百分比（0-100） */
  percent: number;
  /** 是否属于按月重置、需要防浪费提醒的额度 */
  monthlyReset?: boolean;
  daysUntilReset?: number | null;
}

export function UsageBar({
  label,
  percent,
  monthlyReset = false,
  daysUntilReset = null,
}: UsageBarProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  const remaining = 100 - clamped;

  const isNearLimit = clamped >= 85;
  const isWasteRisk =
    monthlyReset &&
    daysUntilReset !== null &&
    daysUntilReset <= 7 &&
    clamped <= 20;

  const barClass = isNearLimit
    ? 'from-rose-500 to-orange-500'
    : isWasteRisk
      ? 'from-amber-400 to-amber-500'
      : 'from-blue-500 to-indigo-500';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-500 dark:text-slate-400">{label}</span>
        <div className="flex items-center gap-1.5">
          {isNearLimit && (
            <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:bg-rose-950/70 dark:text-rose-300">
              即将用完
            </span>
          )}
          {isWasteRisk && (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/70 dark:text-amber-300">
              余量多 · 防浪费
            </span>
          )}
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            已用 {clamped}% · 剩 {remaining}%
          </span>
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-all duration-300 ${barClass}`}
          style={{ width: `${Math.max(clamped > 0 ? 4 : 0, clamped)}%` }}
        />
      </div>
    </div>
  );
}
