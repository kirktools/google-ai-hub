import { ExternalLink, Film } from 'lucide-react';
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
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {secondaryText}
          </p>
        )}
      </div>

      {typeof record.metrics.percent === 'number' && (
        <UsageBar
          label="月度 Flow 点数消耗"
          percent={record.metrics.percent}
          monthlyReset
          daysUntilReset={daysUntilReset}
        />
      )}

      {typeof record.metrics.secondaryPercent === 'number' && (
        <UsageBar
          label="今日赠送点数消耗（每日重置）"
          percent={record.metrics.secondaryPercent}
        />
      )}

      {record.metrics.resetInfo && (
        <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
          {record.metrics.resetInfo}
        </p>
      )}

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => void chrome.tabs.create({ url: 'https://flow.google.com/' })}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          打开 Flow 创作
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>

      {record.status === 'fallback' && record.source !== 'manual' && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          {record.message || '点击「直达」可查看 Google Flow 活动记录与详细点数。'}
        </p>
      )}
    </CardShell>
  );
}
