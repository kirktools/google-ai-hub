import { useState } from 'react';
import { Code2, ExternalLink, HelpCircle } from 'lucide-react';
import { CardShell } from './CardShell';
import { UsageBar } from './UsageBar';
import type { PlatformCardProps } from './types';

export function AiStudioCard(props: PlatformCardProps) {
  const { catalog, plan, planMeta, record, daysUntilReset } = props;
  const [showGuide, setShowGuide] = useState(false);

  const primaryText = record.metrics.primaryText || planMeta.defaultSummary;
  const secondaryText = record.metrics.secondaryText || planMeta.defaultSecondary;
  const hasMonthlyCredit = plan.id !== 'free' && plan.id !== 'plus';

  const handleOpenClaimPage = () => {
    if (!catalog.claimUrl) return;
    void chrome.tabs.create({ url: catalog.claimUrl });
  };

  return (
    <CardShell
      {...props}
      icon={<Code2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
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
          label="赠金消耗占比"
          percent={record.metrics.percent}
          monthlyReset
          daysUntilReset={daysUntilReset}
        />
      )}

      {record.metrics.resetInfo && (
        <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
          {record.metrics.resetInfo}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => void chrome.tabs.create({ url: 'https://console.cloud.google.com/billing' })}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          查看 Cloud 赠金明细
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>

      {hasMonthlyCredit &&
        (record.status !== 'synced' ||
          record.metrics.primaryText?.startsWith('待领取')) &&
        record.source !== 'manual' && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 px-2.5 py-2 text-[11px] text-indigo-900 dark:border-indigo-900/70 dark:bg-indigo-950/40 dark:text-indigo-200">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">月度 Cloud / API 赠金需先手动激活领取</span>
            <button
              type="button"
              onClick={() => setShowGuide((v) => !v)}
              className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              <HelpCircle className="h-3 w-3" />
              {showGuide ? '收起指引' : '怎么领取'}
            </button>
          </div>

          {catalog.claimUrl && (
            <div className="mt-1.5">
              <button
                type="button"
                onClick={handleOpenClaimPage}
                className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white shadow-xs transition hover:bg-indigo-700"
              >
                {catalog.claimLabel || '直达 Google Builders Hub 领取'}
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          )}

          {showGuide && (
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] leading-relaxed opacity-90">
              <li>
                点击上方按钮前往 <code>me.developers.google.com/benefits</code>（Google Builders Hub，用订阅 Pro 的同一账号登录）。
              </li>
              <li>在「每月 $10 的生成式 AI 和 Cloud 赠金」卡片中，点击创建或选择你的 Google Cloud 结算账号并绑定。</li>
              <li>绑定完成后，即可在 AI Studio 或 Google Cloud 中自动抵扣 API 与云服务费用。</li>
            </ol>
          )}
        </div>
      )}
    </CardShell>
  );
}
