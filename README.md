# ClawdMate

ClawdMate 是一个「网页端任务管理 + 可选灵动岛桌面端」的专注工具。

- 网页端：创建任务、管理历史、生成日报图
- 灵动岛桌面端（Windows）：悬浮显示任务，支持快捷开关与联动

---

## 功能概览

- 今日任务：简单/结构化任务、倒计时、暂停/完成/取消
- 历史记录：按日期查看任务结果
- 日报生成：根据当天任务生成一张可下载/可分享的复盘图
- 灵动岛（可选）：桌面悬浮任务面板，与网页任务联动

---

## 给普通用户：下载安装与使用

### 1. 打开网站

主站：`https://mmuxyq.cn`

### 2. 下载灵动岛（可选）

点击首页 `下载灵动岛` 按钮，下载 Windows 安装包并安装。

> 不安装也可以使用网页端核心功能；安装后可获得桌面悬浮灵动岛体验。

### 3. 使用流程

1. 在网页端登录（推荐）
2. 在 `今日任务` 创建任务并开始专注
3. 需要桌面悬浮时，点击侧边栏 `开启灵动岛`
4. 专注结束后到 `生成日报` 生成与下载日报图片

---

## 常见问题（用户）

### Q1：点击“开启灵动岛”没反应，或一直提示下载？

通常是浏览器拦截了网页访问本机桥接服务（`127.0.0.1`）。

在 Edge 可先排障：

1. 打开 `edge://flags/#local-network-access-check`
2. 将该项设为 `Disabled`
3. 重启浏览器后重试

并确认灵动岛应用已启动，且能访问：

- `http://127.0.0.1:43141/health`

若返回 `{"ok":true}` 说明本机桥接正常。

### Q2：下载日报跳转外链，不是直接下载？

新版已优先使用浏览器直接下载逻辑。若仍异常，请强刷页面（`Ctrl+F5`）并确认已更新到最新部署。

### Q3：为什么我和别人看到状态不一致？

请统一使用同一个域名：`https://mmuxyq.cn`，避免 `vercel.app` 与自定义域名混用带来的缓存/站点权限差异。

---

## 给开发者：本地开发

## 环境要求

- Node.js 18+
- npm
- Rust（用于 Tauri 桌面端）
- Windows（若需打包桌面端安装包）

## 安装依赖

```bash
npm install
npm --prefix web install
```

## 启动模式

### 仅网页端开发

```bash
npm run dev
```

### 网页 + 灵动岛联调（推荐）

```bash
npm run dev:island
```

---

## 构建与打包

### 构建前端

```bash
npm run build
```

### 打包灵动岛安装包（NSIS）

```bash
npm exec tauri build -- --bundles nsis
```

产物示例：

- `src-tauri/target/release/bundle/nsis/ClawdMate_0.1.0_x64-setup.exe`

---

## 生产部署（Vercel）

Web 项目部署到 Vercel，`Root Directory` 设为 `web`。

关键环境变量：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_DESKTOP_DOWNLOAD_URL`（指向 GitHub Releases 永久下载链接）
- `VITE_IMAGE_GATEWAY_URL`（通常 `/api/daily-report-image`）

服务端（Vercel Function）变量：

- `IMAGE_API_KEY`
- `IMAGE_API_HOST`（可选，默认 `https://api.openai.com/v1`）
- `IMAGE_API_MODEL`（可选，默认 `gpt-image-2`）
- `IMAGE_REFERENCE_URL`（可选）

---

## 灵动岛下载链接规范（重要）

请使用 GitHub Releases 永久链接，不要用带签名参数的临时 `release-assets` URL。

格式：

```text
https://github.com/<owner>/<repo>/releases/download/<tag>/<asset-name>.exe
```

---

## 项目结构

```text
.
├─ web/                 # 网页端（Vite + React）
│  ├─ src/
│  └─ api/              # Vercel Functions
├─ src/                 # 灵动岛前端（Tauri Webview）
├─ src-tauri/           # Tauri Rust 后端与打包配置
├─ docs/                # 项目文档
└─ png/                 # 参考图与素材
```

---

## 许可证

如需开源发布，请在此补充许可证（如 MIT / Apache-2.0）。
