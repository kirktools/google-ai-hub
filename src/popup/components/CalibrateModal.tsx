import { useState } from 'react';
import { Clock, RotateCcw, X } from 'lucide-react';
import type { BenefitCatalogItem } from '../../shared/plans';
import type { BenefitMetrics, BenefitRecord } from '../../shared/types';

interface CalibrateModalProps {
  catalog: BenefitCatalogItem;
  record: BenefitRecord;
  onSave: (metrics: BenefitMetrics) => void;
  onClearManual: () => void;
  onClose: () => void;
}

export function CalibrateModal({
  catalog,
  record,
  onSave,
  onClearManual,
  onClose,
}: CalibrateModalProps) {
  const [primaryText, setPrimaryText] = useState(record.metrics.primaryText ?? '');
  const [secondaryText, setSecondaryText] = useState(record.metrics.secondaryText ?? '');
  const [percentStr, setPercentStr] = useState(
    record.metrics.percent !== undefined ? String(record.metrics.percent) : ''
  );
  const [note, setNote] = useState(record.metrics.note ?? '');

  const isAntigravity = catalog.id === 'antigravity';

  const handleQuick5hReset = () => {
    const target = new Date(Date.now() + 5 * 60 * 60 * 1000);
    const hh = String(target.getHours()).padStart(2, '0');
    const mm = String(target.getMinutes()).padStart(2, '0');
    setSecondaryText(`5 小时滚动窗口 · 预计 ${hh}:${mm} 前逐步恢复`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPrimary = primaryText.trim();
    const trimmedSecondary = secondaryText.trim();
    const trimmedNote = note.trim();
    const parsedPercent =
      percentStr.trim() !== '' && Number.isFinite(Number(percentStr))
        ? Math.min(100, Math.max(0, Math.round(Number(percentStr))))
        : undefined;

    onSave({
      ...record.metrics,
      primaryText: trimmedPrimary || undefined,
      secondaryText: trimmedSecondary || undefined,
      percent: parsedPercent,
      note: trimmedNote || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-[360px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              手动校准：{catalog.title}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              页面改版或桌面端额度可在此手动记录，保存在本地
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              主要余额 / 状态
            </label>
            <input
              type="text"
              value={primaryText}
              onChange={(e) => setPrimaryText(e.target.value)}
              placeholder={
                isAntigravity
                  ? '例如：当前额度充裕 / 已用约 60%'
                  : '例如：剩余 850 / 1,000 点 或 $10.00'
              }
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                补充说明
              </label>
              {isAntigravity && (
                <button
                  type="button"
                  onClick={handleQuick5hReset}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                >
                  <Clock className="h-3 w-3" />
                  标记 +5h 恢复
                </button>
              )}
            </div>
            <input
              type="text"
              value={secondaryText}
              onChange={(e) => setSecondaryText(e.target.value)}
              placeholder="例如：AI Credits 每月 15 日重置"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                已用进度 %
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={percentStr}
                onChange={(e) => setPercentStr(e.target.value)}
                placeholder="选填"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                个人备注
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="选填（如已领取本月赠金）"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {record.manualOverride ? (
              <button
                type="button"
                onClick={onClearManual}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                恢复自动
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                取消
              </button>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700"
              >
                保存校准
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
