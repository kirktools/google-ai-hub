import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpCircle, BellRing, Copy, Download, ExternalLink, X } from 'lucide-react';
import { BENEFIT_CATALOG, PLAN_DEFINITIONS } from '../shared/plans';
import {
  buildAiUpdatePrompt,
  checkForUpdate,
  dismissUpdateNotice,
  type UpdateCheckResult,
} from '../shared/updateCheck';
import {
  createInitialState,
  loadState,
  normalizeState,
  saveManualCalibration,
  STORAGE_KEY,
  updateSettings,
} from '../shared/storage';
import type {
  BenefitId,
  BenefitMetrics,
  HubStorageState,
  RuntimeMessage,
  RuntimeResponse,
  SyncableBenefitId,
  ThemeMode,
  UserSettings,
} from '../shared/types';
import {
  buildAccountUrl,
  formatCooldown,
  getActivePlanId,
  getActiveResetDay,
  getDaysUntilReset,
  WASTE_ALERT_DAYS_THRESHOLD,
} from '../shared/utils';
import { CalibrateModal } from './components/CalibrateModal';
import { EcosystemCard } from './components/EcosystemCard';
import { Header } from './components/Header';
import { SettingsView } from './components/SettingsView';
import { PLATFORM_CARD_REGISTRY } from './components/cards';
import { ProgressBarModeContext } from './components/cards/UsageBar';

