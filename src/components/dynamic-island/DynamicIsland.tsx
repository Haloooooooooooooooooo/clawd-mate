import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTaskStore } from '../../stores/taskStore';
import { useReminder } from '../../hooks/useReminder';
import { pushTaskFromIsland } from '../../lib/islandBridge';
import type { Task } from '../../types/task';
import { CollapsedView } from './CollapsedView';
import { ExpandedView } from './ExpandedView';
import { type PetStatus, PetSprite } from '@pet';

interface DynamicIslandProps {
  onRequestCreate?: () => void;
  onLayoutModeChange?: (mode: 'idle' | 'collapsed' | 'expanded') => void;
  composerOpen?: boolean;
  expandOnTaskStartKey?: number;
  onRequestClose?: () => void;
}

export function DynamicIsland({
  onRequestCreate,
  onLayoutModeChange,
  composerOpen = false,
  expandOnTaskStartKey = 0,
  onRequestClose
}: DynamicIslandProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [celebrateTrigger, setCelebrateTrigger] = useState(false);
  const celebrateTimeoutRef = useRef<number | null>(null);
  const islandRootRef = useRef<HTMLDivElement>(null);

  const tasks = useTaskStore((state) => state.tasks);
  const activeTaskId = useTaskStore((state) => state.activeTaskId);
  const recentCelebrationAt = useTaskStore((state) => state.recentCelebrationAt);
  const activeTask = tasks.find((task) => task.id === activeTaskId);
  const updateTask = useTaskStore((state) => state.updateTask);
  const completeTask = useTaskStore((state) => state.completeTask);
  const completeSubTask = useTaskStore((state) => state.completeSubTask);
  const skipSubTask = useTaskStore((state) => state.skipSubTask);
  const removeTask = useTaskStore((state) => state.removeTask);
  const setActiveTask = useTaskStore((state) => state.setActiveTask);

  const pushTaskSync = (
    task: Task,
    overrides?: Partial<{
      plannedDuration: number;
      actualDuration: number;
      status: 'active' | 'paused' | 'completed' | 'cancelled';
      focused: boolean;
    }>
  ) => {
    const nextStatus =
      overrides?.status ||
      (task.status === 'paused' || task.status === 'completed' || task.status === 'cancelled'
        ? task.status
        : 'active');
    const nextDuration = overrides?.plannedDuration ?? task.plannedDuration;
    const nextElapsed = overrides?.actualDuration ?? task.actualDuration;
    const hasFocusedOverride = typeof overrides?.focused === 'boolean';

    const payload = {
      sync_id: task.syncId || task.id,
      title: task.title,
      duration_minutes: nextDuration,
      mode: task.mode,
      subtasks: task.subTasks.map((subTask) => ({
        title: subTask.title,
        status: subTask.status
      })),
      status: nextStatus,
      elapsed_seconds: nextElapsed,
      updated_at_ms: Date.now()
    } as const;

    void pushTaskFromIsland(
      hasFocusedOverride ? { ...payload, focused: overrides?.focused } : payload
    );
  };

  const pushCurrentTaskSnapshot = (taskId: string) => {
    const latestTask = useTaskStore.getState().tasks.find((item) => item.id === taskId);
    if (!latestTask) return;
    pushTaskSync(latestTask, {
      status:
        latestTask.status === 'paused' ||
        latestTask.status === 'completed' ||
        latestTask.status === 'cancelled'
          ? latestTask.status
          : 'active'
    });
  };

  const activeElapsedSeconds = activeTask?.actualDuration || 0;
  const activePlannedSeconds = (activeTask?.plannedDuration || 25) * 60;
  const activeRemainingSeconds = Math.max(0, activePlannedSeconds - activeElapsedSeconds);
  const activeProgress = activePlannedSeconds > 0 ? activeElapsedSeconds / activePlannedSeconds : 0;
  const activeIsOvertime = activeElapsedSeconds >= activePlannedSeconds && activeElapsedSeconds > 0;
  const activeIsRunning = activeTask?.status === 'active';
  const activeOrPausedTasks = tasks.filter(
    (task) => task.status === 'active' || task.status === 'paused'
  );

  // 桌宠状态判断逻辑
  const getPetStatus = (): PetStatus => {
    // celebrate 优先（短暂显示）
    if (celebrateTrigger) return 'celebrate';

    // 无任务 → 睡觉
    if (activeOrPausedTasks.length === 0) return 'idle';

    // 检查是否有任何任务超时
    const hasAnyOvertime = activeOrPausedTasks.some((task) => {
      const elapsed = task.actualDuration || 0;
      const planned = (task.plannedDuration || 25) * 60;
      return elapsed >= planned && elapsed > 0;
    });
    if (hasAnyOvertime) return 'alert';

    // 检查是否有任何任务正在进行
    const hasAnyRunning = activeOrPausedTasks.some((task) => task.status === 'active');
    if (hasAnyRunning) return 'working';

    // 所有任务都暂停 → 睡觉
    return 'idle';
  };

  const reminder = useReminder(activeElapsedSeconds, activePlannedSeconds, {
    onHalfTime: () => console.log('Half time reached'),
    onFiveMinutesLeft: () => console.log('Five minutes left'),
    onTimeUp: () => console.log('Time is up')
  });
  const currentPetStatus = getPetStatus();
  const currentPetScaleMultiplier = currentPetStatus === 'working' ? 1.22 : 1;

  const handleDragMouseDown = async (event: React.MouseEvent<HTMLElement>) => {
    if (event.button !== 0) return;

    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('button, input, textarea, select, a, [data-no-drag="true"]')) {
      return;
    }

    try {
      await getCurrentWindow().startDragging();
    } catch {
      // Ignore browser-only mode or denied environments.
    }
  };

  useEffect(() => {
    if (!recentCelebrationAt) return;

    setCelebrateTrigger(true);
    if (celebrateTimeoutRef.current) {
      window.clearTimeout(celebrateTimeoutRef.current);
    }
    celebrateTimeoutRef.current = window.setTimeout(() => {
      setCelebrateTrigger(false);
      celebrateTimeoutRef.current = null;
    }, 3200);

    return () => {
      if (celebrateTimeoutRef.current) {
        window.clearTimeout(celebrateTimeoutRef.current);
      }
    };
  }, [recentCelebrationAt]);

  useEffect(() => {
    let lastTickAt = Date.now();
    const interval = window.setInterval(() => {
      const now = Date.now();
      const deltaSeconds = Math.max(1, Math.floor((now - lastTickAt) / 1000));
      lastTickAt = now;

      const store = useTaskStore.getState();
      const runningTasks = store.tasks.filter((task) => task.status === 'active');
      runningTasks.forEach((task) => {
        store.updateTask(task.id, { actualDuration: task.actualDuration + deltaSeconds });
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const store = useTaskStore.getState();
      const runningTasks = store.tasks.filter((task) => task.status === 'active');
      runningTasks.forEach((task) => {
        pushTaskSync(task, { status: 'active' });
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTask) {
      reminder.reset();
    }
  }, [activeTask?.plannedDuration]);

  useEffect(() => {
    if (!activeTask) {
      onLayoutModeChange?.('idle');
      return;
    }
    onLayoutModeChange?.(isExpanded ? 'expanded' : 'collapsed');
  }, [activeTask, isExpanded, onLayoutModeChange]);

  useEffect(() => {
    if (!isExpanded || composerOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (!islandRootRef.current?.contains(target)) {
        setIsExpanded(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExpanded(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [composerOpen, isExpanded]);

  useEffect(() => {
    if (!activeTaskId) return;
    const frame = window.requestAnimationFrame(() => {
      setIsExpanded(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [expandOnTaskStartKey, activeTaskId]);

  const handleExtend = (minutes: number) => {
    if (!activeTaskId || !activeTask) return;
    const currentPlannedMinutes = activeTask.plannedDuration || 25;
    const currentPlannedSeconds = currentPlannedMinutes * 60;
    const persistedElapsed = activeTask.actualDuration || 0;
    const nextElapsedBaseline =
      persistedElapsed >= currentPlannedSeconds
        ? Math.max(persistedElapsed, currentPlannedSeconds)
        : persistedElapsed;

    updateTask(activeTaskId, {
      plannedDuration: currentPlannedMinutes + minutes,
      actualDuration: nextElapsedBaseline,
      status: 'active'
    });
    pushTaskSync(activeTask, {
      plannedDuration: currentPlannedMinutes + minutes,
      actualDuration: nextElapsedBaseline,
      status: 'active'
    });
    reminder.resetType('timeUp');
  };

  const handlePause = () => {
    if (activeTaskId) updateTask(activeTaskId, { status: 'paused' });
    if (activeTask) {
      pushTaskSync(activeTask, {
        actualDuration: activeTask.actualDuration,
        status: 'paused',
        focused: true
      });
    }
  };

  const handleResume = () => {
    if (activeTaskId) updateTask(activeTaskId, { status: 'active' });
    if (activeTask) {
      pushTaskSync(activeTask, { status: 'active', focused: true });
    }
  };

  const handleComplete = () => {
    if (!activeTaskId || !activeTask) return;

    pushTaskSync(activeTask, {
      actualDuration: activeTask.actualDuration,
      status: 'completed'
    });
    completeTask(activeTaskId);

    const remainingTasks = tasks.filter(
      (task) => task.id !== activeTaskId && (task.status === 'active' || task.status === 'paused')
    );
    if (remainingTasks.length > 0) {
      setActiveTask(remainingTasks[0].id);
      updateTask(remainingTasks[0].id, { status: 'active' });
    } else {
      setActiveTask(null);
    }
  };

  const handleSwitchTask = (taskId: string) => {
    const previousTask = activeTaskId ? tasks.find((task) => task.id === activeTaskId) : undefined;
    const targetTask = tasks.find((task) => task.id === taskId);
    setActiveTask(taskId);
    updateTask(taskId, { status: 'active' });
    if (previousTask) {
      pushTaskSync(previousTask, {
        actualDuration: previousTask.actualDuration,
        status:
          previousTask.status === 'paused' ||
          previousTask.status === 'completed' ||
          previousTask.status === 'cancelled'
            ? previousTask.status
            : 'active',
        focused: false
      });
    }
    if (targetTask) {
      pushTaskSync(targetTask, { status: 'active', focused: true });
    }
  };

  const handlePauseTask = (taskId: string) => {
    const targetTask = tasks.find((task) => task.id === taskId);
    if (!targetTask) return;

    if (taskId === activeTaskId) {
      if (targetTask.status === 'paused') {
        handleResume();
      } else {
        handlePause();
      }
      return;
    }

    updateTask(taskId, { status: targetTask.status === 'paused' ? 'active' : 'paused' });
    pushTaskSync(targetTask, { status: targetTask.status === 'paused' ? 'active' : 'paused' });
  };

  const handleCompleteTask = (taskId: string) => {
    if (taskId === activeTaskId) {
      handleComplete();
      return;
    }
    const targetTask = tasks.find((task) => task.id === taskId);
    if (targetTask) {
      pushTaskSync(targetTask, { status: 'completed' });
    }
    completeTask(taskId);
  };

  const handleCancelTask = (taskId: string) => {
    if (taskId === activeTaskId) {
      handleCancel();
      return;
    }
    const targetTask = tasks.find((task) => task.id === taskId);
    if (targetTask) {
      pushTaskSync(targetTask, { status: 'cancelled' });
    }
    updateTask(taskId, { status: 'cancelled' });
    removeTask(taskId);
  };

  const handleExtendTask = (taskId: string, minutes: number) => {
    const targetTask = tasks.find((task) => task.id === taskId);
    if (!targetTask) return;

    if (taskId === activeTaskId) {
      handleExtend(minutes);
      return;
    }

    const currentPlannedSeconds = targetTask.plannedDuration * 60;
    const nextElapsedBaseline =
      targetTask.actualDuration >= currentPlannedSeconds
        ? Math.max(targetTask.actualDuration, currentPlannedSeconds)
        : targetTask.actualDuration;

    updateTask(taskId, {
      plannedDuration: targetTask.plannedDuration + minutes,
      actualDuration: nextElapsedBaseline,
      status: 'active'
    });
    pushTaskSync(targetTask, {
      plannedDuration: targetTask.plannedDuration + minutes,
      actualDuration: nextElapsedBaseline,
      status: 'active'
    });
  };

  const handleCancel = () => {
    if (!activeTaskId || !activeTask) return;
    pushTaskSync(activeTask, {
      actualDuration: activeTask.actualDuration,
      status: 'cancelled'
    });
    updateTask(activeTaskId, { status: 'cancelled' });
    removeTask(activeTaskId);

    const remainingTasks = tasks.filter(
      (task) => task.id !== activeTaskId && (task.status === 'active' || task.status === 'paused')
    );
    if (remainingTasks.length > 0) {
      setActiveTask(remainingTasks[0].id);
      updateTask(remainingTasks[0].id, { status: 'active' });
      pushTaskSync(remainingTasks[0], { status: 'active', focused: true });
    } else {
      setActiveTask(null);
    }
  };

  const handleCloseIsland = async () => {
    setIsExpanded(false);
    onRequestClose?.();

    try {
      await fetch('http://127.0.0.1:43141/island/hide', { method: 'POST' });
    } catch {
      // Ignore bridge errors.
    }

    try {
      const tauriWindow = await import('@tauri-apps/api/window');
      await tauriWindow.getCurrentWindow().hide();
    } catch {
      // Ignore browser-only mode.
    }
  };

  const handleCompleteSubTask = (taskId: string, subTaskId: string) => {
    completeSubTask(taskId, subTaskId);
    pushCurrentTaskSnapshot(taskId);
  };

  const handleSkipSubTask = (taskId: string, subTaskId: string) => {
    skipSubTask(taskId, subTaskId);
    pushCurrentTaskSnapshot(taskId);
  };

  const handleGoHome = async () => {
    try {
      const response = await fetch('http://127.0.0.1:43141/dashboard/show', { method: 'POST' });
      if (response.ok) {
        return;
      }
    } catch {
      // Ignore bridge errors and use browser fallback.
    }

    window.open('http://127.0.0.1:5173/app/dashboard', '_blank', 'noopener,noreferrer');
  };

  if (!activeTask) {
    if (activeOrPausedTasks.length > 0) {
      return (
        <div
          role="button"
          tabIndex={0}
          data-tauri-drag-region
          className="group relative w-[352px] rounded-[18px] border border-white/12 bg-black/88 px-4 py-3 text-left shadow-[0_18px_60px_rgba(0,0,0,0.48)] backdrop-blur-2xl"
          onMouseDown={handleDragMouseDown}
          onClick={() => setActiveTask(activeOrPausedTasks[0].id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setActiveTask(activeOrPausedTasks[0].id);
            }
          }}
        >
          <button
            type="button"
            data-no-drag="true"
            onClick={(event) => {
              event.stopPropagation();
              void handleCloseIsland();
            }}
            className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-[6px] border border-orange-300/70 bg-orange-500/85 text-sm font-bold text-white opacity-0 scale-90 transition-all hover:bg-orange-400 group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100"
            aria-label="关闭灵动岛"
          >
            ×
          </button>
          <div className="flex items-center gap-2.5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center">
              <PetSprite status={currentPetStatus} size="sm" scaleMultiplier={currentPetScaleMultiplier} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 text-sm font-semibold text-white">点击恢复专注任务</div>
              <div className="text-xs text-white/50">{activeOrPausedTasks.length} tasks are available</div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <motion.div
        role="button"
        tabIndex={0}
        data-tauri-drag-region
        onMouseDown={handleDragMouseDown}
        onClick={onRequestCreate}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onRequestCreate?.();
          }
        }}
        className="group relative w-[352px] rounded-[18px] border border-white/12 bg-black/88 px-4 py-3 text-left shadow-[0_18px_60px_rgba(0,0,0,0.48)] backdrop-blur-2xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <button
          type="button"
          data-no-drag="true"
          onClick={(event) => {
            event.stopPropagation();
            void handleCloseIsland();
          }}
          className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-[6px] border border-orange-300/70 bg-orange-500/85 text-sm font-bold text-white opacity-0 scale-90 transition-all hover:bg-orange-400 group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100"
          aria-label="关闭灵动岛"
        >
          ×
        </button>
          <div className="flex items-center gap-2.5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center">
            <PetSprite status={currentPetStatus} size="sm" scaleMultiplier={currentPetScaleMultiplier} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 text-sm font-semibold text-white">点击添加任务开始学习</div>
            <div className="text-xs text-white/50">Desktop island is waiting</div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div ref={islandRootRef}>
      <AnimatePresence mode="wait">
        {isExpanded ? (
          <motion.div
            key="expanded-wrapper"
            initial={{ width: 460 }}
            animate={{ width: 460 }}
            exit={{ width: 320 }}
            transition={{ duration: 0 }}
          >
            <ExpandedView
              key="expanded"
              task={activeTask}
              tasks={activeOrPausedTasks}
              progress={activeProgress}
              remainingSeconds={activeRemainingSeconds}
              isRunning={activeIsRunning}
              isOvertime={activeIsOvertime}
              petStatus={currentPetStatus}
              onPause={handlePause}
              onResume={handleResume}
              onComplete={handleComplete}
              onCancel={handleCancel}
              onExtend={handleExtend}
              onSwitchTask={handleSwitchTask}
              onPauseTask={handlePauseTask}
              onCompleteTask={handleCompleteTask}
              onCancelTask={handleCancelTask}
              onExtendTask={handleExtendTask}
              onCompleteSubTask={handleCompleteSubTask}
              onSkipSubTask={handleSkipSubTask}
              onAddTask={() => onRequestCreate?.()}
              onGoHome={handleGoHome}
              onCollapse={() => setIsExpanded(false)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="collapsed-wrapper"
            initial={{ width: 352 }}
            animate={{ width: 352 }}
            exit={{ width: 352 }}
            transition={{ duration: 0 }}
            className="flex"
          >
            <CollapsedView
              key="collapsed"
              task={activeTask}
              progress={activeProgress}
              remainingSeconds={activeRemainingSeconds}
              isOvertime={activeIsOvertime}
              isRunning={activeIsRunning}
              onPause={activeIsRunning ? handlePause : handleResume}
              onComplete={handleComplete}
              onExtend={handleExtend}
              onCancel={handleCancel}
              onExpand={() => setIsExpanded(true)}
              onCloseIsland={handleCloseIsland}
              petStatus={currentPetStatus}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
