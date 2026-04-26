import { format } from 'date-fns';
import type { Task } from '../types';

export function getLocalDateKey(input: Date | number | string): string {
  return format(new Date(input), 'yyyy-MM-dd');
}

export function getTaskHistoryDateKey(task: Pick<Task, 'createdAt' | 'endTime'>): string {
  return getLocalDateKey(task.endTime ?? task.createdAt);
}

export function getTaskTerminalTimestamp(task: Pick<Task, 'createdAt' | 'endTime'>): number {
  return task.endTime ?? task.createdAt;
}
