# ClawdMate MVP 实现计划

> 创建日期：2026-04-21
> 基于设计文档：`docs/superpowers/specs/2026-04-21-lumi-mvp-design.md`

---

## 一、MVP 目标

完成最核心的「输入任务 → 灵动岛计时 → 完成」流程。

**核心功能**：
- 任务输入（极简模式 + 结构模式）
- 灵动岛（收起/展开两种状态）
- 多任务并行
- 时间控制（暂停、结束、延长）
- 轻提醒（文字提示 + 关键节点通知）

---

## 二、技术栈

| 层级 | 技术 |
|------|------|
| 桌面端框架 | Tauri 2.x |
| 前端框架 | React 18 + TypeScript |
| 样式 | Tailwind CSS |
| 动画 | Framer Motion |
| 状态管理 | Zustand |
| 构建工具 | Vite |

---

## 三、项目结构

```
ClawdMate/
├── src-tauri/                    # Tauri 后端（Rust）
│   ├── src/
│   │   ├── main.rs              # Tauri 入口
│   │   ├── lib.rs               # 库定义
│   │   └── commands/            # Tauri 命令
│   │       ├── mod.rs
│   │       └── task.rs          # 任务相关命令
│   ├── tauri.conf.json          # Tauri 配置
│   └── Cargo.toml
│
├── src/                          # React 前端
│   ├── main.tsx                 # 入口
│   ├── App.tsx                  # 主应用
│   │
│   ├── components/              # UI 组件
│   │   ├── dynamic-island/      # 灵动岛组件
│   │   │   ├── DynamicIsland.tsx
│   │   │   ├── CollapsedView.tsx
│   │   │   ├── ExpandedView.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   └── TaskList.tsx
│   │   │
│   │   ├── task-input/          # 任务输入组件
│   │   │   ├── TaskInput.tsx
│   │   │   ├── SimpleMode.tsx
│   │   │   └── StructuredMode.tsx
│   │   │
│   │   └── common/              # 通用组件
│   │       ├── Button.tsx
│   │       └── Modal.tsx
│   │
│   ├── stores/                  # Zustand 状态管理
│   │   ├── taskStore.ts         # 任务状态
│   │   └── timerStore.ts        # 计时器状态
│   │
│   ├── hooks/                   # 自定义 Hooks
│   │   ├── useTimer.ts          # 计时器 Hook
│   │   └── useReminder.ts       # 提醒 Hook
│   │
│   ├── types/                   # TypeScript 类型定义
│   │   └── task.ts
│   │
│   ├── utils/                   # 工具函数
│   │   ├── time.ts              # 时间处理
│   │   └── notification.ts      # 通知处理
│   │
│   └── styles/                  # 样式文件
│       └── globals.css
│
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## 四、实现步骤

### 阶段 1：项目初始化

**步骤 1.1：创建 Tauri + React 项目**

```bash
# 使用 create-tauri-app 创建项目
npm create tauri-app@latest ClawdMate -- --template react-ts

# 进入项目目录
cd ClawdMate

# 安装依赖
npm install
```

**步骤 1.2：安装额外依赖**

```bash
# 动画
npm install framer-motion

# 状态管理
npm install zustand

# 工具库
npm install date-fns
npm install uuid
```

**步骤 1.3：配置 Tailwind CSS**

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**步骤 1.4：配置 Tauri 灵动岛窗口**

编辑 `src-tauri/tauri.conf.json`，配置灵动岛窗口：

```json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "ClawdMate",
        "width": 400,
        "height": 60,
        "resizable": false,
        "decorations": false,
        "transparent": true,
        "alwaysOnTop": true,
        "center": { "vertical": true }
      }
    ]
  }
}
```

---

### 阶段 2：类型定义与状态管理

**步骤 2.1：定义任务类型**

创建 `src/types/task.ts`：

```typescript
export type TaskMode = 'simple' | 'structured';
export type TaskStatus = 'pending' | 'active' | 'paused' | 'completed' | 'cancelled';

