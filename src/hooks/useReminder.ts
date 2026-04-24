import { useEffect, useRef, useCallback } from 'react';

export type ReminderType = 'halfTime' | 'fiveMinutesLeft' | 'timeUp';

export interface ReminderEvent {
  type: ReminderType;
  timestamp: Date;
}

interface ReminderConfig {
  onHalfTime?: () => void;
  onFiveMinutesLeft?: () => void;
  onTimeUp?: () => void;
  onReminder?: (event: ReminderEvent) => void;
}

export function useReminder(
  elapsedSeconds: number,
  plannedSeconds: number,
  config: ReminderConfig
) {
  const halfTimeTriggered = useRef(false);
  const fiveMinTriggered = useRef(false);
  const timeUpTriggered = useRef(false);

  const remainingSeconds = plannedSeconds - elapsedSeconds;

  const triggerReminder = useCallback((type: ReminderType) => {
    const event: ReminderEvent = {
      type,
      timestamp: new Date()
    };
    config.onReminder?.(event);
  }, [config]);

  useEffect(() => {
    // 时间过半
    if (
      config.onHalfTime &&
      elapsedSeconds >= plannedSeconds / 2 &&
      elapsedSeconds > 0 &&
      !halfTimeTriggered.current
    ) {
      halfTimeTriggered.current = true;
      config.onHalfTime();
      triggerReminder('halfTime');
    }

    // 剩余 5 分钟
    if (
      config.onFiveMinutesLeft &&
      remainingSeconds <= 300 &&
      remainingSeconds > 0 &&
      !fiveMinTriggered.current
    ) {
      fiveMinTriggered.current = true;
      config.onFiveMinutesLeft();
      triggerReminder('fiveMinutesLeft');
    }

    // 时间到
    if (
      config.onTimeUp &&
      remainingSeconds <= 0 &&
      elapsedSeconds > 0 &&
      !timeUpTriggered.current
    ) {
      timeUpTriggered.current = true;
      config.onTimeUp();
      triggerReminder('timeUp');
    }
  }, [elapsedSeconds, plannedSeconds, remainingSeconds, config, triggerReminder]);

  // 重置提醒状态（用于延长时间后）
  const reset = useCallback(() => {
    halfTimeTriggered.current = false;
    fiveMinTriggered.current = false;
    timeUpTriggered.current = false;
  }, []);

  // 重置特定类型的提醒
  const resetType = useCallback((type: ReminderType) => {
    switch (type) {
      case 'halfTime':
        halfTimeTriggered.current = false;
        break;
      case 'fiveMinutesLeft':
        fiveMinTriggered.current = false;
        break;
      case 'timeUp':
        timeUpTriggered.current = false;
        break;
    }
  }, []);

  return { reset, resetType };
}
