# ClawdMate 灵动岛技术实现方案

> 基于 Open Island 设计语言，适配 React + Tailwind + Framer Motion 技术栈
> 创建时间：2026-04-22
> 最后更新：2026-04-22（修正样式差异，完全对齐 Open Island 参考）

---

## 一、组件架构

### 1.1 文件结构

```
src/components/dynamic-island/
├── DynamicIsland.tsx          # 主容器组件
├── CollapsedView.tsx          # 收起态
├── ExpandedView.tsx           # 展开态
├── ReminderPopup.tsx          # 提醒弹出组件
├── SubtaskList.tsx            # 子任务列表
├── ParallelTaskCard.tsx       # 并行任务卡片
├── ActionButtons.tsx          # 操作按钮组
├── ProgressBar.tsx            # 进度条
├── NotchShape.tsx             # 形状组件（SVG 实现上下不同圆角）
├── hooks/
│   ├── useDrag.ts             # 拖动逻辑
│   ├── useTimer.ts            # 计时器逻辑（已有）
│   └── useReminder.ts         # 提醒逻辑（已有）
└── styles/
    └── island.css             # 样式常量
```

### 1.2 组件层级

```
DynamicIsland
├── DraggableWrapper（拖动容器）
│   └── IslandContainer（主容器）
│       ├── NotchShape（背景形状，上下不同圆角）
│       ├── CollapsedView（收起态）
│       │   ├── PetIcon（宠物图标）
│       │   ├── TaskInfo（任务名 + 进度比例）
│       │   ├── ProgressBar
│       │   └── ActionButtons（悬浮显示）
│       │
│       ├── ReminderPopup（提醒弹出，条件渲染）
│       │
│       └── ExpandedView（展开态）
│           ├── SubtaskList
│           │   └── SubtaskItem × N
│           │       └── ActionButtons（跳过/下一项）
│           │
│           ├── ParallelTaskList
│           │   └── ParallelTaskCard × N
│           │       ├── TaskInfo + ProgressBar
│           │       ├── ActionButtons
│           │       └── SubtaskList（展开后显示）
│           │
│           └── BottomActions
│               ├── AddTaskButton
│               └── GoHomeButton
```

---

## 1.3 布局示意图（ASCII）

### 收起态（紧凑迷你版）

```
┌──────────────────────────────────────────────────────────────────┐
│  🦀   写周报                           20/60min    [⏸] [✓]     │
│       ████████████░░░░░░░░░░░░░░░░░░░░░                        │
└──────────────────────────────────────────────────────────────────┘
   ↑左    ↑任务名                          ↑进度比例   ↑两按钮（悬浮显示）
   宠物    ↑进度条（下排）
```

**尺寸：宽度 280px，高度 36-40px**

---

### 收起态 + 提醒弹出

```
┌──────────────────────────────────────────────────────────────────┐
│  🦀   写周报                           30/60min    [⏸] [✓]     │
│       ████████████████████░░░░░░░░░░░░░                          │
├──────────────────────────────────────────────────────────────────┤
│  ⏰ 任务过半，注意时间                                            │  ← 1.5秒后自动消失
└──────────────────────────────────────────────────────────────────┘
```

---

### 展开态

```
┌──────────────────────────────────────────────────────────────────┐
│  🦀   写周报                           20/60min    [⏸] [✓]     │
│       ████████████░░░░░░░░░░░░░░░░░░░░░                          │
├──────────────────────────────────────────────────────────────────┤
│  📋 子任务                                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ✓ 收集数据                                         已完成  │  │
│  │ ✓ 整理大纲                                         已完成  │  │
│  │ ● 撰写正文                               进行中  [跳过][✓下一项] │  │
│  │ ○ 审核修改                                         未开始  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  📑 并行任务                                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ● 回复邮件                            15/30min      [⏸][✓] [▶] │  │
│  │   ████████████████░░░░░░░░░░░░░░░░░░░░                    │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ○ 整理桌面                            0/20min        [⏸][✓] [▶] │  │
│  │   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  [➕ 添加任务]                               [🏠 回到主页]       │
└──────────────────────────────────────────────────────────────────┘
```

**尺寸：宽度 420px**

---

### 并行任务展开后（点击 ▶ 展开）

```
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ▼ 回复邮件                            15/30min      [⏸][✓] [▼] │  │
│  │   ████████████████░░░░░░░░░░░░░░░░░░░░                    │  │
│  │   ┌──────────────────────────────────────────────────────┐ │  │
│  │   │ ✓ 收件整理                                    已完成 │ │  │
│  │   │ ● 起草回复                          进行中  [跳过][✓]  │ │  │
│  │   │ ○ 发送邮件                                    未开始 │ │  │
│  │   └──────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
```

---

### 1.4 按钮行为汇总

| 按钮 | 位置 | 行为 |
|------|------|------|
| 暂停 ⏸ | 收起态/并行任务 | 暂停计时 |
| 完成 ✓ | 收起态/并行任务 | 标记任务完成 |
| 取消 ✕ | 收起态（悬浮在按钮上时出现） | 取消任务 |
| 跳过 | 子任务（进行中项） | 跳过当前子任务，下一个变进行中 |
| ✓下一项 | 子任务（进行中项） | 当前标记完成，下一个变进行中 |
| 展开 ▶ | 并行任务 | 展开子任务列表 |
| 添加任务 | 底部 | 打开添加任务界面 |
| 回到主页 | 底部 | 打开浏览器跳转网址 |

