import { useEffect, useRef, useState, useCallback } from 'react';

interface UseTimerReturn {
  elapsedSeconds: number;
  remainingSeconds: number;
  progress: number;
  isOvertime: boolean;
  isRunning: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
}

interface UseTimerOptions {
  plannedDuration: number; // minutes
  initialElapsed?: number; // seconds, 用于恢复计时
  onTick?: (elapsedSeconds: number) => void;
}

export function useTimer(options: UseTimerOptions): UseTimerReturn {
  const { plannedDuration, initialElapsed = 0, onTick } = options;

  const [elapsedSeconds, setElapsedSeconds] = useState(initialElapsed);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(initialElapsed);
  const lastInitialElapsedRef = useRef(initialElapsed);

  // 只在 initialElapsed 发生显著变化时同步（切换任务时）
  // 避免每次 onTick 更新时重置
  useEffect(() => {
    // 只有当 initialElapsed 与当前值差异大于 1 秒时才同步
    // 这表示切换了任务，而不是正常的计时更新
    if (Math.abs(initialElapsed - lastInitialElapsedRef.current) > 1) {
      elapsedRef.current = initialElapsed;
      setElapsedSeconds(initialElapsed);
      lastInitialElapsedRef.current = initialElapsed;
    }
  }, [initialElapsed]);

  const plannedSeconds = plannedDuration * 60;
  const remainingSeconds = Math.max(0, plannedSeconds - elapsedSeconds);
  const progress = plannedSeconds > 0 ? elapsedSeconds / plannedSeconds : 0;
  const isOvertime = elapsedSeconds >= plannedSeconds && elapsedSeconds > 0;

  const start = useCallback(() => {
    if (intervalRef.current) return;

    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsedSeconds(elapsedRef.current);
      onTick?.(elapsedRef.current);
    }, 1000);
  }, [onTick]);

  const pause = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    pause();
    elapsedRef.current = 0;
    setElapsedSeconds(0);
    lastInitialElapsedRef.current = 0;
  }, [pause]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    elapsedSeconds,
    remainingSeconds,
    progress,
    isOvertime,
    isRunning,
    start,
    pause,
    reset
  };
}
