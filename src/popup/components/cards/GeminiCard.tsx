import { Sparkles } from 'lucide-react';
import { CardShell } from './CardShell';
import { UsageBar } from './UsageBar';
import type { PlatformCardProps } from './types';

export function GeminiCard(props: PlatformCardProps) {
  const { planMeta, record } = props;
  const primaryText = record.metrics.primaryText || planMeta.defaultSummary;
  const secondaryText = record.metrics.secondaryText || planMeta.defaultSecondary;

  return (
    <CardShell
      {...props}
      icon={<Sparkles className="h-4 w-4 text-sky-600 dark:text-sky-400" />}
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
          label={record.source === 'manual' ? '手动记录用量占比' : '当前 5 小时窗口已用'}
          percent={record.metrics.percent}
        />
      )}

      {typeof record.metrics.secondaryPercent === 'number' && (
        <UsageBar label="每周限额已用" percent={record.metrics.secondaryPercent} />
      )}

      {record.metrics.resetInfo && (
        <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
          {record.metrics.resetInfo}
        </p>
      )}
    </CardShell>
  );
}
