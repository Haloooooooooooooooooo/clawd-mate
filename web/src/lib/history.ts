import type { Subtask, Task, TaskStatus } from '../types';

export type HistorySubtaskDisplayStatus = 'done' | 'skipped' | 'pending';

export function getHistorySubtaskDisplayStatus(
  subtask: Pick<Subtask, 'status'>,
  taskStatus: TaskStatus
): HistorySubtaskDisplayStatus {
  if (subtask.status === 'skipped') {
    return 'skipped';
  }

  if (subtask.status === 'done' || taskStatus === 'done') {
    return 'done';
  }

  return 'pending';
}

export function getHistorySubtaskDisplayLabel(
  subtask: Pick<Subtask, 'status'>,
  taskStatus: TaskStatus
): string {
  const status = getHistorySubtaskDisplayStatus(subtask, taskStatus);
  if (status === 'done') return '已完成';
  if (status === 'skipped') return '跳过';
  return '';
}

export function normalizeHistorySubtasks(task: Pick<Task, 'subtasks' | 'status'>): Array<Subtask & { displayStatus: HistorySubtaskDisplayStatus; displayLabel: string }> {
  return task.subtasks.map((subtask) => ({
    ...subtask,
    displayStatus: getHistorySubtaskDisplayStatus(subtask, task.status),
    displayLabel: getHistorySubtaskDisplayLabel(subtask, task.status)
  }));
}
