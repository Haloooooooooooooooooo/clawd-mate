# ClawdMate 进度记录

> 最后更新：2026-04-24  
> 记录范围：Web 端 + Tauri 灵动岛联动改造

## 今日完成（2026-04-24）

1. 明确并统一“灵动岛”目标
- 已确认目标为 `tauri` 目录下的桌面灵动岛，而非 Web 页面内嵌替代组件。
- 已删除 Web 端替代灵动岛组件，避免误操作与混淆。

2. 完成灵动岛显示/隐藏联动（Web <-> Tauri）
- Web 侧“召唤灵动岛 / 关闭灵动岛”按钮通过本地桥接接口控制 Tauri 窗口显示状态。
- Web 侧增加轮询同步，能够反映灵动岛当前可见状态。
- 灵动岛侧关闭动作已回传桥接接口，Web 按钮状态会同步回“未启动”状态。

3. 完成收起态右上角关闭按钮（X）
- 在 Tauri 灵动岛收起态补充右上角 `X` 关闭按钮。
- 按需求调整为“仅悬浮/聚焦时显示”。

4. 任务预设时间已统一
- 极简模式、结构模式预设时间已改为：`15 / 30 / 45 / 60 / 90 / 自定义`。

5. 完成任务双向同步基础链路（创建）
- Web 新建任务：推送到桥接服务，Tauri 端可拉取并创建任务。
- Tauri 新建任务：推送到桥接服务，Web 端可拉取并创建任务。
- 双向采用 `/tasks/create` + `/tasks/pull` 队列化接口，避免直接耦合。

6. 修复与清理
- 清理了一批影响构建/检查的前端无用引用。
- 保留现有业务逻辑与页面结构，仅做联动与视觉相关层面的修改。

## 当前状态

1. 已达成
- 灵动岛显示/隐藏联动可用。
- 收起态 `X` 关闭能力已接入。
- Web 与 Tauri 的“任务创建”双向同步主流程可用。

2. 仍需验证/补强
- 端到端联调验证（多轮创建、切换状态、异常恢复）还需要完整跑一遍。
- Rust 端在当前环境未执行 `cargo` 编译校验（本机命令不可用）。

## 今日变更重点文件

- `src-tauri/src/lib.rs`
- `src/App.tsx`
- `src/lib/islandBridge.ts`
- `src/components/dynamic-island/DynamicIsland.tsx`
- `src/components/dynamic-island/CollapsedView.tsx`
- `src/components/task-input/SimpleMode.tsx`
- `src/components/task-input/StructuredMode.tsx`
- `web/src/App.tsx`
- `web/src/lib/islandBridge.ts`
- `web/src/store/useStore.ts`
- `web/src/components/layout/Sidebar.tsx`
- `web/src/components/dashboard/TasksIsland.tsx`（已删除）

## 明天任务清单（2026-04-25）

1. 完成联调验收清单（高优先）
- 验证“Web 召唤 -> Tauri 显示 -> Tauri 关闭 -> Web 状态回写”全链路。
- 验证“Web 创建任务 -> Tauri 同步显示”与“Tauri 创建任务 -> Web 同步创建”。
- 连续多次操作验证无重复创建、无状态错乱。

2. 增强同步稳定性（高优先）
- 增加去重策略（例如 task 指纹或同步 ID），避免边界情况下重复入队。
- 增加失败重试与超时保护，补充桥接不可达时的 UI 提示。

3. 完成 Tauri 侧可运行校验（高优先）
- 在可用 Rust 环境执行 `cargo check` / `cargo build`。
- 修复编译或类型问题并回归验证。

4. 同步状态范围扩展（中优先）
- 从“仅创建同步”扩展到关键状态同步（暂停/继续/完成/取消）的设计与实现评估。
- 输出最小可行同步矩阵（哪些状态必须双向、哪些可单向）。

5. 文档与发布准备（中优先）
- 更新 `docs/island-implementation.md` 与 `docs/implementation-plan.md` 的联动章节。
- 补充本地启动与联调说明，便于复现和验收。

## 风险与阻塞

- 当前环境缺少 `cargo` 命令，影响 Tauri/Rust 本地编译验证。
- 双端轮询同步在极端情况下可能出现重复写入，需要去重机制兜底。

## Supabase 登录注册任务清单（2026-04-25）

✅ 1. Supabase 接入准备（本地）  
- 已新增 `web/.env.example`，预留 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`。  
- 待你在 Supabase 控制台创建项目后填入真实值（本地 `.env`）。

✅ 2. Supabase Auth 配置文档（邮箱注册/登录）  
- 已新增 `docs/supabase-auth-and-schema.md`，包含控制台配置步骤：开启邮箱登录、关闭邮箱验证。  
- 待你在 Supabase 控制台按文档执行（执行后该项即完全落地）。

✅ 3. 数据模型与 RLS 脚本（数据库安全策略）  
- 已新增 `docs/supabase-schema.sql`，包含 `profiles`、`tasks`、`subtasks`、`task_history` 建表脚本。  
- 已包含 RLS 与 `auth.uid() = user_id` 策略。  
- 待你在 Supabase SQL Editor 执行脚本。

✅ 4. 前端认证接入（Web）
- 已接入 Supabase 客户端。
- 已实现注册/登录/退出（邮箱模式）。
- 已维护登录态，并通过 Supabase 会话驱动游客/登录模式切换。

✅ 5. 游客模式会话数据
- 已将 Web 端持久化存储切换为 `sessionStorage`。
- 游客关闭浏览器后，本地任务与历史会清空。

✅ 6. 登录模式云端数据
- 已实现登录后任务与历史从 Supabase 拉取（覆盖本地会话态）。
- 已实现任务与历史变更自动回写 Supabase（节流同步）。
- 历史页面读取的是 store 数据，登录时来源为数据库快照。

7. 任务流联调与回归
- 验证主任务/并行任务、子任务、完成/取消在登录模式下正确入库。
- 验证游客与登录模式切换行为正确。