export interface SubTask {
  id: string;
  title: string;
  order: number;
  status: 'pending' | 'active' | 'completed';
  duration: number; // seconds
}

export interface Task {
  id: string;
  title: string;
  mode: TaskMode;
  status: TaskStatus;
  plannedDuration: number; // minutes
  actualDuration: number; // seconds
  startedAt: Date | null;
  completedAt: Date | null;
  subTasks: SubTask[];
  createdAt: Date;
}
```

**步骤 2.2：创建任务状态 Store**

创建 `src/stores/taskStore.ts`：

```typescript
import { create } from 'zustand';
import { Task } from '../types/task';

interface TaskStore {
  tasks: Task[];
  activeTaskId: string | null;

  // Actions
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  setActiveTask: (id: string | null) => void;
  pauseTask: (id: string) => void;
  resumeTask: (id: string) => void;
  completeTask: (id: string) => void;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  activeTaskId: null,

  addTask: (task) => set((state) => ({
    tasks: [...state.tasks, task]
  })),

  updateTask: (id, updates) => set((state) => ({
    tasks: state.tasks.map((t) =>
      t.id === id ? { ...t, ...updates } : t
    )
  })),

  removeTask: (id) => set((state) => ({
    tasks: state.tasks.filter((t) => t.id !== id),
    activeTaskId: state.activeTaskId === id ? null : state.activeTaskId
  })),

  setActiveTask: (id) => set({ activeTaskId: id }),

  pauseTask: (id) => get().updateTask(id, { status: 'paused' }),

  resumeTask: (id) => {
    get().updateTask(id, { status: 'active' });
    get().setActiveTask(id);
  },

  completeTask: (id) => get().updateTask(id, {
    status: 'completed',
    completedAt: new Date()
  })
}));
```

**步骤 2.3：创建计时器 Hook**

创建 `src/hooks/useTimer.ts`：

```typescript
import { useEffect, useRef, useState } from 'react';
import { useTaskStore } from '../stores/taskStore';

interface UseTimerReturn {
  elapsedSeconds: number;
  remainingSeconds: number;
  progress: number;
  isOvertime: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
}

export function useTimer(taskId: string): UseTimerReturn {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const task = useTaskStore((state) =>
    state.tasks.find((t) => t.id === taskId)
  );
  const updateTask = useTaskStore((state) => state.updateTask);

  const plannedSeconds = (task?.plannedDuration || 0) * 60;
  const remainingSeconds = Math.max(0, plannedSeconds - elapsedSeconds);
  const progress = plannedSeconds > 0 ? elapsedSeconds / plannedSeconds : 0;
  const isOvertime = elapsedSeconds > plannedSeconds;

  const start = () => {
    if (intervalRef.current) return;

    intervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  };

  const pause = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    updateTask(taskId, { actualDuration: elapsedSeconds });
  };

  const reset = () => {
    pause();
    setElapsedSeconds(0);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    elapsedSeconds,
    remainingSeconds,
    progress,
    isOvertime,
    start,
    pause,
    reset
  };
}
```

---

### 阶段 3：灵动岛组件

**步骤 3.1：创建收起状态组件**

创建 `src/components/dynamic-island/CollapsedView.tsx`：

```typescript
import { motion } from 'framer-motion';
import { Task } from '../../types/task';
import { ProgressBar } from './ProgressBar';

interface CollapsedViewProps {
  task: Task;
  progress: number;
  remainingSeconds: number;
  onExpand: () => void;
}

