import { DailyRecord, DailyReportImage, Subtask, Task } from '../types';
import { getTaskHistoryDateKey, getTaskTerminalTimestamp } from './date';
import { getTaskActualDurationSeconds } from './taskTime';
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

type DbDailyReportImageRow = {
  id: string;
  report_date: string;
  image_data_url: string;
  prompt_payload: string | null;
  debug_logs: string[] | null;
  created_at: string;
};

function groupHistoryByDate(tasks: Task[]): DailyRecord[] {
  const byDate = new Map<string, Task[]>();
  tasks.forEach((task) => {
    const date = getTaskHistoryDateKey(task);
    const list = byDate.get(date) || [];
    list.push(task);
    byDate.set(date, list);
  });
  return Array.from(byDate.entries())
    .sort((a, b) => (a[0] > b[0] ? -1 : 1))
    .map(([date, groupedTasks]) => ({
      date,
      tasks: groupedTasks.sort((a, b) => getTaskTerminalTimestamp(a) - getTaskTerminalTimestamp(b))
    }));
}

export async function loadCloudSnapshot(
  userId: string
): Promise<{ tasks: Task[]; history: DailyRecord[]; dailyReportImages: Record<string, DailyReportImage[]> }> {
  const { data: historyRows, error: historyError } = await supabase
    .from('task_history')
    .select('id,title,status,total_duration_seconds,actual_duration_seconds,payload,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (historyError) throw historyError;

  const { data: dailyReportRows, error: dailyReportError } = await supabase
    .from('daily_report_images')
    .select('id,report_date,image_data_url,prompt_payload,debug_logs,created_at')
    .eq('user_id', userId)
    .order('report_date', { ascending: false })
    .order('created_at', { ascending: true });

  if (dailyReportError) throw dailyReportError;

  const historyTasks: Task[] = ((historyRows as DbHistoryRow[] | null) || []).map((row) => {
    const createdAt = new Date(row.created_at).getTime();
    const total = Math.max(0, row.total_duration_seconds);
    const actual = Math.max(0, row.actual_duration_seconds);
    return {
      id: `history-${row.id}`,
      title: row.title,
      totalDuration: total,
      remainingTime: Math.max(0, total - actual),
      actualDurationSeconds: actual,
      startTime: createdAt,
      endTime: createdAt,
      status: row.status,
      subtasks: Array.isArray(row.payload?.subtasks) ? row.payload!.subtasks : [],
      createdAt
    };
  });

  const dailyReportImages = ((dailyReportRows as DbDailyReportImageRow[] | null) || []).reduce(
    (acc, row) => {
      const list = acc[row.report_date] || [];
      list.push({
        id: row.id,
        date: row.report_date,
        imageDataUrl: row.image_data_url,
        promptPayload: row.prompt_payload ?? undefined,
        debugLogs: Array.isArray(row.debug_logs) ? row.debug_logs : undefined,
        createdAt: new Date(row.created_at).getTime()
      });
      acc[row.report_date] = list.slice(-2);
      return acc;
    },
    {} as Record<string, DailyReportImage[]>
  );

  return {
    tasks: [],
    history: groupHistoryByDate(historyTasks),
    dailyReportImages
  };
}

type SaveCloudOptions = {
  historyOnly?: boolean;
};

export async function saveCloudSnapshot(
  userId: string,
  tasks: Task[],
  history: DailyRecord[],
  dailyReportImagesByDate: Record<string, DailyReportImage[]>,
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
        actual_duration_seconds: getTaskActualDurationSeconds(task),
        payload: {
          subtasks: task.subtasks
        },
        created_at: new Date(task.endTime ?? task.createdAt).toISOString()
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

  const { error: clearDailyReportImagesError } = await supabase
    .from('daily_report_images')
    .delete()
    .eq('user_id', userId);
  if (clearDailyReportImagesError) throw clearDailyReportImagesError;

  const dailyReportItems = Object.entries(dailyReportImagesByDate).flatMap(([date, list]) =>
    list.slice(-2).map((item) => ({
      user_id: userId,
      report_date: date,
      image_data_url: item.imageDataUrl,
      prompt_payload: item.promptPayload ?? null,
      debug_logs: item.debugLogs ?? null,
      created_at: new Date(item.createdAt).toISOString()
    }))
  );

  if (dailyReportItems.length > 0) {
    const { error: insertDailyReportImagesError } = await supabase
      .from('daily_report_images')
      .insert(dailyReportItems);
    if (insertDailyReportImagesError) throw insertDailyReportImagesError;
  }
}
