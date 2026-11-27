import { Terminal } from 'lucide-react';
import { CardShell } from './CardShell';
import { UsageBar } from './UsageBar';
import type { PlatformCardProps } from './types';

export function AntigravityCard(props: PlatformCardProps) {
  const { catalog, planMeta, record } = props;
  const primaryText = record.metrics.primaryText || planMeta.defaultSummary;
  const secondaryText = record.metrics.secondaryText || planMeta.defaultSecondary;

  return (
    <CardShell
      {...props}
      icon={<Terminal className="h-4 w-4 text-violet-600 dark:text-violet-400" />}
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
        <UsageBar label="当前 5 小时窗口已用" percent={record.metrics.percent} />
      )}

      {catalog.helperTip && !record.metrics.note && (
        <p className="rounded-md bg-violet-50/70 px-2 py-1 text-[11px] text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
          {catalog.helperTip}
        </p>
      )}
    </CardShell>
  );
}
