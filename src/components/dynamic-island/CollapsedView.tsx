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
    ? 'Time is up'
    : `Remaining ${remainingMinutes}:${remainingRemainSeconds.toString().padStart(2, '0')}`

  return (
    <motion.div
      role="button"
      tabIndex={0}
      className="group relative w-[352px] cursor-pointer"
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
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[-2px] rounded-[20px] bg-[conic-gradient(from_0deg_at_50%_50%,rgba(138,255,222,0.08)_0deg,rgba(63,255,213,0.82)_70deg,rgba(199,255,245,0.36)_128deg,rgba(14,121,90,0.88)_205deg,rgba(40,255,210,0.62)_290deg,rgba(138,255,222,0.08)_360deg)] opacity-90 blur-[10px]"
        animate={{ rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[18px] border border-emerald-300/35 shadow-[0_0_18px_rgba(63,255,213,0.28),0_0_34px_rgba(41,230,200,0.14)]"
      />
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
        className="absolute right-2 top-2 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-white/25 bg-white/10 text-sm font-bold text-white/85 opacity-0 scale-90 transition-all hover:bg-white/20 hover:text-white group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100"
        aria-label="Close island"
      >
        x
      </button>

      <div className="relative overflow-hidden rounded-[18px] border border-emerald-200/20 bg-[radial-gradient(circle_at_8%_50%,rgba(79,255,222,0.22),rgba(6,14,26,0.96)_40%),radial-gradient(circle_at_72%_20%,rgba(114,255,226,0.14),transparent_62%),linear-gradient(110deg,rgba(8,19,24,0.99)_0%,rgba(5,12,18,0.98)_100%)] px-3 py-2 shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset,0_18px_60px_rgba(0,0,0,0.48),0_0_24px_rgba(29,214,181,0.16)] backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-x-10 bottom-0 h-12 bg-[radial-gradient(ellipse_at_bottom,rgba(23,255,207,0.2),rgba(23,255,207,0)_68%)]" />
        <div className="pointer-events-none absolute inset-0 rounded-[18px] border border-white/10" />

        <div className="relative flex items-center gap-2">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center">
            <PetSprite status={petStatus} size="sm" scaleMultiplier={petScaleMultiplier} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-white/90">
                  {task.title}
                </div>
                <div className="-mt-0.5 text-[11px] text-white/60">
                  {timeText}
                </div>
              </div>
              <div className="shrink-0 text-[11px] font-medium text-white/60">
                <span className="text-[#39FFD8]">{elapsedMinutes}</span>
                <span className="mx-0.5 text-white/42">/</span>
                <span>{plannedMinutes}</span>
                <span>min</span>
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
                      ✓
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
