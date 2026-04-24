# ClawdMate 进度记录

> 最后更新：2026-04-22  
> 依据：`docs/island-implementation.md`

## 本轮按需完成（最新）

1. 新增任务不替换主任务  
- `TaskInput` 增加 `keepCurrentActiveTask` 参数。  
- 从“添加任务”入口创建的新任务改为 `active` 立即开始（不抢占当前 `activeTaskId`）。  
- 当前主任务保持不变，新增任务作为并行任务存在。  

2. 主任务无子任务时隐藏子任务栏  
- `ExpandedView` 中改为条件渲染：`task.subTasks.length > 0` 才显示 `Subtasks` 区块。  

3. 添加任务弹框右上角改为“取消”  
- `App` 中弹框右上角按钮文案改为 `取消`。  
- 点击仅关闭弹框，表示取消本次新增任务，不影响当前主任务。  

## 相关改动文件

- `src/components/task-input/TaskInput.tsx`
- `src/components/task-input/SimpleMode.tsx`
- `src/components/task-input/StructuredMode.tsx`
- `src/components/dynamic-island/ExpandedView.tsx`
- `src/App.tsx`

## 验收清单（你现在可检查）

1. 展开灵动岛，点击“添加任务”，新建并开始后：当前主任务不被替换。  
2. 当前主任务没有子任务时：展开页不再出现 Subtasks 区块。  
3. 添加任务弹框右上角显示“取消”，点击后弹框关闭且不新增任务。  

## 校验结果

- `npm run lint` 通过（0 error，保留既有 3 条 hook warning）。  
