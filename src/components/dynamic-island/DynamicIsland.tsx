import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTaskStore } from '../../stores/taskStore';
import { useTimer } from '../../hooks/useTimer';
import { useReminder } from '../../hooks/useReminder';
import { pushTaskFromIsland } from '../../lib/islandBridge';
import type { Task } from '../../types/task';
import { CollapsedView } from './CollapsedView';
import { ExpandedView } from './ExpandedView';

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
  const islandRootRef = useRef<HTMLDivElement>(null);

  const tasks = useTaskStore((state) => state.tasks);
  const activeTaskId = useTaskStore((state) => state.activeTaskId);
  const activeTask = tasks.find((t) => t.id === activeTaskId);
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
      hasFocusedOverride
        ? { ...payload, focused: overrides?.focused }
        : payload
    );
  };

  const pushCurrentTaskSnapshot = (taskId: string) => {
    const latestTask = useTaskStore.getState().tasks.find((item) => item.id === taskId);
    if (!latestTask) return;
    pushTaskSync(latestTask, {
      status:
        latestTask.status === 'paused' || latestTask.status === 'completed' || latestTask.status === 'cancelled'
          ? latestTask.status
          : 'active'
    });
  };

  const timer = useTimer({
    plannedDuration: activeTask?.plannedDuration || 25,
    initialElapsed: activeTask?.actualDuration || 0,
    syncKey: activeTaskId,
    onTick: (elapsed) => {
      if (activeTaskId) {
        updateTask(activeTaskId, { actualDuration: elapsed });
      }
    }
  });

  const reminder = useReminder(
    timer.elapsedSeconds,
    (activeTask?.plannedDuration || 25) * 60,
    {
      onHalfTime: () => {
        console.log('Half time reached');
      },
      onFiveMinutesLeft: () => {
        console.log('Five minutes left');
      },
      onTimeUp: () => {
        console.log('Time is up');
      }
    }
  );

  useEffect(() => {
    if (activeTask && activeTask.status === 'active') {
      timer.start();
    } else {
      timer.pause();
    }
  }, [activeTask?.id, activeTask?.status]);

  // Keep parallel running tasks progressing even when they are not the focused main task.
  useEffect(() => {
    const interval = window.setInterval(() => {
      const store = useTaskStore.getState();
      const runningParallelTasks = store.tasks.filter(
        (task) => task.id !== store.activeTaskId && task.status === 'active'
      );

      runningParallelTasks.forEach((task) => {
        store.updateTask(task.id, { actualDuration: task.actualDuration + 1 });
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  // Keep Web timer aligned with island timer by pushing running task snapshots continuously.
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
    const currentPlannedMinutes = activeTask?.plannedDuration || 25;
    const currentPlannedSeconds = currentPlannedMinutes * 60;
    const persistedElapsed = activeTask?.actualDuration || 0;
    const timerElapsed = timer.elapsedSeconds;

    // If user extends right after time-up, keep elapsed baseline at least the old planned time.
    const nextElapsedBaseline =
      timerElapsed >= currentPlannedSeconds
        ? Math.max(persistedElapsed, currentPlannedSeconds)
        : Math.max(persistedElapsed, timerElapsed);

    updateTask(activeTaskId, {
      plannedDuration: currentPlannedMinutes + minutes,
      actualDuration: nextElapsedBaseline
    });
    if (!timer.isRunning) {
      timer.start();
      updateTask(activeTaskId, { status: 'active' });
    }
    pushTaskSync(activeTask, {
      plannedDuration: currentPlannedMinutes + minutes,
      actualDuration: nextElapsedBaseline,
      status: 'active'
    });
    reminder.resetType('timeUp');
  };

  const handlePause = () => {
    timer.pause();
    if (activeTaskId) updateTask(activeTaskId, { status: 'paused' });
    if (activeTask) {
      pushTaskSync(activeTask, {
        actualDuration: Math.max(activeTask.actualDuration, timer.elapsedSeconds),
        status: 'paused',
        focused: true
      });
    }
  };

  const handleResume = () => {
    timer.start();
    if (activeTaskId) updateTask(activeTaskId, { status: 'active' });
    if (activeTask) {
      pushTaskSync(activeTask, { status: 'active', focused: true });
    }
  };

  const handleComplete = () => {
    timer.pause();
    if (!activeTaskId || !activeTask) return;
    pushTaskSync(activeTask, {
      actualDuration: Math.max(activeTask.actualDuration, timer.elapsedSeconds),
      status: 'completed'
    });
    completeTask(activeTaskId);

    // 切换到下一个并行任务，而不是收起
    const remainingTasks = tasks.filter(
      (t) => t.id !== activeTaskId && (t.status === 'active' || t.status === 'paused')
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
    timer.pause();
    setActiveTask(taskId);
    updateTask(taskId, { status: 'active' });
    if (previousTask) {
      pushTaskSync(previousTask, {
        actualDuration: Math.max(previousTask.actualDuration, timer.elapsedSeconds),
        status:
          previousTask.status === 'paused' || previousTask.status === 'completed' || previousTask.status === 'cancelled'
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
    timer.pause();
    pushTaskSync(activeTask, {
      actualDuration: Math.max(activeTask.actualDuration, timer.elapsedSeconds),
      status: 'cancelled'
    });
    updateTask(activeTaskId, { status: 'cancelled' });
    removeTask(activeTaskId);
    setActiveTask(null);
  };

  const handleCloseIsland = async () => {
    setIsExpanded(false);
    onRequestClose?.();

    try {
      await fetch('http://127.0.0.1:43141/island/hide', { method: 'POST' });
    } catch {
      // Ignore bridge errors and still try local hide.
    }

    try {
      const tauriWindow = await import('@tauri-apps/api/window');
      await tauriWindow.getCurrentWindow().hide();
    } catch {
      // Ignore when running in browser-only mode.
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

  if (!activeTask) {
    const activeOrPausedTasks = tasks.filter((t) => t.status === 'active' || t.status === 'paused');

    if (activeOrPausedTasks.length > 0) {
      return (
        <div
          role="button"
          tabIndex={0}
          className="group relative w-full max-w-[408px] rounded-[18px] border border-white/12 bg-black/88 px-4 py-3 text-left shadow-[0_18px_60px_rgba(0,0,0,0.48)] backdrop-blur-2xl"
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
            onClick={(event) => {
              event.stopPropagation();
              void handleCloseIsland();
            }}
            className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-[6px] border border-orange-300/70 bg-orange-500/85 text-sm font-bold text-white opacity-0 scale-90 transition-all hover:bg-orange-400 group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100"
            aria-label="关闭灵动岛"
          >
            ×
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400 text-xl shadow-[0_8px_24px_rgba(244,114,182,0.35)]">
              🦀
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
        onClick={onRequestCreate}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onRequestCreate?.();
          }
        }}
        className={`group relative w-full max-w-[408px] border border-white/12 bg-black/88 px-4 py-3 text-left shadow-[0_18px_60px_rgba(0,0,0,0.48)] backdrop-blur-2xl ${
          composerOpen ? 'rounded-t-[18px] rounded-b-none border-b-0' : 'rounded-[18px]'
        }`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void handleCloseIsland();
          }}
          className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-[6px] border border-orange-300/70 bg-orange-500/85 text-sm font-bold text-white opacity-0 scale-90 transition-all hover:bg-orange-400 group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100"
          aria-label="关闭灵动岛"
        >
          ×
        </button>
        <div className="flex items-center gap-3">
          <motion.div
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400 text-xl shadow-[0_8px_24px_rgba(244,114,182,0.35)]"
            animate={{ rotate: [0, -5, 5, 0] }}
            transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 3 }}
          >
            🦀
          </motion.div>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 text-sm font-semibold text-white">点击添加任务开始学习</div>
            <div className="text-xs text-white/50">Desktop island is waiting</div>
          </div>
        </div>
      </motion.div>
    );
  }

  const activeOrPausedTasks = tasks.filter((t) => t.status === 'active' || t.status === 'paused');

  return (
    <div ref={islandRootRef}>
      <AnimatePresence mode="wait">
        {isExpanded ? (
          <motion.div
            key="expanded-wrapper"
            initial={{ width: 280 }}
            animate={{ width: 420 }}
            exit={{ width: 280 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <ExpandedView
              key="expanded"
              task={activeTask}
              tasks={activeOrPausedTasks}
              progress={timer.progress}
              remainingSeconds={timer.remainingSeconds}
              isRunning={timer.isRunning}
              isOvertime={timer.isOvertime}
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
              onAddTask={() => {
                onRequestCreate?.();
              }}
              onGoHome={() => {
                window.open(window.location.origin, '_blank', 'noopener,noreferrer');
              }}
              onCollapse={() => setIsExpanded(false)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="collapsed-wrapper"
            initial={{ width: 420 }}
            animate={{ width: 280 }}
            exit={{ width: 280 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <CollapsedView
              key="collapsed"
              task={activeTask}
              progress={timer.progress}
              remainingSeconds={timer.remainingSeconds}
              isOvertime={timer.isOvertime}
              isRunning={timer.isRunning}
              onPause={timer.isRunning ? handlePause : handleResume}
              onComplete={handleComplete}
              onExtend={handleExtend}
              onCancel={handleCancel}
              onExpand={() => setIsExpanded(true)}
              onCloseIsland={handleCloseIsland}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

