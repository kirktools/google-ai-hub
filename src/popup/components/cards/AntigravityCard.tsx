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

function parseClaudeBarsFallback(
  secondaryText?: string
): Array<{ label: string; percent: number }> {
  if (!secondaryText || !/Claude/i.test(secondaryText)) return [];
  const bars: Array<{ label: string; percent: number }> = [];
  const fiveHour = secondaryText.match(/5h\s*剩\s*(\d{1,3})\s*%/i);
  if (fiveHour) {
    bars.push({
      label: 'Claude / GPT 5 小时窗口已用',
      percent: Math.min(100, Math.max(0, 100 - Number(fiveHour[1]))),
    });
  }
  const weekly = secondaryText.match(/每周剩\s*(\d{1,3})\s*%/i);
  if (weekly) {
    bars.push({
      label: 'Claude / GPT 每周限额已用',
      percent: Math.min(100, Math.max(0, 100 - Number(weekly[1]))),
    });
  }
  return bars;
}

export function AntigravityCard(props: PlatformCardProps) {
  const { planMeta, record } = props;
  const primaryText = record.metrics.primaryText || planMeta.defaultSummary;
  const secondaryText = record.metrics.secondaryText || planMeta.defaultSecondary;
  const extraBars =
    record.metrics.extraBars && record.metrics.extraBars.length > 0
      ? record.metrics.extraBars
      : parseClaudeBarsFallback(record.metrics.secondaryText);
  const hasGeminiBars =
    typeof record.metrics.percent === 'number' ||
    typeof record.metrics.secondaryPercent === 'number';

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

      {hasGeminiBars && (
        <div className="space-y-2">
          {typeof record.metrics.percent === 'number' && (
            <UsageBar label="Gemini 5 小时窗口已用" percent={record.metrics.percent} />
          )}
          {typeof record.metrics.secondaryPercent === 'number' && (
            <UsageBar label="Gemini 每周限额已用" percent={record.metrics.secondaryPercent} />
          )}
        </div>
      )}

      {extraBars.length > 0 && (
        <div
          className={`space-y-2 ${hasGeminiBars ? 'border-t border-slate-100 pt-2 dark:border-slate-800/80' : ''}`}
        >
          {extraBars.map((bar) => (
            <UsageBar key={bar.label} label={bar.label} percent={bar.percent} />
          ))}
        </div>
      )}

      {record.metrics.resetInfo && (
        <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
          {formatAntigravityReset(record.metrics.resetInfo)}
        </p>
      )}
    </CardShell>
  );
}
