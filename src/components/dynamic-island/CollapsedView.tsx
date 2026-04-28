import { AnimatePresence, motion } from 'framer-motion'
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
  const timeText = isOvertime
    ? '时间到了!'
    : `剩余时间: ${remainingMinutes}:${remainingRemainSeconds.toString().padStart(2, '0')}`

  return (
    <motion.div
      role="button"
      tabIndex={0}
      className="dynamic-island group relative w-[352px] cursor-pointer"
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
      <div
        data-tauri-drag-region
        onClick={(event) => event.stopPropagation()}
        className="absolute left-1/2 top-2 z-20 h-1.5 w-16 -translate-x-1/2 rounded-full bg-white/12 cursor-grab active:cursor-grabbing"
        aria-hidden="true"
      />

      <button
        type="button"
        data-no-drag="true"
        onClick={(event) => {
          event.stopPropagation()
          onCloseIsland()
        }}
        className="absolute right-2 top-2 z-30 flex h-6 w-6 items-center justify-center rounded-[6px] border border-orange-300/70 bg-orange-500/85 text-sm font-bold text-white opacity-0 scale-90 transition-all hover:bg-orange-400 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100"
        aria-label="Close island"
      >
        x
      </button>

      <div className="relative overflow-hidden rounded-[999px] border border-white/12 bg-[rgba(9,11,14,0.9)] px-3 py-2 shadow-[0_20px_55px_rgba(0,0,0,0.46),inset_0_0_40px_rgba(0,0,0,0.6)] backdrop-blur-[20px]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.08),rgba(255,255,255,0))]" />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-[45%] bg-[linear-gradient(to_right,rgba(110,231,183,0.16),rgba(110,231,183,0))]" />
        <div className="pointer-events-none absolute inset-[1px] rounded-[999px] border border-white/6" />
        <div className="pointer-events-none absolute inset-x-8 bottom-0 h-10 bg-[radial-gradient(ellipse_at_bottom,rgba(110,231,183,0.1),rgba(110,231,183,0)_72%)]" />

        <div className="relative flex items-center gap-2 min-h-[56px]">
          <div className="pointer-events-none absolute right-9 top-0 text-[11px] font-medium text-white/65">
            <span className="text-[#39FFD8]">{elapsedMinutes}</span>
            <span className="mx-0.5 text-white/42">/</span>
            <span>{plannedMinutes}</span>
            <span>min</span>
          </div>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center">
            <PetSprite status={petStatus} size="sm" scaleMultiplier={petScaleMultiplier} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-white/90">
                  {task.title}
                </div>
                <div className={`-mt-0.5 text-[11px] ${isOvertime ? 'font-semibold text-orange-400' : 'text-white/60'}`}>
                  {timeText}
                </div>
              </div>
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
                      完成
                    </button>
                    <button
                      type="button"
                      data-no-drag="true"
                      onClick={(event) => {
                        event.stopPropagation()
                        onExtend(5)
                      }}
                      className="h-[22px] rounded-full border border-white/15 bg-white/10 px-2.5 text-[10px] text-white/80 transition-colors hover:bg-white/15"
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
                      className="h-[22px] rounded-full border border-white/15 bg-white/10 px-2.5 text-[10px] text-white/80 transition-colors hover:bg-white/15"
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
                      className="h-[22px] rounded-full border border-white/15 bg-white/10 px-2.5 text-[10px] text-white/85 transition-colors hover:bg-white/15"
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
                      className="h-[22px] rounded-full border border-white/15 bg-white/10 px-2.5 text-[10px] text-white/80 transition-colors hover:bg-white/15"
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

