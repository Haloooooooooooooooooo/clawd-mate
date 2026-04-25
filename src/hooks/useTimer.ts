import { useCallback, useEffect, useRef, useState } from 'react';

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
  initialElapsed?: number; // seconds
  syncKey?: string | null; // task id or equivalent key for forced resync when switching task
  onTick?: (elapsedSeconds: number) => void;
}

export function useTimer(options: UseTimerOptions): UseTimerReturn {
  const { plannedDuration, initialElapsed = 0, syncKey = null, onTick } = options;

  const [elapsedSeconds, setElapsedSeconds] = useState(initialElapsed);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(initialElapsed);
  const lastInitialElapsedRef = useRef(initialElapsed);
  const lastSyncKeyRef = useRef<string | null>(syncKey);

  useEffect(() => {
    // Task switch: always align elapsed value with the new task immediately.
    if (syncKey !== lastSyncKeyRef.current) {
      elapsedRef.current = initialElapsed;
      setElapsedSeconds(initialElapsed);
      lastInitialElapsedRef.current = initialElapsed;
      lastSyncKeyRef.current = syncKey;
      return;
    }

    // Non-switch update: avoid resetting every second from onTick write-backs.
    if (Math.abs(initialElapsed - lastInitialElapsedRef.current) > 1) {
      elapsedRef.current = initialElapsed;
      setElapsedSeconds(initialElapsed);
      lastInitialElapsedRef.current = initialElapsed;
    }
  }, [initialElapsed, syncKey]);

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
