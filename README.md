<div align="center">

<img src="public/icons/icon.svg" alt="Google AI Hub Icon" width="76" height="76" />

# Google AI Hub

**Google AI 订阅权益与用量汇总看板（Chrome Manifest V3 扩展）**

纯本地运行 · 零账号密码输入 · 零第三方数据上传 · 自动识别套餐 · 一键静默同步

[官方网站](https://kirktools.github.io/google-ai-hub/) · [快速安装](#三快速安装与-chrome-加载指南) · [安全与隐私承诺](#四安全与隐私承诺为什么可以放心使用) · [项目架构](#六目录结构与二次开发)

</div>

---

## 一、为什么需要 Google AI Hub？

订阅了 **Google AI Plus / Google AI Pro / Google AI Ultra (5x / 20x)** 后，你是否经常遇到这些烦恼？

- 权益分散在 **Google One、AI Studio / Cloud 赠金、Flow、Colab、Gemini、NotebookLM、Antigravity** 等多个不同域名下，每次查余量都要逐个点开网页；
- 每月附赠的 **AI Credits、Cloud 赠金、Colab 计算单元** 忘记用或忘记领，月底直接清零浪费；
- 不敢把 Google 账号、Cookie 或 API Key 交给任何第三方云端统计网站。

**Google AI Hub** 就是为此而生的轻量级开源 Chrome 插件：直接复用你浏览器里已有的 Google 登录态，点一下「一键同步」，十几秒内把分散在各平台的余量汇总到一个清爽的中文看板里，全程不离本机。

---

## 二、核心特性

- **自动识别订阅套餐**：优先从 `one.google.com` 自动识别当前套餐（Free / AI Plus / AI Pro / AI Ultra 5x / AI Ultra 20x）与每月重置日，自动匹配对应权益清单；未识别到时也支持在设置中手动兜底。
- **一键同步 + 低频定时刷新 + 顺路被动更新**：
  - 同步优先读取符合条件的同站点标签页，或复用单个后台标签页，读取完成后关闭临时标签页；
  - 支持基于 `chrome.alarms` 的**低频定时自动同步**（默认每 1 小时，可调 1~12 小时或关闭），打开看板即刻秒看最新缓存；内置 **3 分钟冷却防抖**，不调未公开私有 API；
  - 平时自己正常访问上述 Google 站点时，也会顺路静默更新本地缓存。
- **8 大权益卡片全景看板（各平台独立组件、支持折叠/排序/手动校准）**：
  1. **Google One 云盘 & AI Credits**：真实已用/总云盘空间占比进度条
  2. **Google AI Studio / Cloud 赠金**：自动读取 Cloud 结算赠金余额（如 `$300` 试用 + 每月 `$10` Developer 赠金）及 Google Builders Hub 一键领取指引
  3. **Google Flow**：总可用点数、月度 + 今日赠送双进度条与额外 AI 点数明细
  4. **Google Colab**：自动读取剩余 GPU / TPU 计算单元（Compute Units）与消耗占比
  5. **Gemini 网页版**：5 小时滚动窗口 + 每周限额双进度条与精确重置时间
  6. **NotebookLM（Gemini Notebook）**：当前 + 每周 AI 用量双进度条、重置时间与个人笔记本数
  7. **Google Antigravity**：自动读取 Gemini & Claude/GPT 模型的 5 小时滚动窗口与每周剩余额度及恢复倒计时
  8. **生态附加福利（折叠区）**：Workspace AI、YouTube Premium、家庭组共享等
- **月度防浪费提醒**：距离账单/额度重置日 ≤ 5 天时，在面板顶部柔和提醒检查当月可消耗额度。
- **浅色 / 深色主题 & 本地备份**：支持跟随系统/手动切换主题、JSON 导出/导入备份、一键清空缓存。
- **优雅降级容错**：内置中英文多策略文本解析，即使 Google 页面改版，也能优雅降级为「套餐参考 + 一键直达官网 + 手动校准」，绝不报错崩溃。

---

## 三、快速安装与 Chrome 加载指南

### 方式 A：直接发给 AI 助手一键安装（最省心，无需 Node 环境）

如果你正在使用 **Antigravity / Claude Code / Cursor / Codex** 等 AI 助手，直接把下面这句话发给它即可自动下载预构建包并解压：

```text
请帮我下载 https://github.com/kirktools/google-ai-hub/releases/latest/download/google-ai-hub-chrome.zip 并解压到本地固定目录，再帮我打开 Chrome 的 chrome://extensions/ 并完成加载（若受浏览器安全限制无法自动点击，请打开解压目录并指引我最后一步）。
```

### 方式 B：直接下载预构建压缩包（无需 Node 环境）

1. 前往 [GitHub Releases](https://github.com/kirktools/google-ai-hub/releases/latest) 下载 `google-ai-hub-chrome.zip` 并解压；
2. 打开 Chrome 地址栏输入 `chrome://extensions/` 并开启右上角 **「开发者模式」**；
3. 点击 **「加载已解压的扩展程序」**，选择解压后的文件夹即可。

### 方式 C：从源码手动构建（开发者）

- 环境要求：Node.js `>= 20`、pnpm `>= 9`

```bash
git clone https://github.com/kirktools/google-ai-hub.git
cd google-ai-hub
pnpm install
pnpm build
```

构建完成后，在 `chrome://extensions/` 加载 `google-ai-hub/dist` 目录即可。

### 发布命令

```bash
# 仅在本地打包 release/google-ai-hub-v<version>.zip 与 SHA256SUMS.txt
pnpm package

# 一键发版（默认自动 patch +1，如 1.0.0 -> 1.0.1），自动同步 manifest 版本、构建、提交、打标签并推送
pnpm release

# 预演发版（不改文件、不提交、不推送）
pnpm release --dry-run

# 指定 minor 或 major 递增（或使用当前版本号发首版）
pnpm release minor
pnpm release major
pnpm release current
```

### 4. 日常使用说明

1. **首次使用**：确保你已在当前 Chrome 配置文件中登录了 Google 账号，点击扩展图标打开看板，首次打开会自动触发 **「一键同步」**。
2. **手动校准**：点击任意卡片右下角的「校准」，即可手动修正余额或记录个人备注。
3. **备份与迁移**：在设置页可一键导出纯 JSON 备份（仅含用量数值与偏好设置，不含任何凭据），随时导入恢复或一键清空本地缓存。

---

## 四、安全与隐私承诺（为什么可以放心使用）

开源代码完全透明，你可以随时审计 `public/manifest.json` 与 `src/` 下的每一行代码：

- **零第三方数据上传**：扩展中没有任何第三方埋点、分析或上传代码；同步时仅在你的本机浏览器中访问下方白名单内的 Google 官方页面，提取的用量数据完全保存在本地。
- **零凭据接触**：不需要输入 Google 账号密码、不要求填写 API Key、**不申请 `cookies` 权限**。仅在你本地浏览器中读取对应 Google 网页已经渲染出的可见文本。
- **透明的默认同步行为**：首次打开自动同步一次，默认开启每 1 小时的低频定时刷新（可在设置中随时关闭或调为 2~12 小时）；复用已打开标签页时仅按白名单域名匹配，不枚举其他无关标签页。
- **纯本地存储**：所有缓存与设置仅保存在浏览器内置的 `chrome.storage.local` 中（导出 JSON 备份会自动剔除账号标签，但会保留你手动填写的个人备注），卸载扩展或点击「一键清空缓存」即可彻底删除。
- **严格最小化权限**：

| 权限声明 | 实际用途 | 明确不做的事 |
| :--- | :--- | :--- |
| `storage` | 在本地 `chrome.storage.local` 保存权益缓存与主题/排序偏好 | 不使用云端同步，不上传数据 |
| `tabs` | 一键同步时复用单个后台标签页并在读取后立即关闭；点击卡片打开官网 | 不读取你其他无关标签页的内容或浏览历史 |
| `alarms` | 支持设置低频定时自动同步（最低 1 小时，可随时关闭） | 禁止高频轮询，不耗电不触发风控 |
| `host_permissions`（仅 11 个官方 Google 域名/路径） | 仅在 `one.google.com`、`aistudio.google.com`、`me.developers.google.com`、`console.cloud.google.com/billing*`、`flow.google.com`、`labs.google`、`colab.research.google.com`、`gemini.google.com`、`notebooklm.google.com`、`notebook.google.com`、`antigravity.google.com` 上运行可见文本解析 | **不申请 `<all_urls>`**，不触碰 Gmail、Drive、银行或任何其他网站 |

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
│   │   └── utils.ts              # URL 路由识别、重置倒计时与冷却工具
│   ├── background/
│   │   └── index.ts              # Service Worker：单标签复用同步、定时闹钟与 3 分钟冷却防抖
│   ├── content/
│   │   ├── index.ts              # Content Script 入口：主动提取与顺路被动同步
│   │   ├── parsers/              # 按站点拆分的独立 DOM 解析器（支持 Shadow DOM 与中英文容错）
│   │   │   ├── types.ts
│   │   │   ├── googleOne.ts
│   │   │   ├── aiStudio.ts
│   │   │   ├── flow.ts
│   │   │   ├── colab.ts
│   │   │   ├── gemini.ts
│   │   │   ├── notebookLm.ts
│   │   │   └── antigravity.ts
│   └── popup/                    # 400px 宽 React + Tailwind CSS 现代卡片看板
│       ├── App.tsx
│       └── components/
│           └── cards/            # 按平台拆分的独立权益卡片组件
├── scripts/                      # 本地打包与一键发版脚本（package / release）
└── site/                         # 静态官网介绍页（GitHub Pages 部署）
```

---

## 七、免责声明与开源协议

- 本项目为独立开源社区工具，与 Google LLC 无关。所有产品名称与商标归其各自所有者所有。
- 本项目采用 [MIT License](LICENSE) 开源，欢迎提交 Issue 与 Pull Request 一起维护各站点解析规则！
