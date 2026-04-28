# ClawdMate 进度记录

> 最后更新：2026-04-27
> 用途：下次打开项目时，先读这份文档，就能快速知道当前卡点、已验证事实、下一步怎么继续。

## 当前优先级

1. `P1` 桌宠动画嵌入灵动岛和 Dashboard
2. `P2` 灵动岛窗口问题
3. `P3` 日报生图体验优化

说明：
- 日报生图链路已经基本打通，当前更多是平台限流/超时问题，不再是主阻塞。
- 现在优先回到“灵动岛窗口容器太大、遮挡点击、展开不完整”这条线。

---

## 当前结论

### 1. 日报生图链路已经通了
已确认这些都成立：
- Web 按钮可以触发日报生成
- Tauri `invoke` 正常工作
- 后端确实会请求图片 API
- 参考图 `png/clawd.png` 已经能作为输入图上传到 API
- 生图 prompt 可以正常构造

当前真实问题不是“没调到接口”，而是：
- 平台会出现 `524` 超时
- 平台会出现 `Rate limit reached for gpt-image-2 on input-images per min`

一句话：
`生图链路是通的，但三方平台对带图请求不够稳定，而且有图片输入限流。`

### 2. 灵动岛窗口问题仍未解决
当前最核心的问题：
- 灵动岛窗口外层有一块过大的透明/白色容器
- 这块容器会挡住背后页面的点击
- 展开态或添加任务态时，内容有时展示不完整

用户真正想要的是：
- 收起时窗口只包住收起态内容
- 展开时窗口跟着内容自动变大
- 添加任务时也自动变大
- 除了灵动岛实际区域外，不要挡住背后内容

一句话：
`灵动岛要做成“窗口尺寸跟内容走”，而不是固定大框。`

---

## 本轮已完成

### 日报生图

1. 日报页已改成图片展示模式
- 无图时显示空白占位 + `一键生成日报`
- 有图后显示生成图片
- 右上角新增了 `重新生成` 按钮

相关文件：
- `web/src/pages/DailyReportView.tsx`

2. 日报生成规则已接入
- 游客模式不能生成
- 今日无记录不能生成
- 每个账号每天最多 2 次

相关文件：
- `web/src/lib/dailyReportGeneration.ts`
- `web/src/store/useStore.ts`
- `web/src/pages/Dashboard.tsx`

3. 生图 prompt 已支持参考角色约束
- prompt 模板在：
  - `web/src/lib/dailyImageSummary.ts`
- 当前 prompt 强调：
  - 主角严格参考 `png/clawd.png`
  - 多个任务场景
  - 生活地图构图
  - 顶部标题 + 底部总结区域

4. 后端已支持上传参考图
- 当前不再是纯文生图
- 已改成上传参考图的请求方式
- 并且新增了更轻量的参考图：
  - `png/clawd-ref.png`

相关文件：
- `src-tauri/src/lib.rs`
- `src-tauri/Cargo.toml`
- `png/clawd-ref.png`

5. 单路径生成已接入
- 桌面端现在优先只走一条生成路径
- 不再一口气 fallback 多条路径重复请求

相关文件：
- `web/src/pages/DailyReportView.tsx`

### 灵动岛 / Tauri 窗口

1. 开发启动方式已整理
- `npm run dev:island`
  - 启动 Tauri
  - 启动灵动岛前端
  - 启动 5173 主页面

相关文件：
- `package.json`
- `src-tauri/tauri.conf.json`
- `scripts/dev-island-frontends.mjs`

2. 当前 Tauri 主窗口配置仍是固定尺寸
在：
- `src-tauri/tauri.conf.json`

当前配置：
- `width: 560`
- `height: 900`
- `transparent: true`
- `decorations: false`
- `alwaysOnTop: true`

这正是“外层大容器挡点击”的根源之一。

3. 灵动岛前端目前已有一套“按内容测量”的尝试痕迹
在：
- `src/App.tsx`

当前可见线索：
- 有一组窗口尺寸常量：
  - `WINDOW_MIN_WIDTH`
  - `WINDOW_MIN_HEIGHT`
  - `WINDOW_MAX_WIDTH`
  - `WINDOW_MAX_HEIGHT`
- 说明之前已经尝试过“按内容尺寸适配窗口”
- 但这条方案还没有真正收口，用户体验仍不对

---

## 已验证事实

### 关于生图

1. API 真的能调通
- 不是前端假调用
- 不是 host 错
- 不是 model 错
- 不是完全没请求出去

2. 参考图真的已经传进接口
曾出现的报错里明确包含：
- `Rate limit reached for gpt-image-2`
- `on input-images per min`

这说明：
- 请求已经是“带图片输入”的模式
- 参考图上传功能已生效

3. 现在更轻的参考图已经准备好
- 原图：`png/clawd.png`
- 轻量版：`png/clawd-ref.png`

当前后端应优先使用更轻的 `clawd-ref.png`。

### 关于灵动岛窗口

1. 当前问题不是功能没有，而是窗口壳错误
- 灵动岛内容本身能显示
- 任务输入面板也能打开
- 但外层窗口尺寸和点击行为不对

