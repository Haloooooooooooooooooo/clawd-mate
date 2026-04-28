import { AnimatePresence, motion } from 'framer-motion'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useState } from 'react'
import { PetSprite, type PetStatus } from '@pet'
import type { Task } from '../../types/task'
import { ProgressBar } from './ProgressBar'

interface CollapsedViewProps {
  task: Task
  progress: number
  remainingSeconds: number
  isOvertime: boolean
  isRunning: boolean
  onPause: () => void
  onComplete: () => void
  onExtend: (minutes: number) => void
  onCancel: () => void
  onExpand: () => void
  onCloseIsland: () => void
  petStatus: PetStatus
}

export function CollapsedView({
  task,
  progress,
  remainingSeconds,
  isOvertime,
  isRunning,
  onPause,
  onComplete,
  onExtend,
  onCancel,
  onExpand,
  onCloseIsland,
  petStatus,
}: CollapsedViewProps) {
  const [isHovering, setIsHovering] = useState(false)
  const petScaleMultiplier = petStatus === 'working' ? 1.22 : 1
  const elapsedMinutes = Math.floor(task.actualDuration / 60)
  const plannedMinutes = Math.max(1, task.plannedDuration)
  const remainingMinutes = Math.floor(Math.max(0, remainingSeconds) / 60)
  const remainingRemainSeconds = Math.max(0, remainingSeconds) % 60

  const handleDragMouseDown = async (event: React.MouseEvent<HTMLElement>) => {
    if (event.button !== 0) return

    const target = event.target as HTMLElement | null
    if (!target) return
    if (target.closest('button, input, textarea, select, a, [data-no-drag="true"]')) {
      return
    }

    try {
      await getCurrentWindow().startDragging()
    } catch {
      // Ignore browser-only mode or denied environments.
    }
  }

  return (
    <motion.div
      role="button"
      tabIndex={0}
      data-tauri-drag-region
      className="group relative w-[352px] cursor-pointer"
      onMouseDown={handleDragMouseDown}
      onClick={onExpand}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onExpand()
        }
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      whileHover={{ scale: 1.008 }}
      whileTap={{ scale: 0.99 }}
    >
      <button
        type="button"
        data-no-drag="true"
        onClick={(event) => {
          event.stopPropagation()
          onCloseIsland()
        }}
        className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-[6px] border border-orange-300/70 bg-orange-500/85 text-sm font-bold text-white opacity-0 scale-90 transition-all hover:bg-orange-400 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100"
        aria-label="Close island"
      >
        ×
      </button>

      <div className="rounded-[18px] border border-white/10 bg-black/90 px-3 py-2 shadow-[0_18px_60px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
        <div className="flex items-center gap-2">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center">
            <PetSprite status={petStatus} size="sm" scaleMultiplier={petScaleMultiplier} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="min-w-0 truncate text-[13px] font-semibold text-white/90">{task.title}</div>
              <div className="shrink-0 text-[11px] font-medium text-white/60">
                {elapsedMinutes}/{plannedMinutes}min
              </div>
            </div>
            <div className="-mt-1 mb-0.5 text-[11px] text-white/60">
              {isOvertime
                ? '时间到啦！'
                : `剩余 ${remainingMinutes}:${remainingRemainSeconds.toString().padStart(2, '0')}`}
            </div>
            <div className="-mt-0.5">
              <ProgressBar progress={progress} className="h-1.5 w-[88%]" />
            </div>
          </div>

          <AnimatePresence>
            {isHovering && (
              <motion.div
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                className="ml-1 flex items-center gap-1.5"
              >
                {isOvertime ? (
                  <>
                    <button
                      type="button"
                      data-no-drag="true"
                      onClick={(event) => {
                        event.stopPropagation()
                        onComplete()
                      }}
                      className="h-[22px] rounded-full bg-emerald-500 px-2 text-[11px] font-medium text-white transition-colors hover:bg-emerald-400"
                      aria-label="Complete task"
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      data-no-drag="true"
                      onClick={(event) => {
                        event.stopPropagation()
                        onExtend(5)
                      }}
                      className="h-[22px] rounded-full border border-white/10 bg-white/8 px-2.5 text-[10px] text-white/70 transition-colors hover:bg-white/14"
                      aria-label="Extend 5 minutes"
                    >
                      +5min
                    </button>
                    <button
                      type="button"
                      data-no-drag="true"
                      onClick={(event) => {
                        event.stopPropagation()
                        onExtend(10)
                      }}
                      className="h-[22px] rounded-full border border-white/10 bg-white/8 px-2.5 text-[10px] text-white/70 transition-colors hover:bg-white/14"
                      aria-label="Extend 10 minutes"
                    >
                      +10min
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      data-no-drag="true"
                      onClick={(event) => {
                        event.stopPropagation()
                        onPause()
                      }}
                      className="h-[22px] rounded-full border border-white/10 bg-white/10 px-2.5 text-[10px] text-white/80 transition-colors hover:bg-white/15"
                      aria-label={isRunning ? 'Pause task' : 'Resume task'}
                    >
                      {isRunning ? '暂停' : '继续'}
                    </button>
                    <button
                      type="button"
                      data-no-drag="true"
                      onClick={(event) => {
                        event.stopPropagation()
                        onComplete()
                      }}
                      className="h-[22px] rounded-full bg-emerald-500 px-2.5 text-[10px] font-medium text-white transition-colors hover:bg-emerald-400"
                      aria-label="Complete task"
                    >
                      完成
                    </button>
                    <button
                      type="button"
                      data-no-drag="true"
                      onClick={(event) => {
                        event.stopPropagation()
                        onCancel()
                      }}
                      className="h-[22px] rounded-full border border-white/10 bg-white/8 px-2.5 text-[10px] text-white/70 transition-colors hover:bg-white/14"
                      aria-label="Cancel task"
                    >
                      取消
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
