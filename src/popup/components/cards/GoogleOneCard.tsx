import { Cloud } from 'lucide-react';
import { CardShell } from './CardShell';
import { UsageBar } from './UsageBar';
import type { PlatformCardProps } from './types';

export function GoogleOneCard(props: PlatformCardProps) {
  const { planMeta, record, daysUntilReset } = props;
  const primaryText = record.metrics.primaryText || planMeta.defaultSummary;
  const secondaryText = record.metrics.secondaryText || planMeta.defaultSecondary;

  return (
    <CardShell
      {...props}
      icon={<Cloud className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
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
        <UsageBar label="云盘空间占比" percent={record.metrics.percent} />
      )}

      {typeof record.metrics.secondaryPercent === 'number' && (
        <UsageBar
          label="本月 AI Credits 消耗"
          percent={record.metrics.secondaryPercent}
          monthlyReset
          daysUntilReset={daysUntilReset}
        />
      )}

      {record.metrics.resetInfo && (
        <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
          {record.metrics.resetInfo}
        </p>
      )}

      {typeof record.metrics.percent !== 'number' && record.source !== 'manual' && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          点击「刷新」从 Google One 存储页同步已用 GB 占比，或点击「校准」手动填入。
        </p>
      )}
    </CardShell>
  );
}
