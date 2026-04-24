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
  onTick?: (elapsedSeconds: number) => void;
}

export function useTimer(options: UseTimerOptions): UseTimerReturn {
  const { plannedDuration, onTick } = options;

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  const plannedSeconds = plannedDuration * 60;
  const remainingSeconds = Math.max(0, plannedSeconds - elapsedSeconds);
  const progress = plannedSeconds > 0 ? elapsedSeconds / plannedSeconds : 0;
  const isOvertime = elapsedSeconds > plannedSeconds;

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
  }, [pause, plannedDuration]);

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
