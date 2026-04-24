import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTaskStore } from '../../stores/taskStore';
import { useTimer } from '../../hooks/useTimer';
import { useReminder } from '../../hooks/useReminder';
import { CollapsedView } from './CollapsedView';
import { ExpandedView } from './ExpandedView';

interface DynamicIslandProps {
  onRequestCreate?: () => void;
  onLayoutModeChange?: (mode: 'idle' | 'collapsed' | 'expanded') => void;
  composerOpen?: boolean;
  expandOnTaskStartKey?: number;
}

export function DynamicIsland({
  onRequestCreate,
  onLayoutModeChange,
  composerOpen = false,
  expandOnTaskStartKey = 0
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

  const timer = useTimer({
    plannedDuration: activeTask?.plannedDuration || 25,
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
    if (!isExpanded) return;

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
  }, [isExpanded]);

  useEffect(() => {
    if (!activeTaskId) return;
    const frame = window.requestAnimationFrame(() => {
      setIsExpanded(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [expandOnTaskStartKey, activeTaskId]);

  const handleExtend = (minutes: number) => {
    if (!activeTaskId) return;
    updateTask(activeTaskId, {
      plannedDuration: (activeTask?.plannedDuration || 25) + minutes
    });
    reminder.resetType('timeUp');
  };

  const handlePause = () => {
    timer.pause();
    if (activeTaskId) updateTask(activeTaskId, { status: 'paused' });
  };

  const handleResume = () => {
    timer.start();
    if (activeTaskId) updateTask(activeTaskId, { status: 'active' });
  };

  const handleComplete = () => {
    timer.pause();
    if (!activeTaskId) return;
    completeTask(activeTaskId);
    setActiveTask(null);
  };

  const handleSwitchTask = (taskId: string) => {
    timer.pause();
    if (activeTaskId) updateTask(activeTaskId, { status: 'paused' });
    setActiveTask(taskId);
    updateTask(taskId, { status: 'active' });
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
  };

  const handleCompleteTask = (taskId: string) => {
    if (taskId === activeTaskId) {
      handleComplete();
      return;
    }
    completeTask(taskId);
  };

  const handleCancel = () => {
    if (!activeTaskId) return;
    timer.pause();
    updateTask(activeTaskId, { status: 'cancelled' });
    removeTask(activeTaskId);
    setActiveTask(null);
  };

  const handleCompleteSubTask = (taskId: string, subTaskId: string) => {
    completeSubTask(taskId, subTaskId);
  };

  const handleSkipSubTask = (taskId: string, subTaskId: string) => {
    skipSubTask(taskId, subTaskId);
  };

  if (!activeTask) {
    const activeOrPausedTasks = tasks.filter((t) => t.status === 'active' || t.status === 'paused');

    if (activeOrPausedTasks.length > 0) {
      return (
        <button
          type="button"
          className="w-full max-w-[408px] rounded-[18px] border border-white/12 bg-black/88 px-4 py-3 text-left shadow-[0_18px_60px_rgba(0,0,0,0.48)] backdrop-blur-2xl"
          onClick={() => setActiveTask(activeOrPausedTasks[0].id)}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400 text-xl shadow-[0_8px_24px_rgba(244,114,182,0.35)]">
              🦀
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 text-sm font-semibold text-white">点击恢复专注任务</div>
              <div className="text-xs text-white/50">{activeOrPausedTasks.length} tasks are available</div>
            </div>
          </div>
        </button>
      );
    }

    return (
      <motion.button
        type="button"
        onClick={onRequestCreate}
        className={`w-full max-w-[408px] border border-white/12 bg-black/88 px-4 py-3 text-left shadow-[0_18px_60px_rgba(0,0,0,0.48)] backdrop-blur-2xl ${
          composerOpen ? 'rounded-t-[18px] rounded-b-none border-b-0' : 'rounded-[18px]'
        }`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
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
      </motion.button>
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
              onPause={handlePause}
              onResume={handleResume}
              onComplete={handleComplete}
              onExtend={handleExtend}
              onSwitchTask={handleSwitchTask}
              onPauseTask={handlePauseTask}
              onCompleteTask={handleCompleteTask}
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
              isRunning={timer.isRunning}
              onPause={timer.isRunning ? handlePause : handleResume}
              onComplete={handleComplete}
              onCancel={handleCancel}
              onExpand={() => setIsExpanded(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
