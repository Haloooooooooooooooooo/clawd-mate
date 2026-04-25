# Supabase Auth 与数据库初始化（ClawdMate）

> 日期：2026-04-25  
> 目标：支持邮箱注册/登录（无需邮箱验证）+ 用户任务/历史持久化

## 1) Auth 控制台配置

在 Supabase 控制台执行：

1. 打开 `Authentication -> Providers -> Email`
2. 开启 `Enable Email provider`
3. 关闭 `Confirm email`（注册后无需邮箱验证）
4. 保存配置

## 2) 本地环境变量

在 `web` 目录创建 `.env`（可参考 `.env.example`）：

```bash
VITE_SUPABASE_URL=你的项目URL
VITE_SUPABASE_ANON_KEY=你的匿名公钥
```

## 3) 数据库初始化

把 [`docs/supabase-schema.sql`](./supabase-schema.sql) 的 SQL 全量执行到 `SQL Editor`。

执行后会得到：

- `public.profiles`
- `public.tasks`
- `public.subtasks`
- `public.task_history`
- 全表 RLS 策略（仅允许当前登录用户访问自己的数据）

## 4) 验证

1. 用邮箱注册一个新账号（无需邮箱验证即成功）
2. 登录后执行简单查询确认可用：
   - `select * from public.tasks;`
3. 换另一个账号登录，确认看不到前一个账号的数据（RLS 生效）

