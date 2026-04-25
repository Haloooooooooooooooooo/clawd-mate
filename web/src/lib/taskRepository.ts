import { DailyRecord, Subtask, Task } from '../types';
import { supabase } from './supabase';

type DbHistoryRow = {
  id: string;
  title: string;
  status: 'done' | 'cancelled';
  total_duration_seconds: number;
  actual_duration_seconds: number;
  payload: { subtasks?: Subtask[] } | null;
  created_at: string;
};

function groupHistoryByDate(tasks: Task[]): DailyRecord[] {
  const byDate = new Map<string, Task[]>();
  tasks.forEach((task) => {
    const date = new Date(task.createdAt).toISOString().split('T')[0];
    const list = byDate.get(date) || [];
    list.push(task);
    byDate.set(date, list);
  });
  return Array.from(byDate.entries())
    .sort((a, b) => (a[0] > b[0] ? -1 : 1))
    .map(([date, groupedTasks]) => ({ date, tasks: groupedTasks }));
}

export async function loadCloudSnapshot(userId: string): Promise<{ tasks: Task[]; history: DailyRecord[] }> {
  const { data: historyRows, error: historyError } = await supabase
    .from('task_history')
    .select('id,title,status,total_duration_seconds,actual_duration_seconds,payload,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (historyError) throw historyError;

  const historyTasks: Task[] = ((historyRows as DbHistoryRow[] | null) || []).map((row) => {
    const createdAt = new Date(row.created_at).getTime();
    const total = Math.max(0, row.total_duration_seconds);
    const actual = Math.max(0, row.actual_duration_seconds);
    return {
      id: `history-${row.id}`,
      title: row.title,
      totalDuration: total,
      remainingTime: Math.max(0, total - actual),
      startTime: createdAt,
      endTime: createdAt,
      status: row.status,
      subtasks: Array.isArray(row.payload?.subtasks) ? row.payload!.subtasks : [],
      createdAt
    };
  });

  return {
    tasks: [],
    history: groupHistoryByDate(historyTasks)
  };
}

type SaveCloudOptions = {
  historyOnly?: boolean;
};

export async function saveCloudSnapshot(
  userId: string,
  tasks: Task[],
  history: DailyRecord[],
  options?: SaveCloudOptions
): Promise<void> {
  void tasks;
  void options;

  // Hard rule: never persist running/paused tasks to cloud.
  // We proactively clear historical leftovers from old versions.
  const { error: clearSubtasksError } = await supabase
    .from('subtasks')
    .delete()
    .eq('user_id', userId);
  if (clearSubtasksError) throw clearSubtasksError;

  const { error: clearTasksError } = await supabase
    .from('tasks')
    .delete()
    .eq('user_id', userId);
  if (clearTasksError) throw clearTasksError;

  const historyItems = history.flatMap((record) =>
    record.tasks
      .filter((task) => task.status === 'done' || task.status === 'cancelled')
      .map((task) => ({
        user_id: userId,
        task_id: null,
        title: task.title,
        mode: task.subtasks.length > 0 ? 'structured' : 'simple',
        status: task.status,
        total_duration_seconds: Math.max(0, task.totalDuration),
        actual_duration_seconds: Math.max(0, task.totalDuration - task.remainingTime),
        payload: {
          subtasks: task.subtasks
        },
        created_at: new Date(task.createdAt).toISOString()
      }))
  );

  const { error: clearHistoryError } = await supabase
    .from('task_history')
    .delete()
    .eq('user_id', userId);
  if (clearHistoryError) throw clearHistoryError;

  if (historyItems.length > 0) {
    const { error: insertHistoryError } = await supabase
      .from('task_history')
      .insert(historyItems);
    if (insertHistoryError) throw insertHistoryError;
  }
}
