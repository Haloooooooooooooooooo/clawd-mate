import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { Task } from '../../types/task';
import { ProgressBar } from './ProgressBar';

interface CollapsedViewProps {
  task: Task;
  progress: number;
  isRunning: boolean;
  onPause: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onExpand: () => void;
}

export function CollapsedView({
  task,
  progress,
  isRunning,
  onPause,
  onComplete,
  onCancel,
  onExpand
}: CollapsedViewProps) {
  const [isHovering, setIsHovering] = useState(false);
  const elapsedMinutes = Math.floor(task.actualDuration / 60);
  const plannedMinutes = Math.max(1, task.plannedDuration);

  return (
    <motion.button
      type="button"
      className="w-[280px] cursor-pointer"
      onClick={onExpand}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      whileHover={{ scale: 1.008 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="rounded-[18px] border border-white/10 bg-black/90 px-3 py-2.5 shadow-[0_18px_60px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
        <div className="flex items-center gap-2.5">
          <motion.div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400 text-base shadow-[0_8px_24px_rgba(244,114,182,0.35)]"
            animate={{ rotate: [0, -4, 4, 0] }}
            transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 3 }}
          >
            馃
          </motion.div>

          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="min-w-0 truncate text-[13px] font-semibold text-white/90">{task.title}</div>
              <div className="shrink-0 text-[11px] font-medium text-white/60">
                {elapsedMinutes}/{plannedMinutes}min
              </div>
            </div>
            <ProgressBar progress={progress} className="h-1.5" />
          </div>

          <AnimatePresence>
            {isHovering && (
              <motion.div
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                className="ml-1 flex items-center gap-1.5"
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onPause();
                  }}
                  className="h-[22px] rounded-full border border-white/10 bg-white/10 px-2.5 text-[10px] text-white/80 transition-colors hover:bg-white/15"
                  aria-label={isRunning ? 'Pause task' : 'Resume task'}
                >
                  {isRunning ? '暂停' : '继续'}
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onComplete();
                  }}
                  className="h-[22px] rounded-full bg-emerald-500 px-2.5 text-[10px] font-medium text-white transition-colors hover:bg-emerald-400"
                  aria-label="Complete task"
                >
                  完成
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCancel();
                  }}
                  className="h-[22px] rounded-full border border-white/10 bg-white/8 px-2.5 text-[10px] text-white/70 transition-colors hover:bg-white/14"
                  aria-label="Cancel task"
                >
                  取消
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.button>
  );
}