---

## 二、样式规范（完全对齐 Open Island 参考）

### 2.1 设计令牌（Design Tokens）

```css
/* src/components/dynamic-island/styles/island.css */

:root {
  /* ===== 尺寸 ===== */
  --island-collapsed-height: 38px;
  --island-collapsed-min-width: 280px;
  --island-expanded-min-width: 360px;
  --island-expanded-max-width: 420px;
  --island-expanded-max-height: 520px;

  /* ===== 圆角（对齐 Open Island NotchShape）===== */
  /* 收起态：顶部小圆角贴合刘海边缘，底部大圆角呈胶囊形 */
  --island-radius-collapsed-top: 6px;
  --island-radius-collapsed-bottom: 20px;
  /* 展开态：更大的圆角 */
  --island-radius-expanded-top: 22px;
  --island-radius-expanded-bottom: 28px;
  /* 卡片圆角 */
  --island-radius-card: 22px;
  --island-radius-card-actionable: 24px;
  /* 按钮圆角 */
  --island-radius-button: 14px;

  /* ===== 颜色 - 背景 ===== */
  --island-bg: #000000;
  --island-bg-card: rgba(255, 255, 255, 0.04);
  --island-bg-card-hover: rgba(255, 255, 255, 0.06);
  --island-bg-button: rgba(255, 255, 255, 0.08);
  --island-bg-button-hover: rgba(255, 255, 255, 0.12);

  /* ===== 颜色 - 边框（区分收起/展开态）===== */
  --island-border-collapsed: rgba(255, 255, 255, 0.04);
  --island-border-expanded: rgba(255, 255, 255, 0.07);
  --island-border-card: rgba(255, 255, 255, 0.06);

  /* ===== 颜色 - 文字 ===== */
  --island-text-primary: rgba(255, 255, 255, 0.9);
  --island-text-secondary: rgba(255, 255, 255, 0.6);
  --island-text-tertiary: rgba(255, 255, 255, 0.35);
  --island-text-weak: rgba(255, 255, 255, 0.25);

  /* ===== 颜色 - 状态（完全对齐 Open Island）===== */
  --island-color-running: #6E9FFF;     /* working blue */
  --island-color-idle: #42E86B;        /* idle green */
  --island-color-completed: #49DB76;   /* success green */
  --island-color-paused: #FFB347;      /* 暂停橙（新增，Open Island 无此状态）*/
  --island-color-warning: #FF6B6B;     /* 警告红 */

  /* ===== 阴影（对齐 Open Island 模糊半径）===== */
  --island-shadow-collapsed: 0 18px 60px rgba(0, 0, 0, 0.48);
  --island-shadow-expanded: 0 24px 80px rgba(0, 0, 0, 0.52);

  /* ===== 间距（对齐 Open Island）===== */
  --island-padding-x: 18px;
  --island-padding-y: 14px;
  --island-gap-icon-text: 14px;
  --island-gap-buttons: 8px;
  --island-gap-rows: 6px;

  /* ===== 动画 ===== */
  --island-transition-fast: 150ms ease;
  --island-transition-normal: 250ms ease;
  /* Spring 动画参数：response=0.42, dampingFraction=0.8 */
}
```

### 2.2 Tailwind 类名映射（修正后）

```typescript
// 常用样式组合
export const islandStyles = {
  // 主容器 - 收起态
  containerCollapsed: `
    fixed top-4 left-1/2 -translate-x-1/2
    bg-black
    border border-white/[0.04]
    shadow-[0_18px_60px_rgba(0,0,0,0.48)]
    backdrop-blur-xl
    cursor-pointer
    select-none
    z-50
    h-[38px] min-w-[280px] px-[18px] py-[10px]
    /* 圆角通过 NotchShape SVG 实现 */
  `,

  // 主容器 - 展开态
  containerExpanded: `
    fixed top-4 left-1/2 -translate-x-1/2
    bg-black
    border border-white/[0.07]
    shadow-[0_24px_80px_rgba(0,0,0,0.52)]
    backdrop-blur-xl
    cursor-default
    select-none
    z-50
    min-w-[360px] max-w-[420px] max-h-[520px]
    overflow-hidden
  `,

  // 卡片
  card: `
    bg-white/[0.04] rounded-[22px] p-[14px]
    border border-white/[0.06]
  `,

  // 卡片 - 可操作
  cardActionable: `
    bg-white/[0.04] rounded-[24px] p-[14px]
    border border-white/[0.06]
  `,

  // 按钮
  button: `
    w-[22px] h-[22px] rounded-full
    bg-white/[0.08]
    flex items-center justify-center
    transition-all duration-150
    hover:bg-white/[0.12]
    hover:scale-105
  `,

  // 进度条
  progressBar: `
    h-[6px] rounded-full
    bg-white/[0.08]
    overflow-hidden
  `,

  // 进度条填充
  progressBarFill: `
    h-full rounded-full
    transition-all duration-300
  `,
};

// 字体样式
export const fontStyles = {
  // 任务标题
  taskTitle: 'text-[14px] font-semibold text-white/[0.9]',
  // 进度比例
  progressRatio: 'text-[12px] font-medium text-white/[0.6]',
  // 子任务名
  subtaskName: 'text-[11.5px] font-medium text-white/[0.8]',
  // 状态文字
  statusText: 'text-[11px] font-medium text-white/[0.35]',
  // 按钮文字
  buttonText: 'text-[11.5px] font-semibold',
  // 区块标题
  sectionTitle: 'text-[11px] font-semibold text-white/[0.35] uppercase tracking-[0.15em]',
};
```

