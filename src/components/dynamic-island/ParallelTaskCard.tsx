import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { Task } from '../../types/task';
import { ProgressBar } from './ProgressBar';
import { SubtaskList } from './SubtaskList';

interface ParallelTaskCardProps {
  task: Task;
  onSwitchTask: (taskId: string) => void;
  onPauseTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onCancelTask: (taskId: string) => void;
  onExtendTask: (taskId: string, minutes: number) => void;
  onCompleteSubTask: (taskId: string, subTaskId: string) => void;
  onSkipSubTask: (taskId: string, subTaskId: string) => void;
}

export function ParallelTaskCard({
  task,
  onSwitchTask,
  onPauseTask,
  onCompleteTask,
  onCancelTask,
  onExtendTask,
  onCompleteSubTask,
  onSkipSubTask
}: ParallelTaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const progress = Math.min(1, task.actualDuration / Math.max(1, task.plannedDuration * 60));
  const isRunning = task.status === 'active';
  const isOvertime = task.actualDuration >= task.plannedDuration * 60;
  const remainingSeconds = Math.max(0, task.plannedDuration * 60 - task.actualDuration);
  const remainingMinutes = Math.floor(remainingSeconds / 60);
  const remainingRemainSeconds = remainingSeconds % 60;
  const overtimeSeconds = Math.max(0, task.actualDuration - task.plannedDuration * 60);
  const overtimeMinutes = Math.floor(overtimeSeconds / 60);
  const overtimeRemainSeconds = overtimeSeconds % 60;

  return (
    <div className="rounded-[16px] border border-white/10 bg-white/[0.03] px-3 py-3">
      <div className="mb-2 flex items-center gap-3">
        <div
          className={`h-2.5 w-2.5 rounded-full ${
            task.status === 'active'
              ? 'bg-emerald-400'
              : task.status === 'paused'
                ? 'bg-amber-400'
                : 'bg-white/35'
          }`}
        />
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left text-sm text-white/85"
          onClick={() => onSwitchTask(task.id)}
        >
          {task.title}
        </button>
        <span className="text-[11px] text-white/45">
          {isOvertime
            ? `超时 ${overtimeMinutes}:${overtimeRemainSeconds.toString().padStart(2, '0')}`
            : `剩余 ${remainingMinutes}:${remainingRemainSeconds.toString().padStart(2, '0')}`}
        </span>
      </div>

      <ProgressBar progress={progress} className="mb-2 h-1.5" />
      {isOvertime && (
        <div className="mb-2 text-[11px] text-orange-400">
          时间到！已超时：{overtimeMinutes}:{overtimeRemainSeconds.toString().padStart(2, '0')}
        </div>
      )}

      <div className="flex items-center gap-2">
        {isOvertime ? (
          <>
            <button
              type="button"
              onClick={() => onCompleteTask(task.id)}
              className="rounded-full bg-emerald-500 px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-emerald-400"
            >
              结束任务
            </button>
            <button
              type="button"
              onClick={() => onExtendTask(task.id, 5)}
              className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[11px] text-white/75 transition-colors hover:bg-white/14"
            >
              +5min
            </button>
            <button
              type="button"
              onClick={() => onExtendTask(task.id, 10)}
              className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[11px] text-white/75 transition-colors hover:bg-white/14"
            >
              +10min
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onPauseTask(task.id)}
              className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[11px] text-white/75 transition-colors hover:bg-white/14"
            >
              {isRunning ? '暂停' : '继续'}
            </button>
            <button
              type="button"
              onClick={() => onCompleteTask(task.id)}
              className="rounded-full bg-emerald-500 px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-emerald-400"
            >
              完成
            </button>
            <button
              type="button"
              onClick={() => onCancelTask(task.id)}
              className="rounded-full border border-red-400/30 bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-300 transition-colors hover:bg-red-500/20"
            >
              取消
            </button>
          </>
        )}
        {task.subTasks.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[11px] text-white/75 transition-colors hover:bg-white/14"
          >
            {expanded ? '收起' : '展开'}
          </button>
        )}
      </div>

      <AnimatePresence>
        {expanded && task.subTasks.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden pt-2"
          >
            <SubtaskList
              subTasks={task.subTasks}
              onComplete={(subTaskId) => onCompleteSubTask(task.id, subTaskId)}
              onSkip={(subTaskId) => onSkipSubTask(task.id, subTaskId)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
