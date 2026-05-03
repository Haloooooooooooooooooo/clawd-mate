# ClawdMate Web 部署到 Vercel（含日报生图 API）

## 1. Vercel 项目配置

- Framework Preset: `Vite`
- Root Directory: `web`
- Build Command: `npm run build`
- Output Directory: `dist`

## 2. 需要配置的环境变量

前端（暴露给浏览器）：
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_DESKTOP_DOWNLOAD_URL`
- `VITE_IMAGE_GATEWAY_URL`（建议 `/api/daily-report-image`）

服务端（仅 Vercel Function 使用）：
- `IMAGE_API_KEY`
- `IMAGE_API_HOST`（默认 `https://api.openai.com/v1`）
- `IMAGE_API_MODEL`（默认 `gpt-image-2`）
- `IMAGE_REFERENCE_URL`（可选，不填则默认使用 `${origin}/clawd-ref.png`）

参考模板：`web/.env.example`

## 3. 生图链路说明

- 前端调用：`POST /api/daily-report-image`
- 函数文件：`web/api/daily-report-image.js`
- 优先策略：
1. 优先走 `images/edits` + 参考图（`clawd-ref.png`）
2. 参考图不可用时回退 `images/generations`

## 4. 路由配置

- `web/vercel.json` 已配置 SPA rewrite。
- `/api/*` 为函数路由，其他路径回退到 `/index.html`。

## 5. 上线后验收

1. 直接访问首页、`/app/dashboard`、`/app/report` 均可打开。
2. 不安装桌面端时，网页可正常管理任务与生成日报。
3. 报错时能看到可读提示（限流、超时、密钥缺失）。
4. “下载灵动岛”按钮跳转到你设置的 `VITE_DESKTOP_DOWNLOAD_URL`。
