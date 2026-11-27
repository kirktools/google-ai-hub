import { Cpu } from 'lucide-react';
import { CardShell } from './CardShell';
import { UsageBar } from './UsageBar';
import type { PlatformCardProps } from './types';

export function ColabCard(props: PlatformCardProps) {
  const { planMeta, record, daysUntilReset } = props;
  const primaryText = record.metrics.primaryText || planMeta.defaultSummary;
  const secondaryText = record.metrics.secondaryText || planMeta.defaultSecondary;

  return (
    <CardShell
      {...props}
      icon={<Cpu className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
      collapsedSummary={primaryText}
    >
      <div>
        <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100">
          {primaryText}
        </p>
        {secondaryText && (
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {secondaryText}
          </p>
        )}
      </div>

      {typeof record.metrics.percent === 'number' && (
        <UsageBar
          label="计算单元消耗占比"
          percent={record.metrics.percent}
          monthlyReset={planMeta.monthlyReset}
          daysUntilReset={daysUntilReset}
        />
      )}

      {record.status === 'fallback' && record.source !== 'manual' && (
        <p className="rounded-md bg-amber-50/70 px-2 py-1 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          查看指引：点击「直达」打开 Colab，点右上角「RAM / 磁盘 → 查看资源」可查看精确计算单元，打开后会自动顺路同步。
        </p>
      )}
    </CardShell>
  );
}
