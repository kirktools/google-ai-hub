// 仅在扩展自己的临时标签页，让 Antigravity 按可见页面初始化用量面板。
if (
  location.pathname === '/remote' &&
  location.hash === '#google-ai-hub-background-sync' &&
  document.hidden
) {
  Object.defineProperties(document, {
    hidden: { configurable: true, get: () => false },
    visibilityState: { configurable: true, get: () => 'visible' },
  });
}
