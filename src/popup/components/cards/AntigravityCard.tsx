import { Terminal } from 'lucide-react';
import { CardShell } from './CardShell';
import { UsageBar } from './UsageBar';
import type { PlatformCardProps } from './types';

function formatAntigravityReset(raw: string): string {
  return raw
    .replace(/5h\s*窗口\s*/g, '5h 重置：')
    .replace(/每周限额\s*/g, '每周重置：')
    .replace(/\s*后恢复/g, '后')
    .replace(/\b(\d+)\s*days?\b/gi, '$1 天')
    .replace(/\b(\d+)\s*hours?\b/gi, '$1 小时')
    .replace(/\b(\d+)\s*minutes?\b/gi, '$1 分')
    .replace(/\b(\d+)\s*seconds?\b/gi, '$1 秒')
    .replace(/\s*,\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function AntigravityCard(props: PlatformCardProps) {
  const { planMeta, record } = props;
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
        <UsageBar label="Gemini 5 小时窗口已用" percent={record.metrics.percent} />
      )}

      {typeof record.metrics.secondaryPercent === 'number' && (
        <UsageBar label="Gemini 每周限额已用" percent={record.metrics.secondaryPercent} />
      )}

      {record.metrics.resetInfo && (
        <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
          {formatAntigravityReset(record.metrics.resetInfo)}
        </p>
      )}
    </CardShell>
  );
}