export function CollapsedView({
  task,
  progress,
  remainingSeconds,
  onExpand
}: CollapsedViewProps) {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return (
    <motion.div
      className="flex items-center gap-3 px-4 py-2 bg-black/80 rounded-full cursor-pointer"
      onClick={onExpand}
      whileHover={{ scale: 1.02 }}
    >
      {/* 小螃蟹占位 */}
      <div className="w-8 h-8 flex items-center justify-center text-2xl">
        🦀
      </div>

      {/* 进度条 */}
      <ProgressBar progress={progress} />

      {/* 剩余时间 */}
      <span className="text-white text-sm font-medium min-w-[60px]">
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>

      {/* 任务名称 */}
      <span className="text-white/80 text-sm truncate max-w-[120px]">
        {task.title}
      </span>
    </motion.div>
  );
}
```

**步骤 3.2：创建展开状态组件**

创建 `src/components/dynamic-island/ExpandedView.tsx`：

```typescript
import { motion } from 'framer-motion';
import { Task } from '../../types/task';
import { ProgressBar } from './ProgressBar';

interface ExpandedViewProps {
  task: Task;
  tasks: Task[];
  progress: number;
  remainingSeconds: number;
  elapsedSeconds: number;
  onPause: () => void;
  onComplete: () => void;
  onExtend: (minutes: number) => void;
  onSwitchTask: (taskId: string) => void;
  onCollapse: () => void;
}