2. 用户明确不接受的体验
- 一个固定的大透明/白色框盖在页面上
- 背后内容点不到
- 展开态还显示不完整

3. 正确方向已经明确
- 不能靠固定窗口尺寸硬撑
- 必须按当前可见内容动态调整窗口
- 必须让非交互透明区不阻塞背后点击

---

## 当前主要问题

### P1：桌宠动画嵌入灵动岛和 Dashboard

**目标**：将桌宠动画组件嵌入到灵动岛和 Dashboard，根据任务状态自动切换动画。

**任务清单**：

| # | 任务 | 状态 | 相关文件 |
|---|------|------|----------|
| 1 | 在 DynamicIsland 中实现 `getPetStatus()` 状态判断逻辑 | ⏳ 待完成 | `src/components/dynamic-island/DynamicIsland.tsx` |
| 2 | 在 DynamicIsland 中实现 celebrate 触发与自动恢复 | ⏳ 待完成 | `src/components/dynamic-island/DynamicIsland.tsx` |
| 3 | 替换灵动岛无任务时的 🦀 emoji 为 PetSprite | ⏳ 待完成 | `src/components/dynamic-island/DynamicIsland.tsx` |
| 4 | 替换灵动岛有暂停任务时的 🦀 emoji 为 PetSprite | ⏳ 待完成 | `src/components/dynamic-island/DynamicIsland.tsx` |
| 5 | 在 Dashboard 中实现 `getPetStatus()` 状态判断逻辑 | ⏳ 待完成 | `web/src/pages/Dashboard.tsx` |
| 6 | 在 Dashboard 中实现 celebrate 触发与自动恢复 | ⏳ 待完成 | `web/src/pages/Dashboard.tsx` |
| 7 | 替换 Dashboard 打招呼旁边的静态图片为 PetSprite | ⏳ 待完成 | `web/src/pages/Dashboard.tsx` |
| 8 | 测试各状态切换是否正常 | ⏳ 待完成 | - |

**状态逻辑**：
- `idle`（睡觉）：无任务 / 所有任务暂停
- `working`（敲键盘）：有任务正在进行
- `alert`（举牌感叹号）：有任务超时
- `celebrate`（撒星星）：用户完成任务后短暂显示，1.5秒后恢复

**详细方案**：见 `pet/README.md`

### P2：灵动岛窗口容器过大，挡住背后操作
现象：
- 透明或白色大框很大
- 收起态还好，一展开就很明显
- 会挡住背后 Dashboard 页面点击
- 展开内容有时不能完整展示

根因判断：
- `tauri.conf.json` 初始窗口是固定大尺寸
- 前端虽然尝试过内容测量，但没有把”当前可见内容尺寸”真正作为唯一窗口尺寸来源
- 透明区域并没有实现真正可靠的 click-through

### P3：日报生图虽然能请求，但平台不稳定
现象：
- 可能报 `524`
- 可能报图片输入限流

这条线当前不再优先处理，只保留现状。

---

## 下一次回来时，优先怎么做

### 优先继续修灵动岛窗口

建议顺序：

1. 先读这几个文件
- `src-tauri/tauri.conf.json`
- `src/App.tsx`
- `src/index.css`

2. 目标明确成一句话
`让 Tauri 窗口尺寸始终贴合当前可见的灵动岛内容，透明空白区不挡点击。`

3. 具体实现方向
- 只保留一个“当前可见内容根节点”的尺寸作为窗口依据
- 用 `ResizeObserver` 持续测量它的真实尺寸
- 收起态、展开态、添加任务态都用同一套测量逻辑
- 窗口尺寸跟着内容变化，而不是写死常量高度
- 透明空白区只作为视觉区域，不应阻挡背后点击

4. 判断成功的标准
- 收起时窗口很小，只包住小岛
- 展开时窗口刚好包住展开面板
- 打开添加任务时也能完整显示
- 灵动岛区域之外，背后页面还能正常点击

### 如果临时回到日报生图

先记住当前结论：
- 生图不是没接通
- 参考图上传已生效
- 当前主要是平台 `524` 和图片输入限流

不要再优先排查：
- host 是否正确
- model 是否正确
- 有没有调到 API

这些已经基本确认过了。

---

## 当前关键文件

### 桌宠动画
- `pet/README.md` - 完整方案文档
- `pet/PetSprite.tsx` - 桌宠精灵动画组件
- `pet/config.ts` - 动画配置
- `web/public/pet/sprites/` - 帧图资源

### 灵动岛
- `src-tauri/tauri.conf.json`
- `src/App.tsx`
- `src/index.css`
- `src/lib/islandBridge.ts`

### 日报生图
- `web/src/pages/DailyReportView.tsx`
- `web/src/lib/dailyImageSummary.ts`
- `web/src/lib/dailyReportGeneration.ts`
- `src-tauri/src/lib.rs`
- `png/clawd.png`
- `png/clawd-ref.png`

---

## 当前启动方式

完整联调请使用：

```bash
npm run dev:island
```

原因：
- 5173 是 Web 主页面
- Tauri 提供桌面能力
- 灵动岛和日报生图都依赖这套桌面链路

不要只用：

```bash
npm run dev
```

因为那只是纯前端页面，不足以验证灵动岛窗口和桌面生图链路。