export function App() {
  const [state, setState] = useState<HubStorageState>(() => createInitialState());
  const [view, setView] = useState<'dashboard' | 'settings'>('dashboard');
  const [calibratingId, setCalibratingId] = useState<BenefitId | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const hasAutoSyncedRef = useRef(false);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  // 初始化读取、storage 变更订阅，以及「从未同步过」时自动触发首次同步
  useEffect(() => {
    void loadState().then((loaded) => {
      setState(loaded);
      if (
        !hasAutoSyncedRef.current &&
        loaded.syncProgress.lastSyncedAt === null &&
        !loaded.syncProgress.running
      ) {
        hasAutoSyncedRef.current = true;
        void chrome.runtime
          .sendMessage({ type: 'SYNC_ALL', automatic: true } satisfies RuntimeMessage)
          .catch(() => {
            // 静默忽略后台尚未唤醒时的偶发错误
          });
      }
    });

    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName === 'local' && changes[STORAGE_KEY]) {
        setState(normalizeState(changes[STORAGE_KEY].newValue));
      }
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  // 每秒刷新一次冷却倒计时
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // 启动时低频静默检查 GitHub Releases 新版本（12 小时缓存）
  useEffect(() => {
    void checkForUpdate(false).then((res) => {
      if (res) setUpdateInfo(res);
    });
  }, []);

  // 同步浅色/深色主题到 html class
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const mode = state.settings.theme;
      const shouldDark = mode === 'dark' || (mode === 'system' && media.matches);
      root.classList.toggle('dark', shouldDark);
    };

    applyTheme();
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [state.settings.theme]);

  const activePlanId = getActivePlanId(state);
  const activePlan = PLAN_DEFINITIONS[activePlanId];
  const planSource: 'manual' | 'detected' | 'pending' =
    state.settings.manualPlanOverride !== null
      ? 'manual'
      : state.planDetection.detectedPlanId !== null
        ? 'detected'
        : 'pending';
  const activeResetDay = getActiveResetDay(state);
  const daysUntilReset = getDaysUntilReset(activeResetDay);

  const cooldownRemainingMs = Math.max(
    0,
    (state.syncProgress.lastCooldownUntil ?? 0) - nowMs
  );

  // 月度防浪费提醒：距离重置 <= 5 天且套餐包含按月重置的权益
  const wasteAlertItems = useMemo(() => {
    if (!state.settings.wasteAlertEnabled) return [];
    if (daysUntilReset === null || daysUntilReset > WASTE_ALERT_DAYS_THRESHOLD) {
      return [];
    }
    const candidates: string[] = [];
    for (const id of ['google_one', 'ai_studio', 'flow', 'colab'] as const) {
      const meta = activePlan.benefits[id];
      if (!meta.monthlyReset) continue;
      const rec = state.benefits[id];
      // 若尚未同步，或检测到仍有剩余额度 > 0，则提示检查
      if (
        rec.metrics.remainingValue === undefined ||
        rec.metrics.remainingValue > 0
      ) {
        candidates.push(BENEFIT_CATALOG[id].title.split(' ')[0]);
      }
    }
    return candidates;
  }, [activePlan, daysUntilReset, state.benefits, state.settings.wasteAlertEnabled]);

  const handleUpdateSettings = async (patch: Partial<UserSettings>) => {
    const next = await updateSettings(patch);
    setState(next);
  };

  const handleCycleTheme = () => {
    const order: ThemeMode[] = ['system', 'light', 'dark'];
    const idx = order.indexOf(state.settings.theme);
    const nextTheme = order[(idx + 1) % order.length];
    void handleUpdateSettings({ theme: nextTheme });
  };

  const handleSyncAll = async () => {
    try {
      const res = (await chrome.runtime.sendMessage({
        type: 'SYNC_ALL',
      } satisfies RuntimeMessage)) as RuntimeResponse | undefined;
      if (!res?.ok) {
        if (res?.cooldownRemainingMs) {
          showToast(`冷却中，请 ${formatCooldown(res.cooldownRemainingMs)} 后再试`);
        } else if (res?.error) {
          showToast(res.error);
        }
      }
    } catch {
      showToast('无法连接后台同步服务，请重试');
    }
  };

  const handleSyncSingle = async (benefitId: SyncableBenefitId) => {
    try {
      const res = (await chrome.runtime.sendMessage({
        type: 'SYNC_SINGLE',
        benefitId,
      } satisfies RuntimeMessage)) as RuntimeResponse | undefined;
      if (!res?.ok && res?.error) {
        showToast(res.error);
      }
    } catch {
      showToast('触发单项刷新失败，请重试');
    }
  };

  const handleOpenSite = (benefitId: BenefitId) => {
    const url = buildAccountUrl(benefitId);
    void chrome.tabs.create({ url });
  };

  const handleToggleCollapse = (benefitId: BenefitId) => {
    const set = new Set(state.settings.collapsedCards);
    if (set.has(benefitId)) {
      set.delete(benefitId);
    } else {
      set.add(benefitId);
    }
    void handleUpdateSettings({ collapsedCards: Array.from(set) });
  };

  const handleMoveCard = (benefitId: BenefitId, delta: -1 | 1) => {
    const order = [...state.settings.cardOrder];
    const index = order.indexOf(benefitId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    void handleUpdateSettings({ cardOrder: order });
  };

  const handleSaveCalibration = async (metrics: BenefitMetrics) => {
    if (!calibratingId) return;
    const next = await saveManualCalibration(calibratingId, metrics);
    setState(next);
    setCalibratingId(null);
    showToast('已保存手动校准');
  };

  const handleClearCalibration = async () => {
    if (!calibratingId) return;
    const next = await saveManualCalibration(calibratingId, null);
    setState(next);
    setCalibratingId(null);
    showToast('已恢复自动/默认展示');
  };

  // 根据套餐过滤卡片（若某项在当前套餐未包含，如免费版 Flow，仍可通过折叠展示或仅展示适用项）
  const visibleCardOrder = state.settings.cardOrder.filter((id) => {
    if (id === 'ecosystem') return true;
    return activePlan.benefits[id].included || Boolean(state.benefits[id].manualOverride);
  });

  return (
    <div className="flex min-h-[520px] max-h-[600px] w-[400px] flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Header
        plan={activePlan}
        planSource={planSource}
        daysUntilReset={daysUntilReset}
        resetDay={activeResetDay}
        syncProgress={state.syncProgress}
        cooldownRemainingMs={cooldownRemainingMs}
        theme={state.settings.theme}
        view={view}
        onToggleView={() => setView(view === 'dashboard' ? 'settings' : 'dashboard')}
        onCycleTheme={handleCycleTheme}
        onSyncAll={() => void handleSyncAll()}
      />

      {toast && (
        <div className="mx-4 mt-2.5 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-md dark:bg-indigo-600">
          {toast}
        </div>
      )}

      <main className="flex-1 overflow-y-auto">
        {view === 'settings' ? (
          <SettingsView
            state={state}
            updateInfo={updateInfo}
            onUpdateInfoChange={setUpdateInfo}
            onUpdateSettings={handleUpdateSettings}
            onStateReplaced={setState}
          />
        ) : (
          <div className="space-y-2.5 p-3.5">
            {/* 新版本更新提醒横幅 */}
            {updateInfo?.hasUpdate && !updateInfo.dismissed && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2.5 text-xs text-emerald-950 dark:border-emerald-900/80 dark:bg-emerald-950/50 dark:text-emerald-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <ArrowUpCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <p className="font-semibold">
                        发现新版本 v{updateInfo.latestVersion}
                        <span className="ml-1.5 font-normal text-[11px] opacity-80">
                          当前 v{updateInfo.currentVersion}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] opacity-85">
                        下载 ZIP 解压覆盖原扩展目录，在扩展页点刷新即可（数据保留）。
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    title="暂不提醒此版本"
                    onClick={() => {
                      void dismissUpdateNotice(updateInfo.latestVersion);
                      setUpdateInfo({ ...updateInfo, dismissed: true });
                    }}
                    className="rounded p-0.5 text-emerald-700/70 transition hover:bg-emerald-200/60 hover:text-emerald-900 dark:text-emerald-300/70 dark:hover:bg-emerald-900/60"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
                  <button
                    type="button"
                    onClick={() => void chrome.tabs.create({ url: updateInfo.downloadUrl })}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-emerald-700"
                  >
                    <Download className="h-3 w-3" />
                    下载新版 ZIP
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(buildAiUpdatePrompt(updateInfo.downloadUrl))
                        .then(() =>
                          showToast('已复制 AI 更新指令，直接发给 AI 助手即可自动覆盖更新')
                        )
                        .catch(() => showToast('复制失败，请手动下载新版 ZIP'));
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-300/80 bg-white/80 px-2 py-1 text-[11px] font-medium text-emerald-800 transition hover:bg-white dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
                  >
                    <Copy className="h-3 w-3" />
                    AI 更新指令
                  </button>
                  <button
                    type="button"
                    onClick={() => void chrome.tabs.create({ url: updateInfo.releaseUrl })}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-300/80 bg-white/70 px-2 py-1 text-[11px] font-medium text-emerald-800 transition hover:bg-white dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
                  >
                    更新说明
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}

            {/* 首次未同步引导卡片 */}
            {planSource === 'pending' && !state.syncProgress.running && (
              <div className="flex items-start justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50/90 px-3 py-2.5 text-xs text-indigo-900 dark:border-indigo-900/80 dark:bg-indigo-950/50 dark:text-indigo-200">
                <div>
                  <p className="font-semibold">尚未同步您的 Google AI 账号数据</p>
                  <p className="mt-0.5 text-[11px] opacity-90">
                    下方当前仅展示默认参考项。点击右上角「一键同步」即可静默读取您的真实订阅套餐与各平台余量。
                  </p>
                </div>
              </div>
            )}

            {/* 月度防浪费提醒横幅 */}
            {wasteAlertItems.length > 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-900/80 dark:bg-amber-950/50 dark:text-amber-200">
                <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-semibold">
                    月度防浪费提醒：距离额度重置还有 {daysUntilReset} 天
                  </p>
                  <p className="mt-0.5 text-[11px] opacity-90">
                    建议检查本月可消耗的 AI 点数、AI Studio 赠金或 Colab 计算单元，避免过期清零。
                  </p>
                </div>
              </div>
            )}

            {/* 同步错误提示 */}
            {state.syncProgress.lastError && !state.syncProgress.running && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
                上次同步提示：{state.syncProgress.lastError}
              </div>
            )}

            {/* 权益卡片列表 */}
            <ProgressBarModeContext.Provider value={state.settings.progressBarMode}>
              {visibleCardOrder.map((id, idx) => {
                const collapsed = state.settings.collapsedCards.includes(id);
                const canMoveUp = idx > 0;
                const canMoveDown = idx < visibleCardOrder.length - 1;

                if (id === 'ecosystem') {
                  return (
                    <EcosystemCard
                      key={id}
                      perks={activePlan.ecosystemPerks}
                      collapsed={collapsed}
                      canMoveUp={canMoveUp}
                      canMoveDown={canMoveDown}
                      onToggleCollapse={() => handleToggleCollapse(id)}
                      onMoveUp={() => handleMoveCard(id, -1)}
                      onMoveDown={() => handleMoveCard(id, 1)}
                      onOpenBenefits={() => handleOpenSite('ecosystem')}
                    />
                  );
                }

                const catalog = BENEFIT_CATALOG[id];
                const CardComponent = PLATFORM_CARD_REGISTRY[id];
                return (
                  <CardComponent
                    key={id}
                    catalog={catalog}
                    plan={activePlan}
                    planMeta={activePlan.benefits[id]}
                    record={state.benefits[id]}
                    daysUntilReset={daysUntilReset}
                    collapsed={collapsed}
                    isSyncingThis={
                      state.syncProgress.running &&
                      state.syncProgress.currentTargetId === id
                    }
                    isGlobalSyncing={state.syncProgress.running}
                    canMoveUp={canMoveUp}
                    canMoveDown={canMoveDown}
                    onToggleCollapse={() => handleToggleCollapse(id)}
                    onMoveUp={() => handleMoveCard(id, -1)}
                    onMoveDown={() => handleMoveCard(id, 1)}
                    onOpenSite={() => handleOpenSite(id)}
                    onRefreshSingle={
                      catalog.syncable
                        ? () => void handleSyncSingle(id as SyncableBenefitId)
                        : undefined
                    }
                    onCalibrate={() => setCalibratingId(id)}
                  />
                );
              })}
            </ProgressBarModeContext.Provider>

            <footer className="pb-1 pt-2 text-center text-[10px] text-slate-400 dark:text-slate-500">
              {state.planDetection.detectedAccountLabel
                ? `当前账号：${state.planDetection.detectedAccountLabel}`
                : '复用 Chrome 当前本地 Google 登录态 · 纯本地运行'}
            </footer>
          </div>
        )}
      </main>

      {calibratingId && calibratingId !== 'ecosystem' && (
        <CalibrateModal
          catalog={BENEFIT_CATALOG[calibratingId]}
          record={state.benefits[calibratingId]}
          onSave={(metrics) => void handleSaveCalibration(metrics)}
          onClearManual={() => void handleClearCalibration()}
          onClose={() => setCalibratingId(null)}
        />
      )}
    </div>
  );
}