---

## 三、核心组件实现

### 3.1 主容器 DynamicIsland.tsx

```typescript
import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CollapsedView } from './CollapsedView';
import { ExpandedView } from './ExpandedView';
import { ReminderPopup } from './ReminderPopup';
import { NotchShape } from './NotchShape';
import { useDrag } from './hooks/useDrag';
import { useTaskStore } from '../../stores/taskStore';
import { useTimer } from '../../hooks/useTimer';
import { useReminder } from '../../hooks/useReminder';

export function DynamicIsland() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const { isDragging, handleDragStart, handleDragEnd } = useDrag();

  const tasks = useTaskStore((state) => state.tasks);
  const activeTaskId = useTaskStore((state) => state.activeTaskId);
  const activeTask = tasks.find((t) => t.id === activeTaskId);

  const timer = useTimer({
    plannedDuration: activeTask?.plannedDuration || 25,
    onTick: (elapsed) => { /* ... */ }
  });

  const reminder = useReminder(
    timer.elapsedSeconds,
    (activeTask?.plannedDuration || 25) * 60,
    {
      onHalfTime: () => showReminder('任务过半，注意时间'),
      onQuarterLeft: () => showReminder('即将结束，准备收尾'),
      onTimeUp: () => showReminder('时间到！', { requireAction: true }),
    }
  );

  // 点击外部收起
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dynamic-island')) {
        setIsExpanded(false);
      }
    };

    // 延迟添加监听，避免立即触发
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isExpanded]);

  // 动画配置（Spring: response=0.42, dampingFraction=0.8）
  const containerVariants = {
    collapsed: {
      width: 280,
      transition: { type: 'spring', stiffness: 400, damping: 30 }
    },
    expanded: {
      width: 420,
      transition: { type: 'spring', stiffness: 400, damping: 30 }
    }
  };

  if (!activeTask) {
    return null; // 或显示空闲状态
  }

  const borderOpacity = isExpanded ? 0.07 : 0.04;
  const shadow = isExpanded 
    ? '0 24px 80px rgba(0,0,0,0.52)' 
    : '0 18px 60px rgba(0,0,0,0.48)';

  return (
    <motion.div
      className="fixed top-4 z-50"
      drag="x"
      dragConstraints={{ left: -window.innerWidth / 2 + 210, right: window.innerWidth / 2 - 210 }}
      dragElastic={0}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      whileDrag={{ cursor: 'grabbing', scale: 1.02 }}
      style={{ left: '50%', x: '-50%' }}
    >
      <motion.div
        className="dynamic-island relative bg-black backdrop-blur-xl overflow-hidden cursor-pointer"
        style={{
          border: `1px solid rgba(255,255,255,${borderOpacity})`,
          boxShadow: shadow,
        }}
        variants={containerVariants}
        initial="collapsed"
        animate={isExpanded ? 'expanded' : 'collapsed'}
        onClick={() => !isExpanded && setIsExpanded(true)}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* NotchShape 背景（上下不同圆角）*/}
        <NotchShape isExpanded={isExpanded} />

        {/* 收起态 - 始终显示 */}
        <CollapsedView
          task={activeTask}
          progress={timer.progress}
          remainingSeconds={timer.remainingSeconds}
          isRunning={timer.isRunning}
          showButtons={isHovering && !isExpanded}
          onPause={handlePause}
          onComplete={handleComplete}
        />

        {/* 提醒弹出 */}
        <AnimatePresence>
          {reminder.isVisible && (
            <ReminderPopup
              message={reminder.message}
              requireAction={reminder.requireAction}
              onDismiss={() => reminder.hide()}
              onExtend={handleExtend}
            />
          )}
        </AnimatePresence>

        {/* 展开态内容 */}
        <AnimatePresence>
          {isExpanded && (
            <ExpandedView
              task={activeTask}
              tasks={tasks}
              progress={timer.progress}
              remainingSeconds={timer.remainingSeconds}
              onCollapse={() => setIsExpanded(false)}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
```

### 3.2 NotchShape 形状组件

```typescript
import { motion } from 'framer-motion';

interface NotchShapeProps {
  isExpanded: boolean;
}

export function NotchShape({ isExpanded }: NotchShapeProps) {
  // 收起态：顶部 6px，底部 20px
  // 展开态：顶部 22px，底部 28px
  const topRadius = isExpanded ? 22 : 6;
  const bottomRadius = isExpanded ? 28 : 20;
  const height = isExpanded ? 520 : 38;

  // SVG path 实现 NotchShape
  const generatePath = (width: number, topR: number, botR: number, h: number) => {
    const topRClamped = Math.min(topR, width / 4, h / 4);
    const botRClamped = Math.min(botR, width / 4, h / 2);

    return `
      M 0 0
      Q ${topRClamped} 0, ${topRClamped} ${topRClamped}
      L ${topRClamped} ${h - botRClamped}
      Q ${topRClamped} ${h}, ${topRClamped + botRClamped} ${h}
      L ${width - topRClamped - botRClamped} ${h}
      Q ${width - topRClamped} ${h}, ${width - topRClamped} ${h - botRClamped}
      L ${width - topRClamped} ${topRClamped}
      Q ${width - topRClamped} 0, ${width} 0
      Z
    `;
  };

  const width = isExpanded ? 420 : 280;

  return (
    <motion.svg
      className="absolute inset-0 pointer-events-none"
      width={width}
      height={height}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
    >
      <motion.path
        d={generatePath(width, topRadius, bottomRadius, height)}
        fill="#000000"
        initial={{ d: generatePath(280, 6, 20, 38) }}
        animate={{ d: generatePath(width, topRadius, bottomRadius, height) }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      />
    </motion.svg>
  );
}
```