export function ExpandedView({
  task,
  tasks,
  progress,
  remainingSeconds,
  elapsedSeconds,
  onPause,
  onComplete,
  onExtend,
  onSwitchTask,
  onCollapse
}: ExpandedViewProps) {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const elapsedMin = Math.floor(elapsedSeconds / 60);

  return (
    <motion.div
      className="bg-black/90 rounded-2xl p-4 min-w-[320px]"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      {/* 头部：小螃蟹 + 收起按钮 */}
      <div className="flex justify-between items-center mb-3">
        <div className="text-2xl">🦀</div>
        <button
          onClick={onCollapse}
          className="text-white/60 hover:text-white text-sm"
        >
          收起
        </button>
      </div>

      {/* 当前任务 */}
      <div className="mb-4">
        <h3 className="text-white font-medium mb-1">{task.title}</h3>
        <div className="flex items-center gap-2 text-white/70 text-sm">
          <span>进度：{Math.round(progress * 100)}%</span>
          <span>|</span>
          <span>剩余：{minutes}:{seconds.toString().padStart(2, '0')} / {task.plannedDuration}分钟</span>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={onPause}
          className="px-3 py-1.5 bg-white/20 text-white rounded-lg text-sm hover:bg-white/30"
        >
          暂停
        </button>
        <button
          onClick={onComplete}
          className="px-3 py-1.5 bg-green-500/80 text-white rounded-lg text-sm hover:bg-green-500"
        >
          结束
        </button>
        <button
          onClick={() => onExtend(5)}
          className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20"
        >
          +5min
        </button>
        <button
          onClick={() => onExtend(10)}
          className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20"
        >
          +10min
        </button>
      </div>

      {/* 并行任务列表 */}
      {tasks.length > 1 && (
        <div>
          <h4 className="text-white/60 text-xs mb-2">并行任务</h4>
          <div className="space-y-2">
            {tasks.filter(t => t.id !== task.id).map((t) => (
              <div
                key={t.id}
                onClick={() => onSwitchTask(t.id)}
                className="flex items-center gap-2 p-2 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10"
              >
                <div className="w-4 h-4 rounded-full border border-white/40" />
                <span className="text-white/80 text-sm flex-1 truncate">{t.title}</span>
                <span className="text-white/50 text-xs">{t.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
```

**步骤 3.3：创建灵动岛主组件**

创建 `src/components/dynamic-island/DynamicIsland.tsx`：

```typescript
import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTaskStore } from '../../stores/taskStore';
import { useTimer } from '../../hooks/useTimer';
import { CollapsedView } from './CollapsedView';
import { ExpandedView } from './ExpandedView';

export function DynamicIsland() {
  const [isExpanded, setIsExpanded] = useState(false);

  const tasks = useTaskStore((state) => state.tasks);
  const activeTaskId = useTaskStore((state) => state.activeTaskId);
  const activeTask = tasks.find((t) => t.id === activeTaskId);
  const updateTask = useTaskStore((state) => state.updateTask);
  const completeTask = useTaskStore((state) => state.completeTask);
  const setActiveTask = useTaskStore((state) => state.setActiveTask);

  const timer = useTimer(activeTaskId || '');

  if (!activeTask) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-black/80 rounded-full">
        <div className="text-2xl">🦀</div>
        <span className="text-white/60 text-sm">点击添加任务开始学习</span>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {isExpanded ? (
        <ExpandedView
          key="expanded"
          task={activeTask}
          tasks={tasks.filter(t => t.status === 'active' || t.status === 'paused')}
          progress={timer.progress}
          remainingSeconds={timer.remainingSeconds}
          elapsedSeconds={timer.elapsedSeconds}
          onPause={() => {
            timer.pause();
            updateTask(activeTaskId!, { status: 'paused' });
          }}
          onComplete={() => {
            timer.pause();
            completeTask(activeTaskId!);
          }}
          onExtend={(minutes) => {
            updateTask(activeTaskId!, {
              plannedDuration: activeTask.plannedDuration + minutes
            });
          }}
          onSwitchTask={(taskId) => {
            timer.pause();
            setActiveTask(taskId);
          }}
          onCollapse={() => setIsExpanded(false)}
        />
      ) : (
        <CollapsedView
          key="collapsed"
          task={activeTask}
          progress={timer.progress}
          remainingSeconds={timer.remainingSeconds}
          onExpand={() => setIsExpanded(true)}
        />
      )}
    </AnimatePresence>
  );
}
```

---

### 阶段 4：任务输入组件

**步骤 4.1：创建极简模式组件**

创建 `src/components/task-input/SimpleMode.tsx`：

```typescript
import { useState } from 'react';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { useTaskStore } from '../../stores/taskStore';
import { Task } from '../../types/task';

interface SimpleModeProps {
  onStart: (task: Task) => void;
}

export function SimpleMode({ onStart }: SimpleModeProps) {
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(25);

  const addTask = useTaskStore((state) => state.addTask);
  const setActiveTask = useTaskStore((state) => state.setActiveTask);

  const handleStart = () => {
    if (!title.trim()) return;

    const task: Task = {
      id: uuidv4(),
      title: title.trim(),
      mode: 'simple',
      status: 'active',
      plannedDuration: duration,
      actualDuration: 0,
      startedAt: new Date(),
      completedAt: null,
      subTasks: [],
      createdAt: new Date()
    };

    addTask(task);
    setActiveTask(task.id);
    onStart(task);
    setTitle('');
    setDuration(25);
  };

  return (
    <motion.div
      className="bg-white/10 rounded-xl p-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h3 className="text-white font-medium mb-3">新建任务</h3>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="任务名称..."
        className="w-full px-3 py-2 bg-white/10 rounded-lg text-white placeholder-white/40 mb-3 focus:outline-none focus:ring-2 focus:ring-white/30"
      />

      <div className="flex items-center gap-2 mb-4">
        <span className="text-white/60 text-sm">预设时间：</span>
        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          min={1}
          max={180}
          className="w-20 px-2 py-1 bg-white/10 rounded-lg text-white text-center focus:outline-none"
        />
        <span className="text-white/60 text-sm">分钟</span>
      </div>

      <button
        onClick={handleStart}
        disabled={!title.trim()}
        className="w-full py-2 bg-blue-500 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
      >
        开始学习 🦀
      </button>
    </motion.div>
  );
}
```

**步骤 4.2：创建任务输入主组件**

创建 `src/components/task-input/TaskInput.tsx`：

```typescript
import { useState } from 'framer-motion';
import { SimpleMode } from './SimpleMode';
import { Task } from '../../types/task';

interface TaskInputProps {
  onTaskStart: (task: Task) => void;
}

export function TaskInput({ onTaskStart }: TaskInputProps) {
  const [mode, setMode] = useState<'simple' | 'structured'>('simple');

  return (
    <div className="w-full max-w-md">
      {/* 模式切换 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('simple')}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            mode === 'simple'
              ? 'bg-white/20 text-white'
              : 'text-white/60 hover:text-white'
          }`}
        >
          极简模式
        </button>
        <button
          onClick={() => setMode('structured')}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            mode === 'structured'
              ? 'bg-white/20 text-white'
              : 'text-white/60 hover:text-white'
          }`}
        >
          结构模式
        </button>
      </div>

      {/* 模式内容 */}
      {mode === 'simple' ? (
        <SimpleMode onStart={onTaskStart} />
      ) : (
        <StructuredMode onStart={onTaskStart} />
      )}
    </div>
  );
}
```

---

### 阶段 5：提醒机制

**步骤 5.1：创建提醒 Hook**

创建 `src/hooks/useReminder.ts`：

```typescript
import { useEffect, useRef } from 'react';

interface ReminderConfig {
  onHalfTime?: () => void;
  onFiveMinutesLeft?: () => void;
  onTimeUp?: () => void;
}

export function useReminder(
  elapsedSeconds: number,
  plannedSeconds: number,
  config: ReminderConfig
) {
  const halfTimeTriggered = useRef(false);
  const fiveMinTriggered = useRef(false);
  const timeUpTriggered = useRef(false);

  const remainingSeconds = plannedSeconds - elapsedSeconds;

  useEffect(() => {
    // 时间过半
    if (
      config.onHalfTime &&
      elapsedSeconds >= plannedSeconds / 2 &&
      !halfTimeTriggered.current
    ) {
      halfTimeTriggered.current = true;
      config.onHalfTime();
    }

    // 剩余 5 分钟
    if (
      config.onFiveMinutesLeft &&
      remainingSeconds <= 300 &&
      remainingSeconds > 0 &&
      !fiveMinTriggered.current
    ) {
      fiveMinTriggered.current = true;
      config.onFiveMinutesLeft();
    }

    // 时间到
    if (
      config.onTimeUp &&
      remainingSeconds <= 0 &&
      !timeUpTriggered.current
    ) {
      timeUpTriggered.current = true;
      config.onTimeUp();
    }
  }, [elapsedSeconds, plannedSeconds, remainingSeconds]);

  // 重置提醒状态（用于延长时间后）
  const reset = () => {
    halfTimeTriggered.current = false;
    fiveMinTriggered.current = false;
    timeUpTriggered.current = false;
  };

  return { reset };
}
```

---

### 阶段 6：主应用整合

**步骤 6.1：创建主应用**

创建 `src/App.tsx`：

```typescript
import { useState } from 'react';
import { DynamicIsland } from './components/dynamic-island/DynamicIsland';
import { TaskInput } from './components/task-input/TaskInput';
import { Task } from './types/task';

export function App() {
  const [showInput, setShowInput] = useState(true);

  const handleTaskStart = (task: Task) => {
    setShowInput(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col items-center justify-center p-4">
      {/* 灵动岛 */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
        <DynamicIsland />
      </div>

      {/* 任务输入 */}
      {showInput && (
        <div className="mt-16">
          <TaskInput onTaskStart={handleTaskStart} />
        </div>
      )}
    </div>
  );
}
```

---

## 五、开发顺序

| 顺序 | 任务 | 预计时间 |
|------|------|----------|
| 1 | 项目初始化 + 依赖安装 | 15 分钟 |
| 2 | 类型定义 + 状态管理 | 20 分钟 |
| 3 | 灵动岛组件（收起/展开） | 45 分钟 |
| 4 | 任务输入组件 | 30 分钟 |
| 5 | 计时器 + 提醒机制 | 30 分钟 |
| 6 | 主应用整合 + 测试 | 20 分钟 |

**总计：约 2.5 小时**

---

## 六、验收标准

- [ ] 能够输入任务名称和预设时间
- [ ] 点击开始后灵动岛出现
- [ ] 进度条正确显示进度
- [ ] 点击灵动岛可展开/收起
- [ ] 暂停/结束按钮正常工作
- [ ] 延长时间功能正常
- [ ] 多任务切换正常
- [ ] 关键节点提醒正常触发（过半、剩5分钟、时间到）

---

*计划结束*
