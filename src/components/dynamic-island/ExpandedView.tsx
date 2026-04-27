import { motion } from 'framer-motion';
import { Pause, Play, CheckCircle2, X } from 'lucide-react';
import type { Task } from '../../types/task';
import { ProgressBar } from './ProgressBar';
import { SubtaskList } from './SubtaskList';
import { ParallelTaskCard } from './ParallelTaskCard';

interface ExpandedViewProps {
  task: Task;
  tasks: Task[];
  progress: number;
  remainingSeconds: number;
  isRunning: boolean;
  isOvertime: boolean;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onExtend: (minutes: number) => void;
  onSwitchTask: (taskId: string) => void;
  onPauseTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onCancelTask: (taskId: string) => void;
  onExtendTask: (taskId: string, minutes: number) => void;
  onCompleteSubTask: (taskId: string, subTaskId: string) => void;
  onSkipSubTask: (taskId: string, subTaskId: string) => void;
  onAddTask: () => void;
  onGoHome: () => void;
  onCollapse: () => void;
}

export function ExpandedView({
  task,
  tasks,
  progress,
  remainingSeconds,
  isRunning,
  isOvertime,
  onPause,
  onResume,
  onComplete,
  onCancel,
  onExtend,
  onSwitchTask,
  onPauseTask,
  onCompleteTask,
  onCancelTask,
  onExtendTask,
  onCompleteSubTask,
  onSkipSubTask,
  onAddTask,
  onGoHome,
  onCollapse
}: ExpandedViewProps) {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const plannedSeconds = task.plannedDuration * 60;
  const overtimeSeconds = Math.max(0, task.actualDuration - plannedSeconds);
  const overtimeMinutes = Math.floor(overtimeSeconds / 60);
  const overtimeRemainSeconds = overtimeSeconds % 60;
  const displayElapsed = Math.floor(task.actualDuration / 60);
  const otherTasks = tasks.filter((item) => item.id !== task.id && item.status !== 'completed');

  return (
    <motion.div
      className="w-[460px]"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >
      <div className="rounded-[22px] border border-white/12 bg-black/90 shadow-[0_24px_80px_rgba(0,0,0,0.52)] backdrop-blur-2xl">
        <div className="h-full overflow-visible px-3 pb-3 pt-2">
          <div
            className="sticky top-0 z-10 mb-2 flex items-center justify-between rounded-[14px] bg-black/88 px-2 py-2 backdrop-blur-2xl"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                onCollapse();
              }
            }}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400 text-base shadow-[0_8px_24px_rgba(244,114,182,0.35)]">
                🦀
              </div>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold text-white/92">{task.title}</div>
                <div className="text-[11px] text-white/55">Desktop island is running</div>
              </div>
            </div>
            <button
              type="button"
              onClick={onCollapse}
              className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] text-white/70 transition-colors hover:bg-white/14"
            >
              收起
            </button>
          </div>

          <div className="mb-2 min-h-[136px] rounded-[14px] border border-white/10 bg-white/[0.03] p-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="text-[13px] text-white/75">
                {isOvertime ? (
                  <span className="text-orange-400">
                    时间到！已超时：{overtimeMinutes}:{overtimeRemainSeconds.toString().padStart(2, '0')}
                  </span>
                ) : (
                  `剩余 ${minutes}:${seconds.toString().padStart(2, '0')}`
                )}
              </div>
              <div className="text-[12px] text-white/62">{displayElapsed}/{task.plannedDuration}min</div>
            </div>
            <ProgressBar progress={progress} className="h-2" />
            {/* Action Buttons */}
            {isOvertime ? (
              // 时间结束时的按钮
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={onComplete}
                  className="flex-[2] rounded-[12px] bg-emerald-500 py-2 text-[12px] font-medium text-white transition-colors hover:bg-emerald-400 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={16} />
                  <span>结束任务</span>
                </button>
                <button
                  type="button"
                  onClick={() => onExtend(5)}
                  className="flex-1 rounded-[12px] border border-white/10 bg-white/8 py-2 text-[12px] text-white/75 transition-colors hover:bg-white/14 flex flex-col items-center justify-center"
                >
                  <span className="text-base">+5</span>
                  <span className="text-[9px] text-white/50">min</span>
                </button>
                <button
                  type="button"
                  onClick={() => onExtend(10)}
                  className="flex-1 rounded-[12px] border border-white/10 bg-white/8 py-2 text-[12px] text-white/75 transition-colors hover:bg-white/14 flex flex-col items-center justify-center"
                >
                  <span className="text-base">+10</span>
                  <span className="text-[9px] text-white/50">min</span>
                </button>
              </div>
            ) : (
              // 任务进行中的按钮
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={isRunning ? onPause : onResume}
                  className="flex-1 rounded-[12px] border border-white/10 bg-white/8 py-2 text-[12px] font-medium text-white/85 transition-colors hover:bg-white/15 flex items-center justify-center gap-1.5"
                >
                  {isRunning ? <Pause size={14} className="text-emerald-400" /> : <Play size={14} className="text-emerald-400" />}
                  <span>{isRunning ? '暂停' : '继续'}</span>
                </button>
                <button
                  type="button"
                  onClick={onComplete}
                  className="flex-1 rounded-[12px] border border-white/10 bg-white/8 py-2 text-[12px] font-medium text-white/85 transition-colors hover:bg-white/15 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  <span>完成</span>
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 rounded-[12px] border border-red-400/30 bg-red-500/10 py-2 text-[12px] font-medium text-red-400 transition-colors hover:bg-red-500/20 flex items-center justify-center gap-1.5"
                >
                  <X size={14} />
                  <span>取消</span>
                </button>
              </div>
            )}
          </div>

          {task.subTasks.length > 0 && (
            <section className="mb-2 rounded-[16px] border border-white/10 bg-white/[0.04] p-3">
              <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-white/35">Subtasks</div>
              <SubtaskList
                subTasks={task.subTasks}
                onComplete={(subTaskId) => onCompleteSubTask(task.id, subTaskId)}
                onSkip={(subTaskId) => onSkipSubTask(task.id, subTaskId)}
              />
            </section>
          )}

          {otherTasks.length > 0 && (
            <section className="mb-2 rounded-[16px] border border-white/10 bg-white/[0.04] p-3">
              <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-white/35">Parallel Tasks</div>
              <div className="max-h-[236px] space-y-1.5 overflow-y-auto pr-1 custom-scrollbar">
                {otherTasks.map((parallelTask) => (
                  <ParallelTaskCard
                    key={parallelTask.id}
                    task={parallelTask}
                    onSwitchTask={onSwitchTask}
                    onPauseTask={onPauseTask}
                    onCompleteTask={onCompleteTask}
                    onCancelTask={onCancelTask}
                    onExtendTask={onExtendTask}
                    onCompleteSubTask={onCompleteSubTask}
                    onSkipSubTask={onSkipSubTask}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onAddTask}
              className="rounded-[12px] border border-white/10 bg-white/8 px-3 py-2 text-[12px] text-white/80 transition-colors hover:bg-white/14"
            >
              添加任务
            </button>
            <button
              type="button"
              onClick={onGoHome}
              className="rounded-[12px] border border-white/10 bg-white/8 px-3 py-2 text-[12px] text-white/80 transition-colors hover:bg-white/14"
            >
              回到主页
            </button>
          </section>
        </div>
      </div>
    </motion.div>
  );
}