### 3.3 收起态 CollapsedView.tsx

```typescript
import { motion, AnimatePresence } from 'framer-motion';
import type { Task } from '../../types/task';
import { ProgressBar } from './ProgressBar';

interface CollapsedViewProps {
  task: Task;
  progress: number;
  remainingSeconds: number;
  isRunning: boolean;
  showButtons: boolean;
  onPause: () => void;
  onComplete: () => void;
  onCancel?: () => void;
}

export function CollapsedView({
  task,
  progress,
  remainingSeconds,
  isRunning,
  showButtons,
  onPause,
  onComplete,
  onCancel,
}: CollapsedViewProps) {
  const progressText = `${task.actualDuration || 0}/${task.plannedDuration}min`;

  return (
    <div className="relative flex items-center px-[18px] py-[10px] min-w-[280px]">
      {/* 左侧：宠物图标 */}
      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-base mr-[14px]">
        🦀
      </div>

      {/* 中间：任务信息 */}
      <div className="flex-1 min-w-0">
        {/* 上排：任务名 + 进度比例 */}
        <div className="flex items-center justify-between gap-[8px] mb-[4px]">
          <span className="text-[14px] font-semibold text-white/[0.9] truncate">
            {task.title}
          </span>
          <span className="text-[12px] font-medium text-white/[0.6] flex-shrink-0">
            {progressText}
          </span>
        </div>

        {/* 下排：进度条 */}
        <ProgressBar progress={progress} height={4} />
      </div>

      {/* 右侧：按钮组（悬浮显示，对齐 Open Island 按钮尺寸 22px）*/}
      <AnimatePresence>
        {showButtons && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-[8px] ml-[14px]"
          >
            <button
              onClick={(e) => { e.stopPropagation(); onPause(); }}
              className="w-[22px] h-[22px] rounded-full bg-white/[0.08] flex items-center justify-center text-[10px] hover:bg-white/[0.12] transition-colors"
              aria-label={isRunning ? '暂停' : '继续'}
            >
              {isRunning ? '⏸' : '▶'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onComplete(); }}
              className="w-[22px] h-[22px] rounded-full bg-white/[0.08] flex items-center justify-center text-[10px] hover:bg-white/[0.12] transition-colors"
              aria-label="完成"
            >
              ✓
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

### 3.4 提醒弹出 ReminderPopup.tsx

```typescript
import { motion } from 'framer-motion';
import { useEffect } from 'react';

interface ReminderPopupProps {
  message: string;
  requireAction?: boolean;
  onDismiss: () => void;
  onExtend?: (minutes: number) => void;
}

