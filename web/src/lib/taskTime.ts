import type { Task } from '../types';

export function getTaskActualDurationSeconds(
  task: Pick<Task, 'totalDuration' | 'remainingTime' | 'actualDurationSeconds'>
): number {
  if (typeof task.actualDurationSeconds === 'number' && Number.isFinite(task.actualDurationSeconds)) {
    return Math.max(0, task.actualDurationSeconds);
  }
  return Math.max(0, task.totalDuration - task.remainingTime);
}

export function formatDurationMinutes(
  task: Pick<Task, 'totalDuration' | 'remainingTime' | 'actualDurationSeconds'>
): number {
  return Math.floor(getTaskActualDurationSeconds(task) / 60);
}
