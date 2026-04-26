import type { Task } from '../types';

export function getTaskActualDurationSeconds(task: Pick<Task, 'totalDuration' | 'remainingTime'>): number {
  return Math.max(0, task.totalDuration - task.remainingTime);
}

export function formatDurationMinutes(task: Pick<Task, 'totalDuration' | 'remainingTime'>): number {
  return Math.floor(getTaskActualDurationSeconds(task) / 60);
}
