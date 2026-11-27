import type { ParsedSiteResult, RuntimeMessage, RuntimeResponse, SyncableBenefitId } from '../shared/types';
import { detectBenefitIdFromUrl } from '../shared/utils';
import { aiStudioParser } from './parsers/aiStudio';
import { antigravityParser } from './parsers/antigravity';
import { colabParser } from './parsers/colab';
import { flowParser } from './parsers/flow';
import { geminiParser } from './parsers/gemini';
import { googleOneParser } from './parsers/googleOne';
import { notebookLmParser } from './parsers/notebookLm';
import type { SiteParser } from './parsers/types';
import { buildSanitizedDebugInfo } from './parsers/types';

const PARSER_MAP: Record<SyncableBenefitId, SiteParser> = {
  google_one: googleOneParser,
  ai_studio: aiStudioParser,
  flow: flowParser,
  colab: colabParser,
  gemini: geminiParser,
  notebooklm: notebookLmParser,
  antigravity: antigravityParser,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 等待 SPA 渲染出关键可见文本（最多等待 maxWaitMs，避免无限阻塞） */
async function waitAndParse(
  parser: SiteParser,
  maxWaitMs: number,
  isActiveSync: boolean
): Promise<ParsedSiteResult> {
  const deadline = Date.now() + maxWaitMs;
  let prepared = false;
  let lastResult = parser.parse(document, window.location.href);

  while (Date.now() < deadline) {
    if (lastResult.status === 'unauthenticated') {
      return lastResult;
    }

    // 在主动后台同步模式下，当页面就绪后执行一次 UI 展开钩子（例如点头像/点设置→用量限制）
    if (isActiveSync && !prepared && parser.isReady(document) && parser.prepareForActiveSync) {
      prepared = true;
      try {
        await parser.prepareForActiveSync(document);
      } catch {
        // 展开失败时优雅降级
      }
      lastResult = parser.parse(document, window.location.href);
      if (lastResult.status === 'synced') {
        return lastResult;
      }
    }

    if (lastResult.status === 'synced' && (!isActiveSync || prepared || !parser.prepareForActiveSync)) {
      return lastResult;
    }

    if (parser.isReady(document)) {
      await sleep(700);
      lastResult = parser.parse(document, window.location.href);
      if (lastResult.status === 'synced' && (!isActiveSync || prepared || !parser.prepareForActiveSync)) {
        return lastResult;
      }
    }
    await sleep(600);
    lastResult = parser.parse(document, window.location.href);
  }

  return lastResult;
}

/** 响应 Background 主动发起的提取指令 */
chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse: (res: RuntimeResponse) => void) => {
    if (message?.type !== 'EXTRACT_PAGE_DATA') {
      return undefined;
    }

    const parser = PARSER_MAP[message.benefitId];
    if (!parser) {
      sendResponse({ ok: false, error: '未找到对应的站点解析器' });
      return undefined;
    }

    const activeWaitMs =
      window.location.hostname.includes('console.cloud.google.com') ||
      window.location.hostname.includes('antigravity.google.com')
        ? 14500
        : 8500;

    waitAndParse(parser, activeWaitMs, true)
      .then((result) => {
        sendResponse({
          ok: true,
          data: {
            ...result,
            debugInfo:
              result.debugInfo ?? buildSanitizedDebugInfo(window.location.href, result.status),
          },
        });
      })
      .catch(() => {
        sendResponse({
          ok: true,
          data: {
            benefitId: message.benefitId,
            status: 'fallback',
            metrics: {},
            message: '页面解析超时，已降级为默认展示',
          },
        });
      });

    return true;
  }
);

/** 顺路被动同步：用户平时自己浏览这些 Google 页面时，静默提取可见信息并节流上报 */
function schedulePassiveSync(): void {
  const detected = detectBenefitIdFromUrl(window.location.href);
  if (!detected || !(detected in PARSER_MAP)) return;

  const benefitId = detected as SyncableBenefitId;
  const parser = PARSER_MAP[benefitId];

  // 延迟 3 秒再读取，确保不干扰用户正常页面首屏加载；Cloud Console 等重型页面给更充裕等待时间
  const passiveWaitMs = window.location.hostname.includes('console.cloud.google.com')
    ? 12000
    : 4500;
  window.setTimeout(() => {
    waitAndParse(parser, passiveWaitMs, false)
      .then((result) => {
        // 被动模式下只上报明确提取成功或未登录的结果，不拿 fallback 噪音刷写缓存
        if (result.status === 'synced' || result.status === 'unauthenticated') {
          chrome.runtime.sendMessage({
            type: 'PASSIVE_PARSE_RESULT',
            payload: result,
          } satisfies RuntimeMessage).catch(() => {
            // 忽略 Service Worker 休眠瞬间的通道错误
          });
        }
      })
      .catch(() => {
        // 静默容错，绝不影响宿主页面
      });
  }, 3000);
}

schedulePassiveSync();
