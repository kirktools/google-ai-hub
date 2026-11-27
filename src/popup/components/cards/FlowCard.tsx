import { Film } from 'lucide-react';
import { CardShell } from './CardShell';
import { UsageBar } from './UsageBar';
import type { PlatformCardProps } from './types';

export function FlowCard(props: PlatformCardProps) {
  const { planMeta, record, daysUntilReset } = props;
  const primaryText = record.metrics.primaryText || planMeta.defaultSummary;
  const secondaryText = record.metrics.secondaryText || planMeta.defaultSecondary;

  return (
    <CardShell
      {...props}
      icon={<Film className="h-4 w-4 text-fuchsia-600 dark:text-fuchsia-400" />}
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
          label="本月创作点数消耗"
          percent={record.metrics.percent}
          monthlyReset
          daysUntilReset={daysUntilReset}
        />
      )}

      {record.status === 'fallback' && record.source !== 'manual' && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          {record.message || 'Flow 点数与 Google One AI Credits 共享，可点击直达 Flow 查看余量。'}
        </p>
      )}
    </CardShell>
  );
}
