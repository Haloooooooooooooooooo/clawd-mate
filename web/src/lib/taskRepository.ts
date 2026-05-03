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

  let dailyReportRows: DbDailyReportImageRow[] | null = [];
  {
    const response = await supabase
      .from('daily_report_images')
      .select('id,report_date,image_data_url,prompt_payload,debug_logs,created_at')
      .eq('user_id', userId)
      .order('report_date', { ascending: false })
      .order('created_at', { ascending: true });

    if (response.error) {
      if (!isMissingRelationError(response.error, 'daily_report_images')) {
        throw response.error;
      }
      console.warn('[cloud] daily_report_images missing, skip image hydration');
      dailyReportRows = [];
    } else {
      dailyReportRows = (response.data as DbDailyReportImageRow[] | null) || [];
    }
  }

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

  const dailyReportImages = (dailyReportRows || []).reduce(
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

function isMissingRelationError(error: unknown, relation: string): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { code?: string; message?: string };
  if (maybe.code !== 'PGRST205') return false;
  return (maybe.message || '').toLowerCase().includes(relation.toLowerCase());
}

function normalizeSubtasksForKey(subtasks: Subtask[] | undefined): string {
  if (!Array.isArray(subtasks)) return '[]';
  return JSON.stringify(
    subtasks.map((subtask) => ({
      title: subtask.title ?? '',
      status: subtask.status ?? 'pending'
    }))
  );
}

function buildHistoryKey(input: {
  title: string;
  status: 'done' | 'cancelled';
  totalDurationSeconds: number;
  actualDurationSeconds: number;
  createdAtIso: string;
  subtasks?: Subtask[];
}): string {
  return [
    input.title,
    input.status,
    String(input.totalDurationSeconds),
    String(input.actualDurationSeconds),
    input.createdAtIso,
    normalizeSubtasksForKey(input.subtasks)
  ].join('|');
}

function buildDailyReportKey(input: {
  reportDate: string;
  imageDataUrl: string;
  createdAtIso: string;
}): string {
  return [input.reportDate, input.imageDataUrl, input.createdAtIso].join('|');
}

export async function saveCloudSnapshot(
  userId: string,
  tasks: Task[],
  history: DailyRecord[],
  dailyReportImagesByDate: Record<string, DailyReportImage[]>,
  options?: SaveCloudOptions
): Promise<void> {
  void tasks;

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
        created_at: new Date(task.endTime ?? task.createdAt).toISOString(),
        _dedupe_key: buildHistoryKey({
          title: task.title,
          status: task.status,
          totalDurationSeconds: Math.max(0, task.totalDuration),
          actualDurationSeconds: getTaskActualDurationSeconds(task),
          createdAtIso: new Date(task.endTime ?? task.createdAt).toISOString(),
          subtasks: task.subtasks
        })
      }))
  );

  const { data: cloudHistoryRows, error: cloudHistoryError } = await supabase
    .from('task_history')
    .select('title,status,total_duration_seconds,actual_duration_seconds,payload,created_at')
    .eq('user_id', userId);
  if (cloudHistoryError) throw cloudHistoryError;

  const existingHistoryKeys = new Set(
    ((cloudHistoryRows as DbHistoryRow[] | null) || []).map((row) =>
      buildHistoryKey({
        title: row.title,
        status: row.status,
        totalDurationSeconds: Math.max(0, row.total_duration_seconds),
        actualDurationSeconds: Math.max(0, row.actual_duration_seconds),
        createdAtIso: new Date(row.created_at).toISOString(),
        subtasks: Array.isArray(row.payload?.subtasks) ? row.payload?.subtasks : []
      })
    )
  );

  const historyItemsToInsert = historyItems
    .filter((item) => !existingHistoryKeys.has(item._dedupe_key))
    .map(({ _dedupe_key, ...row }) => row);

  if (historyItemsToInsert.length > 0) {
    const { error: insertHistoryError } = await supabase
      .from('task_history')
      .insert(historyItemsToInsert);
    if (insertHistoryError) throw insertHistoryError;
  }

  if (options?.historyOnly) {
    return;
  }

  const dailyReportItems = Object.entries(dailyReportImagesByDate).flatMap(([date, list]) =>
    list.slice(-2).map((item) => ({
      user_id: userId,
      report_date: date,
      image_data_url: item.imageDataUrl,
      prompt_payload: item.promptPayload ?? null,
      debug_logs: item.debugLogs ?? null,
      created_at: new Date(item.createdAt).toISOString(),
      _dedupe_key: buildDailyReportKey({
        reportDate: date,
        imageDataUrl: item.imageDataUrl,
        createdAtIso: new Date(item.createdAt).toISOString()
      })
    }))
  );

  const dailyReportResponse = await supabase
    .from('daily_report_images')
    .select('report_date,image_data_url,created_at')
    .eq('user_id', userId);
  if (dailyReportResponse.error) {
    if (isMissingRelationError(dailyReportResponse.error, 'daily_report_images')) {
      console.warn('[cloud] daily_report_images missing, skip image sync');
      return;
    }
    throw dailyReportResponse.error;
  }
  const cloudDailyReportRows = (dailyReportResponse.data as DbDailyReportImageRow[] | null) || [];

  const existingDailyReportKeys = new Set(
    cloudDailyReportRows.map((row) =>
      buildDailyReportKey({
        reportDate: row.report_date,
        imageDataUrl: row.image_data_url,
        createdAtIso: new Date(row.created_at).toISOString()
      })
    )
  );

  const dailyReportItemsToInsert = dailyReportItems
    .filter((item) => !existingDailyReportKeys.has(item._dedupe_key))
    .map(({ _dedupe_key, ...row }) => row);

  if (dailyReportItemsToInsert.length > 0) {
    const { error: insertDailyReportImagesError } = await supabase
      .from('daily_report_images')
      .insert(dailyReportItemsToInsert);
    if (insertDailyReportImagesError) throw insertDailyReportImagesError;
  }
}
