<div align="center">

<img src="public/icons/icon.svg" alt="Google AI Hub Icon" width="76" height="76" />

# Google AI Hub

**Google AI 订阅权益与用量汇总看板（Chrome Manifest V3 扩展）**

纯本地运行 · 零账号密码输入 · 零外发请求 · 自动识别套餐 · 一键静默同步

[官方网站](https://kirktools.github.io/google-ai-hub/) · [快速安装](#三快速安装与-chrome-加载指南) · [安全与隐私承诺](#四安全与隐私承诺为什么可以放心使用) · [项目架构](#六目录结构与二次开发)

</div>

---

## 一、为什么需要 Google AI Hub？

订阅了 **Google AI Plus / Google AI Pro / Google AI Ultra (5x / 20x)** 后，你是否经常遇到这些烦恼？

- 权益分散在 **Google One、AI Studio、Flow、Colab、Gemini、NotebookLM、Antigravity** 等六七个不同域名下，每次查余量都要逐个点开网页；
- 每月附赠的 **AI Credits、Cloud/AI Studio 赠金、Colab 计算单元** 忘记用或忘记领，月底直接清零浪费；
- 浏览器里登录了多个 Google 账号（`/u/0/`、`/u/1/`），经常切错号、看花眼；
- 不敢把 Google 账号、Cookie 或 API Key 交给任何第三方云端统计网站。

**Google AI Hub** 就是为此而生的轻量级开源 Chrome 插件：直接复用你浏览器里已有的 Google 登录态，点一下「一键同步」，十几秒内把分散在各平台的余量汇总到一个清爽的中文看板里，全程不离本机。

---

## 二、核心特性

- **自动识别订阅套餐**：优先从 `one.google.com` 自动识别当前套餐（Free / AI Plus / AI Pro / AI Ultra 5x / AI Ultra 20x）与每月重置日，自动匹配对应权益清单；未识别到时也支持在设置中手动兜底。
- **一键静默同步 + 顺路被动更新**：
  - 点击顶部「一键同步」，后台 Service Worker 串行创建**非激活后台标签页（`active: false`）**，读取已渲染的可见余额后**立即自动关闭标签页**，全程不打断当前浏览；
  - 内置 **3 分钟冷却防抖**，禁止高频后台轮询或调用未公开私有 API，温和低频不触发风控；
  - 平时自己正常访问上述 Google 站点时，也会顺路静默更新本地缓存。
- **8 大权益卡片全景看板（支持折叠、排序与手动校准）**：
  1. **Google One 云盘 & AI Credits**：云盘已用/总量、AI Credits 剩余点数与重置日
  2. **Google AI Studio / Cloud 赠金**：每月赠金领取状态与余额
  3. **Google Flow**：Veo 视频 / 图片 / 音乐创作点数余量
  4. **Google Colab**：每月 GPU / TPU 计算单元（Compute Units）余量
  5. **Gemini 网页版**：旗舰模型与 Deep Research 权益入口
  6. **NotebookLM**：进阶笔记本与音频播客概览入口
  7. **Google Antigravity**：桌面端编码额度卡片（标注 5 小时滚动刷新机制，支持快捷记录）
  8. **生态附加福利（折叠区）**：Workspace AI、YouTube Premium、家庭组共享等
- **月度防浪费提醒**：距离账单/额度重置日 ≤ 5 天时，在面板顶部柔和提醒检查当月可消耗额度。
- **浅色 / 深色主题 & 本地备份**：支持跟随系统/手动切换主题、JSON 导出/导入备份、一键清空缓存。
- **优雅降级容错**：内置中英文多策略文本解析，即使 Google 页面改版，也能优雅降级为「套餐参考 + 一键直达官网 + 手动校准」，绝不报错崩溃。

---

## 三、快速安装与 Chrome 加载指南

### 1. 环境要求
- Node.js `>= 20`
- pnpm `>= 9`

### 2. 克隆并构建扩展

```bash
git clone https://github.com/kirktools/google-ai-hub.git
cd google-ai-hub
pnpm install
pnpm build
```

构建完成后，会在项目根目录下生成可直接加载的 `dist/` 文件夹。

### 3. 加载到 Chrome / Edge / Arc / Brave

1. 在浏览器地址栏输入 `chrome://extensions/` 并回车；
2. 打开右上角的 **「开发者模式（Developer mode）」** 开关；
3. 点击左上角 **「加载已解压的扩展程序（Load unpacked）」**；
4. 选择刚才生成的 `google-ai-hub/dist` 目录；
5. 建议点击地址栏右侧的拼图图标，将 **Google AI Hub** 固定（Pin）到工具栏，随时一键呼出。

### 4. 日常使用说明

1. **首次使用**：确保你已在当前 Chrome 配置文件中登录了 Google 账号，点击扩展图标打开看板，首次打开会自动触发 **「一键同步」**。
2. **手动校准**：点击任意卡片右下角的「校准」，即可手动修正余额或记录个人备注。
3. **备份与迁移**：在设置页可一键导出纯 JSON 备份（仅含用量数值与偏好设置，不含任何凭据），随时导入恢复或一键清空本地缓存。

---

## 四、安全与隐私承诺（为什么可以放心使用）

开源代码完全透明，你可以随时审计 `public/manifest.json` 与 `src/` 下的每一行代码：

- **零外发请求**：扩展中没有任何 `fetch`、`XMLHttpRequest`、`WebSocket` 或第三方埋点统计代码，不会向任何外部服务器发送任何数据。
- **零凭据接触**：不需要输入 Google 账号密码、不要求填写 API Key、**不申请 `cookies` 权限**。仅在你本地浏览器中读取对应 Google 网页已经渲染出的可见文本。
- **纯本地存储**：所有缓存与设置仅保存在浏览器内置的 `chrome.storage.local` 中，卸载扩展或点击「一键清空缓存」即可彻底删除。
- **严格最小化权限**：

| 权限声明 | 实际用途 | 明确不做的事 |
| :--- | :--- | :--- |
| `storage` | 在本地 `chrome.storage.local` 保存权益缓存与主题/排序偏好 | 不使用云端同步，不上传数据 |
| `tabs` | 一键同步时复用单个后台标签页并在读取后立即关闭；点击卡片打开官网 | 不读取你其他无关标签页的内容或浏览历史 |
| `alarms` | 支持设置低频定时自动同步（最低 1 小时，可随时关闭） | 禁止高频轮询，不耗电不触发风控 |
| `host_permissions`（仅 10 个官方 Google 域名/路径） | 仅在 `one.google.com`、`aistudio.google.com`、`me.developers.google.com`、`console.cloud.google.com/billing*`、`flow.google.com`、`labs.google`、`colab.research.google.com`、`gemini.google.com`、`notebooklm.google.com`、`notebook.google.com` 上运行可见文本解析 | **不申请 `<all_urls>`**，不触碰 Gmail、Drive、银行或任何其他网站 |

---

## 五、开发与校验命令

```bash
# 安装依赖
pnpm install

# TypeScript 严格类型检查
pnpm typecheck

# 生产构建（输出到 dist/）
pnpm build

# 一次性执行类型检查 + 生产构建
pnpm check
```

---

## 六、目录结构与二次开发

如果 Google 某个平台后续发生页面改版，你只需修改对应站点的独立解析器文件，无需改动主流程：

```text
google-ai-hub/
├── public/
│   ├── manifest.json             # Manifest V3 最小权限配置
│   └── icons/                    # 16 / 32 / 48 / 128 PNG 与 SVG 图标
├── src/
│   ├── shared/
│   │   ├── types.ts              # 全局数据结构与消息协议
│   │   ├── plans.ts              # 各订阅套餐默认权益配置（统一在此维护）
│   │   ├── storage.ts            # chrome.storage.local 封装与 JSON 导入导出
│   │   └── utils.ts              # 多账号 URL 拼接、重置倒计时与冷却工具
│   ├── background/
│   │   └── index.ts              # Service Worker：串行后台同步与 3 分钟冷却防抖
│   ├── content/
│   │   ├── index.ts              # Content Script 入口：主动提取与顺路被动同步
│   │   └── parsers/              # 按站点拆分的独立 DOM 解析器（中英文容错）
│   │       ├── types.ts
│   │       ├── googleOne.ts
│   │       ├── aiStudio.ts
│   │       ├── flow.ts
│   │       ├── colab.ts
│   │       ├── gemini.ts
│   │       └── notebookLm.ts
│   └── popup/                    # 400px 宽 React + Tailwind CSS 现代卡片看板
│       ├── App.tsx
│       └── components/
└── site/                         # 静态官网介绍页（GitHub Pages 部署）
```

---

## 七、免责声明与开源协议

- 本项目为独立开源社区工具，与 Google LLC 无关。所有产品名称与商标归其各自所有者所有。
- 本项目采用 [MIT License](LICENSE) 开源，欢迎提交 Issue 与 Pull Request 一起维护各站点解析规则！
