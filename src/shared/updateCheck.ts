const RELEASES_API_URL =
  'https://api.github.com/repos/kirktools/google-ai-hub/releases/latest';
export const LATEST_ZIP_URL =
  'https://github.com/kirktools/google-ai-hub/releases/latest/download/google-ai-hub-chrome.zip';
export const RELEASES_PAGE_URL =
  'https://github.com/kirktools/google-ai-hub/releases/latest';

const UPDATE_CACHE_KEY = 'google_ai_hub_update_check_v1';
const UPDATE_CHECK_TTL_MS = 12 * 60 * 60 * 1000; // 12 小时缓存，避免频繁请求 GitHub API

interface StoredUpdateCache {
  latestVersion: string;
  releaseUrl: string;
  downloadUrl: string;
  checkedAt: number;
  dismissedVersion?: string;
}

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseUrl: string;
  downloadUrl: string;
  checkedAt: number;
  dismissed: boolean;
}

export function getCurrentExtensionVersion(): string {
  try {
    return chrome.runtime.getManifest().version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function normalizeVersion(v: string): string {
  return v.trim().replace(/^v/i, '');
}

/** 返回 > 0 表示 a > b，0 表示相等，< 0 表示 a < b */
export function compareVersions(a: string, b: string): number {
  const pa = normalizeVersion(a)
    .split('.')
    .map((n) => Number.parseInt(n, 10) || 0);
  const pb = normalizeVersion(b)
    .split('.')
    .map((n) => Number.parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function readCache(): Promise<StoredUpdateCache | null> {
  try {
    const res = await chrome.storage.local.get(UPDATE_CACHE_KEY);
    const raw = res[UPDATE_CACHE_KEY] as StoredUpdateCache | undefined;
    if (raw && typeof raw.latestVersion === 'string' && typeof raw.checkedAt === 'number') {
      return raw;
    }
  } catch {
    // 忽略读取异常
  }
  return null;
}

async function writeCache(cache: StoredUpdateCache): Promise<void> {
  try {
    await chrome.storage.local.set({ [UPDATE_CACHE_KEY]: cache });
  } catch {
    // 忽略写入异常
  }
}

function toResult(cache: StoredUpdateCache): UpdateCheckResult {
  const currentVersion = normalizeVersion(getCurrentExtensionVersion());
  const latestVersion = normalizeVersion(cache.latestVersion);
  const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;
  return {
    currentVersion,
    latestVersion,
    hasUpdate,
    releaseUrl: cache.releaseUrl || RELEASES_PAGE_URL,
    downloadUrl: cache.downloadUrl || LATEST_ZIP_URL,
    checkedAt: cache.checkedAt,
    dismissed: Boolean(cache.dismissedVersion && cache.dismissedVersion === latestVersion),
  };
}

/**
 * 检查 GitHub Releases 最新版本。
 * - force = false：12 小时内命中本地缓存直接返回，网络异常时返回 null（静默失败）。
 * - force = true：强制发起实时检查并清除 dismissed 标记，失败时抛出错误供手动检查提示。
 */
export async function checkForUpdate(force = false): Promise<UpdateCheckResult | null> {
  const cached = await readCache();
  if (!force && cached && Date.now() - cached.checkedAt < UPDATE_CHECK_TTL_MS) {
    return toResult(cached);
  }

  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), 8000);

  try {
    const resp = await fetch(RELEASES_API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
    if (!resp.ok) {
      if (force) throw new Error(`HTTP ${resp.status}`);
      return cached ? toResult(cached) : null;
    }

    const data = (await resp.json()) as {
      tag_name?: string;
      html_url?: string;
      assets?: Array<{ name?: string; browser_download_url?: string }>;
    };

    const tag = data.tag_name?.trim();
    if (!tag) {
      if (force) throw new Error('EMPTY_TAG');
      return cached ? toResult(cached) : null;
    }

    const zipAsset = data.assets?.find(
      (a) =>
        typeof a.name === 'string' &&
        a.name.endsWith('.zip') &&
        typeof a.browser_download_url === 'string'
    );

    const nextCache: StoredUpdateCache = {
      latestVersion: normalizeVersion(tag),
      releaseUrl: data.html_url || RELEASES_PAGE_URL,
      downloadUrl: zipAsset?.browser_download_url || LATEST_ZIP_URL,
      checkedAt: Date.now(),
      dismissedVersion: force ? undefined : cached?.dismissedVersion,
    };

    await writeCache(nextCache);
    return toResult(nextCache);
  } catch (err) {
    if (force) throw err;
    return cached ? toResult(cached) : null;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export async function dismissUpdateNotice(version: string): Promise<void> {
  const cached = await readCache();
  if (!cached) return;
  await writeCache({
    ...cached,
    dismissedVersion: normalizeVersion(version),
  });
}
