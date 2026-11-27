import { useRef, useState } from 'react';
import {
  ArrowUpCircle,
  Bug,
  Download,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { DEFAULT_CARD_ORDER, PLAN_LIST } from '../../shared/plans';
import {
  clearAllCache,
  exportBackupJson,
  importBackupJson,
} from '../../shared/storage';
import {
  checkForUpdate,
  getCurrentExtensionVersion,
  RELEASES_PAGE_URL,
  type UpdateCheckResult,
} from '../../shared/updateCheck';
import type {
  HubStorageState,
  PlanId,
  ProgressBarMode,
  ThemeMode,
  UserSettings,
} from '../../shared/types';

interface SettingsViewProps {
  state: HubStorageState;
  updateInfo: UpdateCheckResult | null;
  onUpdateInfoChange: (next: UpdateCheckResult | null) => void;
  onUpdateSettings: (patch: Partial<UserSettings>) => Promise<void>;
  onStateReplaced: (next: HubStorageState) => void;
}

export function SettingsView({
  state,
  updateInfo,
  onUpdateInfoChange,
  onUpdateSettings,
  onStateReplaced,
}: SettingsViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const currentVersion = getCurrentExtensionVersion();

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const res = await checkForUpdate(true);
      onUpdateInfoChange(res);
      if (res?.hasUpdate) {
        showNotice('ok', `发现新版本 v${res.latestVersion}，可点击下方按钮下载覆盖更新`);
      } else {
        showNotice('ok', `当前已是最新版本 v${currentVersion}`);
      }
    } catch {
      showNotice('err', '检查更新失败：无法连接 GitHub Releases，请检查网络后重试');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const showNotice = (type: 'ok' | 'err', text: string) => {
    setNotice({ type, text });
    window.setTimeout(() => setNotice(null), 3500);
  };

  const handleExport = async () => {
    try {
      const json = await exportBackupJson();
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const today = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `google-ai-hub-backup-${today}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showNotice('ok', '已导出本地 JSON 备份（不含凭据与账号信息；含你手动填写的个人备注）');
    } catch {
      showNotice('err', '导出备份失败');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const next = await importBackupJson(text);
      onStateReplaced(next);
      showNotice('ok', '备份已导入并恢复');
    } catch {
      showNotice('err', '导入失败：请确认选择的是合法的 Google AI Hub JSON 备份文件');
    } finally {
      e.target.value = '';
    }
  };

  const handleClearCache = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    const fresh = await clearAllCache();
    onStateReplaced(fresh);
    setConfirmClear(false);
    showNotice('ok', '已清空全部本地缓存并重置设置');
  };

  const handleCopyDiagnostics = async () => {
    try {
      const report = Object.values(state.benefits)
        .filter((b) => b.debugInfo)
        .map((b) => ({
          id: b.id,
          status: b.status,
          host: b.debugInfo?.host,
          reason: b.debugInfo?.reason,
        }));
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      showNotice('ok', '已复制安全诊断状态（仅含站点域名与状态码，不含页面文本或个人信息）');
    } catch {
      showNotice('err', '复制诊断信息失败');
    }
  };

  return (
    <div className="space-y-3 p-4">
      {notice && (
        <div
          className={`rounded-xl px-3 py-2 text-xs font-medium ${
            notice.type === 'ok'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* 当前已识别账号（只读展示） */}
      {state.planDetection.detectedAccountLabel && (
        <section className="rounded-xl border border-slate-200/90 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            当前已登录 Google 账号
          </h2>
          <p className="mt-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
            {state.planDetection.detectedAccountLabel}
          </p>
        </section>
      )}

      {/* 低频定时自动同步 */}
      <section className="rounded-xl border border-slate-200/90 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              定时后台自动同步
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              低频自动刷新缓存（最低 1 小时，打开面板即可秒看数据）
            </p>
          </div>
          <select
            value={state.settings.autoSyncIntervalMinutes}
            onChange={(e) =>
              void onUpdateSettings({ autoSyncIntervalMinutes: Number(e.target.value) })
            }
            className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value={0}>关闭（仅手动）</option>
            <option value={60}>每 1 小时（推荐）</option>
            <option value={120}>每 2 小时</option>
            <option value={240}>每 4 小时</option>
            <option value={360}>每 6 小时</option>
            <option value={720}>每 12 小时</option>
          </select>
        </div>
      </section>

      {/* 套餐与重置日兜底 */}
      <section className="space-y-3 rounded-xl border border-slate-200/90 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            订阅套餐手动兜底
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            默认从 Google One 自动识别（当前识别结果：
            {state.planDetection.detectedPlanRawName || '尚未识别'}）。若识别不准可手动指定：
          </p>
          <select
            value={state.settings.manualPlanOverride ?? 'auto'}
            onChange={(e) => {
              const val = e.target.value;
              void onUpdateSettings({
                manualPlanOverride: val === 'auto' ? null : (val as PlanId),
              });
            }}
            className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="auto">跟随自动识别（推荐）</option>
            {PLAN_LIST.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.monthlyPriceHint}
              </option>
            ))}
          </select>
        </div>

        <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              每月额度重置日（兜底）
            </label>
            <select
              value={state.settings.manualResetDay ?? 'auto'}
              onChange={(e) => {
                const val = e.target.value;
                void onUpdateSettings({
                  manualResetDay: val === 'auto' ? null : Number(val),
                });
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="auto">自动识别</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  每月 {d} 日
                </option>
              ))}
            </select>
          </div>

          <label className="mt-2.5 flex cursor-pointer items-center justify-between text-xs text-slate-700 dark:text-slate-300">
            <span>开启月度防浪费提醒（距重置 ≤ 5 天）</span>
            <input
              type="checkbox"
              checked={state.settings.wasteAlertEnabled}
              onChange={(e) =>
                void onUpdateSettings({ wasteAlertEnabled: e.target.checked })
              }
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </label>
        </div>
      </section>

      {/* 外观与卡片顺序 */}
      <section className="space-y-2.5 rounded-xl border border-slate-200/90 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            外观主题
          </span>
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
            {(
              [
                ['system', '跟随系统'],
                ['light', '浅色'],
                ['dark', '深色'],
              ] as [ThemeMode, string][]
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => void onUpdateSettings({ theme: mode })}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  state.settings.theme === mode
                    ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-700 dark:text-indigo-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            进度条展示
          </span>
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
            {(
              [
                ['remaining', '按剩余量'],
                ['used', '按使用量'],
              ] as [ProgressBarMode, string][]
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => void onUpdateSettings({ progressBarMode: mode })}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  state.settings.progressBarMode === mode
                    ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-700 dark:text-indigo-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
          <span className="text-xs text-slate-600 dark:text-slate-400">卡片顺序与折叠状态</span>
          <button
            type="button"
            onClick={() => {
              void onUpdateSettings({
                cardOrder: [...DEFAULT_CARD_ORDER],
                collapsedCards: ['ecosystem'],
              });
              showNotice('ok', '已恢复默认卡片顺序');
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RotateCcw className="h-3 w-3" />
            恢复默认
          </button>
        </div>
      </section>

      {/* 数据备份与清理 */}
      <section className="space-y-2.5 rounded-xl border border-slate-200/90 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
          本地数据备份与清理
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void handleExport()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            导出 JSON
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Upload className="h-3.5 w-3.5" />
            导入 JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => void handleImportFile(e)}
            className="hidden"
          />
        </div>

        <button
          type="button"
          onClick={() => void handleCopyDiagnostics()}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <Bug className="h-3.5 w-3.5" />
          复制脱敏同步诊断摘要（排查未抓到数值）
        </button>

        <button
          type="button"
          onClick={() => void handleClearCache()}
          className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
            confirmClear
              ? 'bg-rose-600 text-white hover:bg-rose-700'
              : 'border border-rose-200 bg-rose-50/60 text-rose-700 hover:bg-rose-100/70 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300'
          }`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {confirmClear ? '再次点击确认：清空全部本地缓存' : '一键清空全部本地缓存'}
        </button>
      </section>

      {/* 版本与检查更新 */}
      <section className="space-y-2.5 rounded-xl border border-slate-200/90 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              版本与更新
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              当前版本 v{currentVersion}
              {updateInfo?.hasUpdate ? (
                <span className="ml-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                  · 有新版 v{updateInfo.latestVersion}
                </span>
              ) : updateInfo ? (
                <span className="ml-1.5 text-slate-400 dark:text-slate-500">· 已是最新</span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            disabled={checkingUpdate}
            onClick={() => void handleCheckUpdate()}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50/60 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <RefreshCw className={`h-3 w-3 ${checkingUpdate ? 'animate-spin' : ''}`} />
            {checkingUpdate ? '检查中…' : '检查更新'}
          </button>
        </div>

        {updateInfo?.hasUpdate && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50/80 px-2.5 py-2 text-[11px] text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            <span className="inline-flex items-center gap-1 font-medium">
              <ArrowUpCircle className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              v{updateInfo.latestVersion} 已发布，解压覆盖原目录后刷新扩展即可
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => void chrome.tabs.create({ url: updateInfo.downloadUrl })}
                className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
              >
                下载
              </button>
              <button
                type="button"
                title="查看更新说明"
                onClick={() =>
                  void chrome.tabs.create({ url: updateInfo.releaseUrl || RELEASES_PAGE_URL })
                }
                className="rounded-md p-1 text-emerald-700 hover:bg-emerald-200/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
              >
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 隐私声明 */}
      <div className="flex items-start gap-2 rounded-xl bg-emerald-50/70 p-3 text-[11px] leading-relaxed text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Google AI Hub 完全在您的浏览器本地运行，不读取密码或 Cookie，绝不上传任何账号或用量数据（仅检查更新时只读访问 GitHub Releases 版本号），所有数据仅保存在
          <code className="mx-0.5 rounded bg-emerald-100 px-1 py-0.5 dark:bg-emerald-900/60">
            chrome.storage.local
          </code>
          中。
        </p>
      </div>
    </div>
  );
}