export function ReminderPopup({
  message,
  requireAction = false,
  onDismiss,
  onExtend,
}: ReminderPopupProps) {
  // 快速自动消失（1.5秒）
  useEffect(() => {
    if (!requireAction) {
      const timer = setTimeout(onDismiss, 1500);
      return () => clearTimeout(timer);
    }
  }, [requireAction, onDismiss]);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      <div className="px-[18px] py-[10px] border-t border-white/[0.04]">
        <div className="flex items-center gap-[8px]">
          <span className="text-base">⏰</span>
          <span className="text-[13px] font-medium text-white/[0.85]">{message}</span>

          {/* 需要操作时显示按钮 */}
          {requireAction && (
            <div className="flex items-center gap-[8px] ml-auto">
              <button
                onClick={onDismiss}
                className="px-[12px] py-[8px] text-[11.5px] font-semibold rounded-full bg-white/[0.08] text-white/[0.7] hover:bg-white/[0.12] transition-colors"
              >
                完成
              </button>
              <button
                onClick={() => onExtend?.(5)}
                className="px-[12px] py-[8px] text-[11.5px] font-semibold rounded-full bg-white/[0.08] text-white/[0.7] hover:bg-white/[0.12] transition-colors"
              >
                +5min
              </button>
              <button
                onClick={() => onExtend?.(10)}
                className="px-[12px] py-[8px] text-[11.5px] font-semibold rounded-full bg-white/[0.08] text-white/[0.7] hover:bg-white/[0.12] transition-colors"
              >
                +10min
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
```

### 3.5 展开态 ExpandedView.tsx

```typescript
import { motion } from 'framer-motion';
import type { Task } from '../../types/task';
import { SubtaskList } from './SubtaskList';
import { ParallelTaskCard } from './ParallelTaskCard';

interface ExpandedViewProps {
  task: Task;
  tasks: Task[];
  progress: number;
  remainingSeconds: number;
  onCollapse: () => void;
}

export function ExpandedView({
  task,
  tasks,
  progress,
  remainingSeconds,
  onCollapse,
}: ExpandedViewProps) {
  const otherTasks = tasks.filter((t) => t.id !== task.id && t.status !== 'completed');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="border-t border-white/[0.04] px-[18px] py-[14px]"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 子任务区 */}
      {task.subtasks && task.subtasks.length > 0 && (
        <div className="mb-[14px]">
          <div className="text-[11px] font-semibold text-white/[0.35] uppercase tracking-[0.15em] mb-[8px] flex items-center gap-[6px]">
            📋 子任务
          </div>
          <SubtaskList
            subtasks={task.subtasks}
            onSkip={handleSkipSubtask}
            onComplete={handleCompleteSubtask}
          />
        </div>
      )}

      {/* 并行任务区 */}
      {otherTasks.length > 0 && (
        <div className="mb-[14px]">
          <div className="text-[11px] font-semibold text-white/[0.35] uppercase tracking-[0.15em] mb-[8px] flex items-center gap-[6px]">
            📑 并行任务
          </div>
          <div className="space-y-[6px]">
            {otherTasks.map((t) => (
              <ParallelTaskCard key={t.id} task={t} />
            ))}
          </div>
        </div>
      )}

      {/* 底部按钮 */}
      <div className="flex items-center justify-between pt-[14px] border-t border-white/[0.04]">
        <button
          className="flex items-center gap-[8px] px-[14px] py-[10px] rounded-[14px] bg-white/[0.08] text-[11.5px] font-semibold text-white/[0.7] hover:bg-white/[0.12] transition-colors"
          onClick={handleAddTask}
        >
          <span>➕</span>
          <span>添加任务</span>
        </button>
        <button
          className="flex items-center gap-[8px] px-[14px] py-[10px] rounded-[14px] bg-white/[0.08] text-[11.5px] font-semibold text-white/[0.7] hover:bg-white/[0.12] transition-colors"
          onClick={() => window.open(HOME_URL, '_blank')}
        >
          <span>🏠</span>
          <span>回到主页</span>
        </button>
      </div>
    </motion.div>
  );
}
```

### 3.6 子任务列表 SubtaskList.tsx

```typescript
import type { Subtask } from '../../types/task';

interface SubtaskListProps {
  subtasks: Subtask[];
  onSkip: (subtaskId: string) => void;
  onComplete: (subtaskId: string) => void;
}

export function SubtaskList({ subtasks, onSkip, onComplete }: SubtaskListProps) {
  return (
    <div className="bg-white/[0.04] rounded-[22px] p-[14px] space-y-[6px]">
      {subtasks.map((subtask) => (
        <SubtaskItem
          key={subtask.id}
          subtask={subtask}
          onSkip={() => onSkip(subtask.id)}
          onComplete={() => onComplete(subtask.id)}
        />
      ))}
    </div>
  );
}

function SubtaskItem({
  subtask,
  onSkip,
  onComplete,
}: {
  subtask: Subtask;
  onSkip: () => void;
  onComplete: () => void;
}) {
  const isInProgress = subtask.status === 'in_progress';

  const statusIcon = {
    completed: '✓',
    in_progress: '●',
    pending: '○',
    skipped: '○',
  }[subtask.status];

  const statusText = {
    completed: '已完成',
    in_progress: '进行中',
    pending: '未开始',
    skipped: '已跳过',
  }[subtask.status];

  return (
    <div className="flex items-center gap-[14px] py-[10px] px-[14px] rounded-[14px] hover:bg-white/[0.03] transition-colors">
      {/* 状态图标 */}
      <span className={`w-4 text-center ${
        subtask.status === 'completed' ? 'text-[#49DB76]' :
        subtask.status === 'in_progress' ? 'text-[#6E9FFF]' :
        subtask.status === 'skipped' ? 'text-white/[0.25]' :
        'text-white/[0.35]'
      }`}>
        {statusIcon}
      </span>

      {/* 任务名 */}
      <span className={`flex-1 text-[11.5px] font-medium truncate ${
        subtask.status === 'completed'
          ? 'text-white/[0.4] line-through'
          : subtask.status === 'skipped'
          ? 'text-white/[0.25] line-through'
          : 'text-white/[0.8]'
      }`}>
        {subtask.title}
      </span>

      {/* 状态 + 按钮 */}
      <div className="flex items-center gap-[8px]">
        <span className="text-[11px] font-medium text-white/[0.35]">{statusText}</span>

        {/* 进行中时显示操作按钮 */}
        {isInProgress && (
          <>
            <button
              onClick={onSkip}
              className="px-[10px] py-[4px] text-[11px] font-medium rounded-full bg-white/[0.08] text-white/[0.6] hover:bg-white/[0.12] transition-colors"
            >
              跳过
            </button>
            <button
              onClick={onComplete}
              className="px-[10px] py-[4px] text-[11px] font-medium rounded-full bg-[#6E9FFF]/20 text-[#6E9FFF] hover:bg-[#6E9FFF]/30 transition-colors"
            >
              ✓下一项
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

### 3.7 并行任务卡片 ParallelTaskCard.tsx

```typescript
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Task } from '../../types/task';
import { ProgressBar } from './ProgressBar';
import { SubtaskList } from './SubtaskList';

interface ParallelTaskCardProps {
  task: Task;
  onPause?: () => void;
  onComplete?: () => void;
  onSwitch?: () => void;
}

export function ParallelTaskCard({
  task,
  onPause,
  onComplete,
  onSwitch,
}: ParallelTaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const progress = task.actualDuration / task.plannedDuration;
  const progressText = `${task.actualDuration || 0}/${task.plannedDuration}min`;

  const statusIcon = {
    active: '●',
    paused: '⏸',
    pending: '○',
    completed: '✓',
  }[task.status];

  const statusColor = {
    active: 'text-[#6E9FFF]',
    paused: 'text-[#FFB347]',
    pending: 'text-white/[0.35]',
    completed: 'text-[#49DB76]',
  }[task.status];

  return (
    <div
      className="bg-white/[0.04] rounded-[22px] p-[14px] border border-white/[0.06]"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* 主信息行 */}
      <div className="flex items-center gap-[14px]">
        {/* 状态图标 */}
        <span className={`w-4 text-center ${statusColor}`}>
          {statusIcon}
        </span>

        {/* 任务名 + 进度 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-[8px] mb-[4px]">
            <span className="text-[14px] font-semibold text-white/[0.9] truncate">{task.title}</span>
            <span className="text-[12px] font-medium text-white/[0.6]">{progressText}</span>
          </div>
          <ProgressBar progress={progress} height={4} />
        </div>

        {/* 按钮组 */}
        <div className="flex items-center gap-[8px]">
          {/* 悬浮显示操作按钮（对齐 Open Island 按钮尺寸 22px）*/}
          <AnimatePresence>
            {isHovering && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-[8px]"
              >
                <button
                  onClick={onPause}
                  className="w-[22px] h-[22px] rounded-full bg-white/[0.08] flex items-center justify-center text-[10px] hover:bg-white/[0.12] transition-colors"
                  aria-label={task.status === 'active' ? '暂停' : '继续'}
                >
                  {task.status === 'active' ? '⏸' : '▶'}
                </button>
                <button
                  onClick={onComplete}
                  className="w-[22px] h-[22px] rounded-full bg-white/[0.08] flex items-center justify-center text-[10px] hover:bg-white/[0.12] transition-colors"
                  aria-label="完成"
                >
                  ✓
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 展开/收起按钮 */}
          {task.subtasks && task.subtasks.length > 0 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-[22px] h-[22px] rounded-full bg-white/[0.08] flex items-center justify-center text-[10px] hover:bg-white/[0.12] transition-colors"
              aria-label={isExpanded ? '收起' : '展开'}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
        </div>
      </div>

      {/* 展开的子任务 */}
      <AnimatePresence>
        {isExpanded && task.subtasks && task.subtasks.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden mt-[10px]"
          >
            <SubtaskList
              subtasks={task.subtasks}
              onSkip={(id) => {/* ... */}}
              onComplete={(id) => {/* ... */}}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

### 3.8 进度条 ProgressBar.tsx

```typescript
interface ProgressBarProps {
  progress: number; // 0-1
  height?: number;
  className?: string;
  color?: string;
}

export function ProgressBar({
  progress,
  height = 6,
  className = '',
  color = '#6E9FFF',
}: ProgressBarProps) {
  const clampedProgress = Math.min(1, Math.max(0, progress));

  return (
    <div
      className={`bg-white/[0.08] rounded-full overflow-hidden ${className}`}
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{
          width: `${clampedProgress * 100}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}
```

### 3.9 拖动 Hook useDrag.ts

```typescript
import { useState, useCallback } from 'react';

export function useDrag() {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    // 不记住位置，每次打开回到屏幕正中央
  }, []);

  return {
    isDragging,
    handleDragStart,
    handleDragEnd,
  };
}
```

---

## 四、数据模型更新

### 4.1 Task 类型扩展

```typescript
// src/types/task.ts

export type TaskStatus = 'pending' | 'active' | 'paused' | 'completed';

export type SubtaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface Subtask {
  id: string;
  title: string;
  status: SubtaskStatus;
  order: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  plannedDuration: number; // 分钟
  actualDuration: number; // 已用分钟
  subtasks?: Subtask[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}
```

### 4.2 Store 方法扩展

```typescript
// src/stores/taskStore.ts

interface TaskStore {
  // 现有方法
  tasks: Task[];
  activeTaskId: string | null;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  completeTask: (id: string) => void;
  setActiveTask: (id: string | null) => void;

  // 新增方法
  completeSubtask: (taskId: string, subtaskId: string) => void;
  skipSubtask: (taskId: string, subtaskId: string) => void;
  getActiveSubtask: (taskId: string) => Subtask | undefined;
  activateNextSubtask: (taskId: string) => void;
}
```

---

## 五、动画配置

### 5.1 Framer Motion 动画预设

```typescript
// src/components/dynamic-island/animations.ts

export const animations = {
  // 收起态 <-> 展开态（Spring: response=0.42, dampingFraction=0.8）
  island: {
    collapsed: {
      width: 280,
      transition: { type: 'spring', stiffness: 400, damping: 30 }
    },
    expanded: {
      width: 420,
      transition: { type: 'spring', stiffness: 400, damping: 30 }
    }
  },

  // 按钮显示/隐藏
  buttons: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
    transition: { duration: 0.15 }
  },

  // 提醒弹出
  reminder: {
    initial: { height: 0, opacity: 0 },
    animate: { height: 'auto', opacity: 1 },
    exit: { height: 0, opacity: 0 },
    transition: { duration: 0.22, ease: 'easeOut' }
  },

  // 子任务展开
  subtaskExpand: {
    initial: { height: 0, opacity: 0 },
    animate: { height: 'auto', opacity: 1 },
    exit: { height: 0, opacity: 0 },
    transition: { duration: 0.2, ease: 'easeOut' }
  },

  // 卡片悬停
  cardHover: {
    scale: 1.01,
    backgroundColor: 'rgba(255,255,255,0.06)',
    transition: { duration: 0.15 }
  },

  // 拖动
  drag: {
    cursor: 'grabbing',
    scale: 1.02,
    transition: { duration: 0.1 }
  }
};
```

---

## 六、事件处理

### 6.1 子任务操作

```typescript
// 在 taskStore.ts 中实现

completeSubtask: (taskId: string, subtaskId: string) => {
  const task = tasks.find(t => t.id === taskId);
  if (!task?.subtasks) return;

  const subtaskIndex = task.subtasks.findIndex(s => s.id === subtaskId);
  if (subtaskIndex === -1) return;

  // 标记当前完成
  task.subtasks[subtaskIndex].status = 'completed';

  // 激活下一个
  const nextSubtask = task.subtasks[subtaskIndex + 1];
  if (nextSubtask && nextSubtask.status === 'pending') {
    nextSubtask.status = 'in_progress';
  }

  updateTask(taskId, { subtasks: [...task.subtasks] });
},

skipSubtask: (taskId: string, subtaskId: string) => {
  const task = tasks.find(t => t.id === taskId);
  if (!task?.subtasks) return;

  const subtaskIndex = task.subtasks.findIndex(s => s.id === subtaskId);
  if (subtaskIndex === -1) return;

  // 标记跳过
  task.subtasks[subtaskIndex].status = 'skipped';

  // 激活下一个
  const nextSubtask = task.subtasks[subtaskIndex + 1];
  if (nextSubtask && nextSubtask.status === 'pending') {
    nextSubtask.status = 'in_progress';
  }

  updateTask(taskId, { subtasks: [...task.subtasks] });
},
```

---

## 七、样式细节（完全对齐 Open Island）

### 7.1 状态颜色映射

| 状态 | 颜色 | 十六进制 | 用途 |
|------|------|----------|------|
| 进行中 | 蓝色 | `#6E9FFF` | working blue，进度条、状态图标 |
| 空闲 | 绿色 | `#42E86B` | idle green |
| 已完成 | 绿色 | `#49DB76` | success green |
| 暂停 | 橙色 | `#FFB347` | 暂停态（新增） |
| 警告 | 红色 | `#FF6B6B` | 时间警告 |

### 7.2 字体规范

| 元素 | 字号 | 字重 | 颜色透明度 | 对齐状态 |
|------|------|------|------------|----------|
| 任务标题 | 14px | 600 (semibold) | 0.9 | ✅ 一致 |
| 进度比例 | 12px | 500 (medium) | 0.6 | ✅ 已修正 |
| 子任务名 | 11.5px | 500 (medium) | 0.8 | ✅ 已修正 |
| 状态文字 | 11px | 500 (medium) | 0.35 | ✅ 已修正 |
| 按钮文字 | 11.5px | 600 (semibold) | 0.7 | ✅ 已修正 |
| 区块标题 | 11px | 600 (semibold) | 0.35, uppercase, tracking 0.15em | ✅ 已修正 |

### 7.3 圆角规范

| 元素 | 圆角 | 对齐状态 |
|------|------|----------|
| 收起态整体 | 顶部 6px，底部 20px | ✅ 已修正（NotchShape） |
| 展开态整体 | 顶部 22px，底部 28px | ✅ 已修正（NotchShape） |
| 卡片 | 22px | ✅ 已修正 |
| 可操作卡片 | 24px | ✅ 已修正 |
| 按钮 | 14px 或全圆 | ✅ 一致 |

### 7.4 阴影规范

| 状态 | 阴影 | 对齐状态 |
|------|------|----------|
| 收起态 | `0 18px 60px rgba(0,0,0,0.48)` | ✅ 已修正 |
| 展开态 | `0 24px 80px rgba(0,0,0,0.52)` | ✅ 已修正 |

### 7.5 间距规范

| 位置 | 数值 | 对齐状态 |
|------|------|----------|
| 内容水平边距 | 18px | ✅ 已修正 |
| 内容垂直边距 | 14px | ✅ 已修正 |
| 图标与文字间距 | 14px | ✅ 已修正 |
| 按钮间距 | 8px | ✅ 已修正 |
| 行间距 | 6px | ✅ 一致 |

### 7.6 尺寸规范

| 元素 | 尺寸 | 对齐状态 |
|------|------|----------|
| 收起态高度 | 38px | ✅ 一致 |
| 展开态最小宽度 | 360px | ✅ 已修正 |
| 展开态最大宽度 | 420px | ✅ 已修正 |
| 按钮尺寸 | 22px × 22px | ✅ 已修正 |

---

## 八、任务清单

### Phase 1：基础结构

| 序号 | 任务 | 说明 | 状态 |
|------|------|------|------|
| 1.1 | 创建文件结构 | 新建 `src/components/dynamic-island/` 目录及所有子文件 | [ ] |
| 1.2 | 创建样式文件 | 新建 `styles/island.css`，写入所有 CSS 变量 | [ ] |
| 1.3 | 实现 NotchShape 组件 | SVG 实现上下不同圆角的形状，支持动画过渡 | [ ] |
| 1.4 | 重构 DynamicIsland 主容器 | 整合拖动、展开/收起、边框/阴影动态切换 | [ ] |
| 1.5 | 更新 CollapsedView 组件 | 按新样式规范重写，含宠物图标、任务信息、进度条 | [ ] |
| 1.6 | 实现拖动功能 | 水平拖动，不记住位置 | [ ] |
| 1.7 | 实现悬浮显示按钮 | 悬浮时渐入显示暂停/完成按钮 | [ ] |

### Phase 2：展开态

| 序号 | 任务 | 说明 | 状态 |
|------|------|------|------|
| 2.1 | 实现 ExpandedView 基础结构 | 子任务区 + 并行任务区 + 底部按钮 | [ ] |
| 2.2 | 实现 SubtaskList 组件 | 子任务列表，含状态图标、跳过/下一项按钮 | [ ] |
| 2.3 | 实现 ParallelTaskCard 组件 | 并行任务卡片，含进度条、展开/收起子任务 | [ ] |
| 2.4 | 实现展开/收起子任务 | 点击展开按钮显示/隐藏子任务列表 | [ ] |
| 2.5 | 实现 ProgressBar 组件 | 按新样式规范的进度条 | [ ] |

### Phase 3：交互完善

| 序号 | 任务 | 说明 | 状态 |
|------|------|------|------|
| 3.1 | 实现 ReminderPopup 组件 | 提醒弹出，1.5秒自动消失，时间到需用户操作 | [ ] |
| 3.2 | 实现点击外部收起 | 点击灵动岛外部区域收起展开态 | [ ] |
| 3.3 | 扩展 Task 类型 | 新增 Subtask 类型，扩展 TaskStatus | [ ] |
| 3.4 | 扩展 taskStore | 新增 completeSubtask、skipSubtask 等方法 | [ ] |
| 3.5 | 实现子任务操作逻辑 | 跳过/完成当前子任务，激活下一个 | [ ] |
| 3.6 | 实现底部按钮功能 | 添加任务、回到主页（打开浏览器） | [ ] |

### Phase 4：动画与细节

| 序号 | 任务 | 说明 | 状态 |
|------|------|------|------|
| 4.1 | 完善 Spring 动画 | 收起↔展开过渡，参数 response=0.42, dampingFraction=0.8 | [ ] |
| 4.2 | 实现宠物状态动画 | 根据任务状态显示不同动画（后续迭代） | [ ] |
| 4.3 | 添加无障碍支持 | aria-label、键盘操作、焦点管理 | [ ] |
| 4.4 | 响应式适配 | 不同屏幕宽度下的适配 | [ ] |

### Phase 5：测试与优化（可选）

| 序号 | 任务 | 说明 | 状态 |
|------|------|------|------|
| 5.1 | 性能优化 | React.memo、transform 动画 | [ ] |
| 5.2 | 边界情况处理 | 任务名空、无子任务、拖动边界 | [ ] |
| 5.3 | 浏览器兼容测试 | Chrome/Firefox/Safari | [ ] |
| 5.4 | backdrop-blur 降级方案 | 不支持时的备选样式 | [ ] |

---

### 任务依赖关系

```
Phase 1（基础结构）
    │
    ├── 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7
    │
    ▼
Phase 2（展开态）
    │
    ├── 2.1 → 2.5
    │      ↓
    │   2.2 → 2.4
    │      ↓
    │   2.3 → 2.4
    │
    ▼
Phase 3（交互完善）
    │
    ├── 3.1, 3.2（可并行）
    │
    ├── 3.3 → 3.4 → 3.5
    │
    └── 3.6
    │
    ▼
Phase 4（动画与细节）
    │
    ├── 4.1, 4.2, 4.3, 4.4（可并行）
    │
    ▼
Phase 5（测试与优化）
```

---

### 预计工时

| Phase | 预计时间 |
|-------|----------|
| Phase 1 | 2-3 小时 |
| Phase 2 | 2-3 小时 |
| Phase 3 | 1-2 小时 |
| Phase 4 | 1-2 小时 |
| Phase 5 | 1 小时 |
| **总计** | **7-11 小时** |

---

## 九、注意事项

1. **性能优化**
   - 使用 `React.memo` 包装子组件
   - 动画使用 `transform` 而非 `width/height`
   - 避免在渲染时计算复杂值

2. **边界情况**
   - 任务名为空时的显示
   - 没有子任务时的 UI
   - 拖动到屏幕边缘的处理

3. **无障碍**
   - 按钮添加 `aria-label`
   - 支持键盘操作
   - 焦点管理

4. **浏览器兼容**
   - 测试 Chrome/Firefox/Safari
   - backdrop-blur 的降级方案

---

## 十一、与 Open Island 参考的对齐确认

| 项目 | 状态 |
|------|------|
| 颜色系统 | ✅ 完全一致 |
| 字体系统 | ✅ 完全一致 |
| 圆角系统 | ✅ 完全一致（含 NotchShape） |
| 阴影系统 | ✅ 完全一致 |
| 间距系统 | ✅ 完全一致 |
| 尺寸规范 | ✅ 已适配 Web 场景 |
| 状态颜色 | ✅ 一致（新增暂停态） |
| 动画参数 | ✅ 一致（Spring: 0.42, 0.8） |
