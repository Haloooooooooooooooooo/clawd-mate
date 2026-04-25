/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Task, TaskStatus, DailyRecord, User, SubtaskStatus } from '../types';
import { BridgeTaskPayload, pushTaskFromWeb, setIslandVisibility } from '../lib/islandBridge';
import { loadCloudSnapshot, saveCloudSnapshot } from '../lib/taskRepository';

type BridgeTaskStatus = 'active' | 'paused' | 'completed' | 'cancelled';
type AddTaskOptions = {
  source?: 'local' | 'sync';
  syncId?: string;
  status?: TaskStatus;
  elapsedSeconds?: number;
};

function mapBridgeStatusToWeb(status?: BridgeTaskStatus): TaskStatus {
  if (status === 'paused') return 'paused';
  if (status === 'completed') return 'done';
  if (status === 'cancelled') return 'cancelled';
  return 'running';
}

function mapWebStatusToBridge(status: TaskStatus): BridgeTaskStatus {
  if (status === 'paused') return 'paused';
  if (status === 'done') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  return 'active';
}

function mapWebSubtaskStatusToBridge(status: SubtaskStatus): 'pending' | 'skipped' | 'done' {
  if (status === 'done') return 'done';
  if (status === 'skipped') return 'skipped';
  return 'pending';
}

function mapBridgeSubtaskStatusToWeb(status?: string): SubtaskStatus {
  if (status === 'done' || status === 'completed') return 'done';
  if (status === 'skipped') return 'skipped';
  return 'pending';
}

function appendHistory(history: DailyRecord[], task: Task): DailyRecord[] {
  const today = new Date().toISOString().split('T')[0];
  const nextHistory = [...history];
  const dayRecord = nextHistory.find((item) => item.date === today);
  if (dayRecord) {
    dayRecord.tasks.push(task);
  } else {
    nextHistory.unshift({ date: today, tasks: [task] });
  }
  return nextHistory;
}

function normalizeSubtasksForBridge(task: Task): Array<{ title: string; status: SubtaskStatus }> {
  const rawSubtasks = task.subtasks as unknown;
  if (!Array.isArray(rawSubtasks)) {
    return [];
  }
  return rawSubtasks
    .map((subtask) => {
      if (typeof subtask === 'string') {
        const title = subtask.trim();
        return title ? { title, status: 'pending' as SubtaskStatus } : null;
      }
      if (subtask && typeof subtask === 'object' && typeof subtask.title === 'string') {
        const title = subtask.title.trim();
        if (!title) return null;
        const rawStatus = typeof subtask.status === 'string' ? subtask.status : 'pending';
        const status = mapBridgeSubtaskStatusToWeb(rawStatus);
        return { title, status };
      }
      return null;
    })
    .filter((subtask): subtask is { title: string; status: SubtaskStatus } => Boolean(subtask));
}

function getEffectiveRemainingTime(task: Task, now = Date.now()): number {
  if (task.status !== 'running') {
    return Math.max(0, task.remainingTime);
  }
  const elapsedSinceResume = Math.max(0, Math.floor((now - task.startTime) / 1000));
  return Math.max(0, task.remainingTime - elapsedSinceResume);
}

function getEffectiveElapsedSeconds(task: Task, now = Date.now()): number {
  return Math.max(0, task.totalDuration - getEffectiveRemainingTime(task, now));
}

function buildBridgePayload(task: Task, statusOverride?: TaskStatus, focusedOverride?: boolean): BridgeTaskPayload {
  const now = Date.now();
  const status = statusOverride ?? task.status;
  const elapsedSeconds = status === 'running'
    ? getEffectiveElapsedSeconds(task, now)
    : Math.max(0, task.totalDuration - task.remainingTime);
  const normalizedSubtasks = normalizeSubtasksForBridge(task);
  return {
    sync_id: task.syncId || task.id,
    title: task.title,
    duration_minutes: Math.max(1, Math.ceil(task.totalDuration / 60)),
    mode: normalizedSubtasks.length > 0 ? 'structured' : 'simple',
    subtasks: normalizedSubtasks.map((subtask) => ({
      title: subtask.title,
      status: mapWebSubtaskStatusToBridge(subtask.status)
    })),
    status: mapWebStatusToBridge(status),
    elapsed_seconds: elapsedSeconds,
    focused: focusedOverride,
    updated_at_ms: now
  };
}

interface AppState {
  tasks: Task[];
  history: DailyRecord[];
  closedSyncIds: Record<string, 'done' | 'cancelled'>;
  lastTaskSyncAtById: Record<string, number>;
  localStatusLockBySyncId: Record<string, { status: TaskStatus; until: number }>;
  lastFocusSyncAt: number;
  lastBridgeSyncAt: number;
  activeTaskId: string | null;
  user: User | null;
  isLoggedIn: boolean;
  isIslandVisible: boolean;
  addTask: (
    title: string,
    durationMinutes: number,
    subtasks: string[],
    options?: AddTaskOptions
  ) => void;
  applyBridgeTask: (payload: BridgeTaskPayload) => void;
  updateTaskStatus: (id: string, status: TaskStatus) => void;
  updateRemainingTime: (id: string, delta: number) => void;
  toggleSubtask: (id: string, subtaskId: string) => void;
  skipSubtask: (id: string, subtaskId: string) => void;
  deleteTask: (id: string) => void;
  setActiveTask: (id: string | null) => void;
  completeTask: (id: string) => void;
  cancelTask: (id: string) => void;
  addTimeToTask: (id: string, minutes: number) => void;
  clearTodayHistory: () => void;
  setLoggedIn: (
    isLoggedIn: boolean,
    user?: User | null,
    options?: { clearDataOnLogout?: boolean }
  ) => void;
  hydrateCloudData: (userId: string) => Promise<void>;
  syncCloudData: (options?: { historyOnly?: boolean }) => Promise<void>;
  toggleIsland: () => void;
  setIslandVisible: (visible: boolean) => void;
}

let cloudSyncTimer: number | undefined;

function queueCloudSync(options?: { historyOnly?: boolean }) {
  if (cloudSyncTimer) {
    window.clearTimeout(cloudSyncTimer);
  }
  cloudSyncTimer = window.setTimeout(() => {
    const state = useStore.getState();
    void state.syncCloudData(options);
  }, 400);
}

function getGuestStorage() {
  return createJSONStorage(() => localStorage);
}

function mergeHistoryRecords(localHistory: DailyRecord[], cloudHistory: DailyRecord[]): DailyRecord[] {
  const allTasks = [...cloudHistory.flatMap((record) => record.tasks), ...localHistory.flatMap((record) => record.tasks)];
  const unique = new Map<string, Task>();

  allTasks.forEach((task) => {
    const normalizedSubtasks = task.subtasks
      .map((subtask) => `${subtask.title.trim()}#${subtask.status}`)
      .join('||');
    // Use a business fingerprint instead of task.id.
    // Same record from local/cloud can have different ids.
    const key = [
      task.title.trim(),
      task.status,
      String(task.createdAt),
      String(task.totalDuration),
      String(task.remainingTime),
      normalizedSubtasks
    ].join('|');
    if (!unique.has(key)) {
      unique.set(key, task);
    }
  });

  const grouped = new Map<string, Task[]>();
  Array.from(unique.values()).forEach((task) => {
    const date = new Date(task.createdAt).toISOString().split('T')[0];
    const list = grouped.get(date) || [];
    list.push(task);
    grouped.set(date, list);
  });

  return Array.from(grouped.entries())
    .sort((a, b) => (a[0] > b[0] ? -1 : 1))
    .map(([date, tasks]) => ({ date, tasks }));
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      tasks: [],
      history: [],
      closedSyncIds: {},
      lastTaskSyncAtById: {},
      localStatusLockBySyncId: {},
      lastFocusSyncAt: 0,
      lastBridgeSyncAt: 0,
      activeTaskId: null,
      user: null,
      isLoggedIn: false,
      isIslandVisible: false,

      addTask: (title, durationMinutes, subtaskTitles, options) => set((state) => {
        const normalizedStatus = options?.status ?? 'running';
        const elapsedSeconds = Math.max(0, options?.elapsedSeconds ?? 0);
        const totalDuration = Math.max(60, Math.round(durationMinutes * 60));
        const remainingTime = Math.max(0, totalDuration - elapsedSeconds);
        const newTask: Task = {
          id: Math.random().toString(36).substring(7),
          syncId: options?.syncId || `web-${Math.random().toString(36).slice(2, 10)}`,
          title,
          totalDuration,
          remainingTime,
          startTime: Date.now(),
          status: normalizedStatus,
          subtasks: subtaskTitles.map((subtask) => ({
            id: Math.random().toString(36).substring(7),
            title: subtask,
            status: 'pending'
          })),
          createdAt: Date.now()
        };

        if (options?.source !== 'sync') {
          void pushTaskFromWeb(buildBridgePayload(newTask));
        }

        const hasFocusedTask =
          !!state.activeTaskId &&
          state.tasks.some(
            (task) => task.id === state.activeTaskId && (task.status === 'running' || task.status === 'paused')
          );
        const shouldSwitchActive = !hasFocusedTask;
        const nextState = {
          tasks: [...state.tasks, newTask],
          activeTaskId: shouldSwitchActive ? newTask.id : state.activeTaskId
        };
        if (state.isLoggedIn && state.user?.id) {
          queueCloudSync();
        }
        return nextState;
      }),

      applyBridgeTask: (payload) => set((state) => {
        const title = payload.title?.trim();
        const durationMinutes = Number(payload.duration_minutes);
        if (!title || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
          return state;
        }
        const now = Date.now();

        const syncId = payload.sync_id?.trim() || `bridge-${title}-${durationMinutes}`;
        const mappedStatusRaw = mapBridgeStatusToWeb(payload.status);
        const isClosedSync = Boolean(state.closedSyncIds[syncId]);
        const incomingUpdatedAt = Number.isFinite(payload.updated_at_ms)
          ? Number(payload.updated_at_ms)
          : Date.now();
        const lastTaskSyncAt = state.lastTaskSyncAtById[syncId] || 0;
        const canApplyTaskUpdate = incomingUpdatedAt >= lastTaskSyncAt;
        const canApplyFocus = payload.focused === true && incomingUpdatedAt >= state.lastFocusSyncAt;
        const mappedStatus = mappedStatusRaw;
        const isTerminal = mappedStatus === 'done' || mappedStatus === 'cancelled';
        const elapsedSeconds = Number.isFinite(payload.elapsed_seconds)
          ? Math.max(0, Number(payload.elapsed_seconds))
          : 0;
        const totalDuration = Math.max(60, Math.round(durationMinutes * 60));
        const remainingTime = Math.max(0, totalDuration - elapsedSeconds);
        const incomingSubtasks = Array.isArray(payload.subtasks)
          ? payload.subtasks
              .map((subtask) => {
                if (typeof subtask === 'string') {
                  const value = subtask.trim();
                  return value ? { title: value, status: 'pending' as SubtaskStatus } : null;
                }
                if (subtask && typeof subtask === 'object' && typeof subtask.title === 'string') {
                  const value = subtask.title.trim();
                  if (!value) return null;
                  return {
                    title: value,
                    status: mapBridgeSubtaskStatusToWeb(
                      typeof subtask.status === 'string' ? subtask.status : undefined
                    )
                  };
                }
                return null;
              })
              .filter((subtask): subtask is { title: string; status: SubtaskStatus } => Boolean(subtask))
          : [];

        if (!canApplyTaskUpdate) {
          const nextState = {
            ...state,
            lastBridgeSyncAt: now
          };
          if (state.isLoggedIn && state.user?.id) {
            queueCloudSync();
          }
          return nextState;
        }

        const existingTask = state.tasks.find((task) => task.syncId === syncId);
        const activeStatusLocks = Object.fromEntries(
          Object.entries(state.localStatusLockBySyncId).filter(([, lock]) => lock.until > now)
        ) as Record<string, { status: TaskStatus; until: number }>;
        const statusLock = activeStatusLocks[syncId];
        const shouldKeepLocalStatus =
          Boolean(statusLock) &&
          !isTerminal &&
          statusLock.status !== mappedStatus &&
          now < statusLock.until;

        if (!existingTask) {
          if (isTerminal) {
            const nextState = {
              ...state,
              lastBridgeSyncAt: now,
              localStatusLockBySyncId: activeStatusLocks,
              lastTaskSyncAtById: {
                ...state.lastTaskSyncAtById,
                [syncId]: incomingUpdatedAt
              },
              lastFocusSyncAt: canApplyFocus ? incomingUpdatedAt : state.lastFocusSyncAt
            };
            if (state.isLoggedIn && state.user?.id) {
              queueCloudSync();
            }
            return nextState;
          }
          if (isClosedSync) {
            const nextState = {
              ...state,
              lastBridgeSyncAt: now,
              localStatusLockBySyncId: activeStatusLocks,
              lastTaskSyncAtById: {
                ...state.lastTaskSyncAtById,
                [syncId]: incomingUpdatedAt
              },
              lastFocusSyncAt: canApplyFocus ? incomingUpdatedAt : state.lastFocusSyncAt
            };
            if (state.isLoggedIn && state.user?.id) {
              queueCloudSync();
            }
            return nextState;
          }
          const createdTask: Task = {
            id: Math.random().toString(36).substring(7),
            syncId,
            title,
            totalDuration,
            remainingTime,
            startTime: mappedStatus === 'running' ? Date.now() : Date.now() - elapsedSeconds * 1000,
            status: mappedStatus,
            subtasks: incomingSubtasks.map((subtask) => ({
              id: Math.random().toString(36).substring(7),
              title: subtask.title,
              status: subtask.status
            })),
            createdAt: Date.now()
          };
          const nextState = {
            tasks: [...state.tasks, createdTask],
            activeTaskId: canApplyFocus ? createdTask.id : (state.activeTaskId || createdTask.id),
            lastBridgeSyncAt: now,
            localStatusLockBySyncId: activeStatusLocks,
            lastTaskSyncAtById: {
              ...state.lastTaskSyncAtById,
              [syncId]: incomingUpdatedAt
            },
            lastFocusSyncAt: canApplyFocus ? incomingUpdatedAt : state.lastFocusSyncAt
          };
          if (state.isLoggedIn && state.user?.id) {
            queueCloudSync();
          }
          return nextState;
        }

        if (isTerminal) {
          const finalizedTask: Task = {
            ...existingTask,
            title,
            totalDuration,
            remainingTime,
            status: mappedStatus,
            endTime: Date.now()
          };
          const nextState = {
            tasks: state.tasks.filter((task) => task.id !== existingTask.id),
            activeTaskId:
              state.activeTaskId === existingTask.id
                ? null
                : state.activeTaskId,
            history: appendHistory(state.history, finalizedTask),
            closedSyncIds: {
              ...state.closedSyncIds,
              [syncId]: mappedStatus as 'done' | 'cancelled'
            },
            lastBridgeSyncAt: now,
            lastTaskSyncAtById: {
              ...state.lastTaskSyncAtById,
              [syncId]: incomingUpdatedAt
            },
            lastFocusSyncAt: canApplyFocus ? incomingUpdatedAt : state.lastFocusSyncAt
          };
          if (state.isLoggedIn && state.user?.id) {
            queueCloudSync();
          }
          return nextState;
        }

        const nextState = {
          tasks: state.tasks.map((task) =>
            task.id === existingTask.id
              ? (() => {
                  const bridgeStatus = mappedStatus;
                  const bridgeRemaining = remainingTime;
                  const nextStatus = shouldKeepLocalStatus ? task.status : bridgeStatus;

                  if (nextStatus === 'running') {
                    return {
                      ...task,
                      title,
                      totalDuration,
                      status: 'running' as const,
                      // Bridge is source of truth when packet is newer.
                      remainingTime: bridgeRemaining,
                      startTime: now,
                      subtasks: incomingSubtasks.map((subtask, index) => ({
                        id: task.subtasks[index]?.id || Math.random().toString(36).substring(7),
                        title: subtask.title,
                        status: subtask.status
                      }))
                    };
                  }

                  return {
                    ...task,
                    title,
                    totalDuration,
                    remainingTime: bridgeRemaining,
                    status: nextStatus,
                    startTime: task.startTime,
                    subtasks: incomingSubtasks.map((subtask, index) => ({
                      id: task.subtasks[index]?.id || Math.random().toString(36).substring(7),
                      title: subtask.title,
                      status: subtask.status
                    }))
                  };
                })()
              : task
          ),
          activeTaskId: canApplyFocus ? existingTask.id : state.activeTaskId,
          lastBridgeSyncAt: now,
          localStatusLockBySyncId: activeStatusLocks,
          lastTaskSyncAtById: {
            ...state.lastTaskSyncAtById,
            [syncId]: incomingUpdatedAt
          },
          lastFocusSyncAt: canApplyFocus ? incomingUpdatedAt : state.lastFocusSyncAt
        };
        if (state.isLoggedIn && state.user?.id) {
          queueCloudSync();
        }
        return nextState;
      }),

      updateTaskStatus: (id, status) => {
        const now = Date.now();
        let syncIdForLock = '';
        set((state) => ({
          localStatusLockBySyncId: (() => {
            const activeLocks = Object.fromEntries(
              Object.entries(state.localStatusLockBySyncId).filter(([, lock]) => lock.until > now)
            ) as Record<string, { status: TaskStatus; until: number }>;
            const targetTask = state.tasks.find((task) => task.id === id);
            syncIdForLock = targetTask?.syncId || targetTask?.id || '';
            if (syncIdForLock) {
              activeLocks[syncIdForLock] = { status, until: now + 1600 };
            }
            return activeLocks;
          })(),
          tasks: state.tasks.map((task) => {
            if (task.id !== id) return task;

            if (status === 'paused' && task.status === 'running') {
              return {
                ...task,
                status: 'paused',
                remainingTime: getEffectiveRemainingTime(task),
                startTime: Date.now()
              };
            }

            if (status === 'running' && task.status !== 'running') {
              return {
                ...task,
                status: 'running',
                startTime: Date.now()
              };
            }

            return { ...task, status };
          })
        }));
        const stateAfterUpdate = get();
        if (stateAfterUpdate.isLoggedIn && stateAfterUpdate.user?.id) {
          queueCloudSync();
        }
        const updatedTask = get().tasks.find((task) => task.id === id);
        if (updatedTask) {
          const payload = buildBridgePayload(updatedTask, status);
          if (syncIdForLock && typeof payload.updated_at_ms === 'number') {
            set((state) => ({
              lastTaskSyncAtById: {
                ...state.lastTaskSyncAtById,
                [syncIdForLock]: payload.updated_at_ms as number
              }
            }));
          }
          void pushTaskFromWeb(payload);
        }
      },

      updateRemainingTime: (id, delta) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id && task.status === 'running'
              ? {
                  ...task,
                  remainingTime: Math.max(0, task.remainingTime - delta),
                  startTime: Date.now()
                }
              : task
          )
        }));
        const stateAfterUpdate = get();
        if (stateAfterUpdate.isLoggedIn && stateAfterUpdate.user?.id) {
          queueCloudSync();
        }
      },

      toggleSubtask: (id, subtaskId) => {
        const task = get().tasks.find((item) => item.id === id);
        if (!task) return;

        let shouldComplete = false;
        let shouldCancel = false;
        set((state) => {
          let updatedTask: Task | null = null;
          const nextTasks = state.tasks.map((item) => {
            if (item.id !== id) return item;

            const nextSubtasks = item.subtasks.map((subtask) =>
              subtask.id === subtaskId
                ? {
                    ...subtask,
                    status: (subtask.status === 'done' ? 'pending' : 'done') as SubtaskStatus
                  }
                : subtask
            );
            const allSkipped = nextSubtasks.length > 0 && nextSubtasks.every((subtask) => subtask.status === 'skipped');
            const allResolved =
              nextSubtasks.length > 0 &&
              nextSubtasks.every((subtask) => subtask.status === 'done' || subtask.status === 'skipped');
            shouldCancel = allSkipped;
            shouldComplete = !allSkipped && allResolved;
            updatedTask = { ...item, subtasks: nextSubtasks };
            return updatedTask;
          });
          if (updatedTask && !shouldComplete && !shouldCancel) {
            void pushTaskFromWeb(buildBridgePayload(updatedTask));
          }
          return {
            tasks: nextTasks
          };
        });

        if (shouldCancel) {
          get().cancelTask(id);
          return;
        }
        if (shouldComplete) {
          get().completeTask(id);
        }
      },

      skipSubtask: (id, subtaskId) => {
        const task = get().tasks.find((item) => item.id === id);
        if (!task) return;

        let shouldComplete = false;
        let shouldCancel = false;
        set((state) => {
          let updatedTask: Task | null = null;
          const nextTasks = state.tasks.map((item) =>
            item.id === id
              ? (() => {
                  const nextSubtasks = item.subtasks.map((subtask) =>
                    subtask.id === subtaskId ? { ...subtask, status: 'skipped' as const } : subtask
                  );
                  const allSkipped =
                    nextSubtasks.length > 0 && nextSubtasks.every((subtask) => subtask.status === 'skipped');
                  const allResolved =
                    nextSubtasks.length > 0 &&
                    nextSubtasks.every((subtask) => subtask.status === 'done' || subtask.status === 'skipped');
                  shouldCancel = allSkipped;
                  shouldComplete = !allSkipped && allResolved;
                  updatedTask = { ...item, subtasks: nextSubtasks };
                  return updatedTask;
                })()
              : item
          );

          if (updatedTask && !shouldComplete && !shouldCancel) {
            void pushTaskFromWeb(buildBridgePayload(updatedTask));
          }
          return {
            tasks: nextTasks
          };
        });

        if (shouldCancel) {
          get().cancelTask(id);
          return;
        }
        if (shouldComplete) {
          get().completeTask(id);
        }
      },

      deleteTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
          activeTaskId: state.activeTaskId === id ? null : state.activeTaskId
        }));
        const stateAfterUpdate = get();
        if (stateAfterUpdate.isLoggedIn && stateAfterUpdate.user?.id) {
          queueCloudSync();
        }
      },

      setActiveTask: (id) => {
        const prevActiveTaskId = get().activeTaskId;
        if (id === prevActiveTaskId) return;

        set(() => ({
          activeTaskId: id
        }));
        if (!id) return;

        const selectedTask = get().tasks.find((item) => item.id === id);
        if (!selectedTask) return;

        // Legacy protection: ensure every active task has a stable syncId.
        if (!selectedTask.syncId) {
          const assignedSyncId = `web-legacy-${selectedTask.id}`;
          set((state) => ({
            tasks: state.tasks.map((item) =>
              item.id === id ? { ...item, syncId: assignedSyncId } : item
            )
          }));
        }

        const taskToSync = get().tasks.find((item) => item.id === id);
        if (!taskToSync) return;
        const stateAfterUpdate = get();
        if (stateAfterUpdate.isLoggedIn && stateAfterUpdate.user?.id) {
          queueCloudSync();
        }
        void pushTaskFromWeb(buildBridgePayload(taskToSync, undefined, true));
      },

      completeTask: (id) => set((state) => {
        const task = state.tasks.find((item) => item.id === id);
        if (!task) return state;

        const finalizedTask: Task = {
          ...task,
          status: 'done',
          remainingTime: getEffectiveRemainingTime(task),
          endTime: Date.now()
        };
        void pushTaskFromWeb(buildBridgePayload(finalizedTask, 'done'));
        const syncId = task.syncId || task.id;
        const nextState = {
          tasks: state.tasks.filter((item) => item.id !== id),
          activeTaskId: state.activeTaskId === id ? null : state.activeTaskId,
          history: appendHistory(state.history, finalizedTask),
          closedSyncIds: {
            ...state.closedSyncIds,
            [syncId]: 'done'
          } as Record<string, 'done' | 'cancelled'>
        };
        if (state.isLoggedIn && state.user?.id) {
          queueCloudSync();
        }
        return nextState;
      }),

      cancelTask: (id) => set((state) => {
        const task = state.tasks.find((item) => item.id === id);
        if (!task) return state;

        const finalizedTask: Task = {
          ...task,
          status: 'cancelled',
          remainingTime: getEffectiveRemainingTime(task),
          endTime: Date.now()
        };
        void pushTaskFromWeb(buildBridgePayload(finalizedTask, 'cancelled'));
        const syncId = task.syncId || task.id;
        const nextState = {
          tasks: state.tasks.filter((item) => item.id !== id),
          activeTaskId: state.activeTaskId === id ? null : state.activeTaskId,
          history: appendHistory(state.history, finalizedTask),
          closedSyncIds: {
            ...state.closedSyncIds,
            [syncId]: 'cancelled'
          } as Record<string, 'done' | 'cancelled'>
        };
        if (state.isLoggedIn && state.user?.id) {
          queueCloudSync();
        }
        return nextState;
      }),

      addTimeToTask: (id, minutes) => {
        const deltaSeconds = Math.max(0, Math.round(minutes * 60));
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  remainingTime:
                    task.status === 'running'
                      ? getEffectiveRemainingTime(task) + deltaSeconds
                      : task.remainingTime + deltaSeconds,
                  totalDuration: task.totalDuration + deltaSeconds,
                  startTime: task.status === 'running' ? Date.now() : task.startTime
                }
              : task
          )
        }));
        const updatedTask = get().tasks.find((task) => task.id === id);
        if (updatedTask) {
          const stateAfterUpdate = get();
          if (stateAfterUpdate.isLoggedIn && stateAfterUpdate.user?.id) {
            queueCloudSync();
          }
          void pushTaskFromWeb(buildBridgePayload(updatedTask));
        }
      },

      clearTodayHistory: () =>
        set((state) => {
          const today = new Date().toISOString().split('T')[0];
          const nextState = {
            history: state.history.filter((record) => record.date !== today)
          };
          if (state.isLoggedIn && state.user?.id) {
            queueCloudSync();
          }
          return nextState;
        }),

      setLoggedIn: (isLoggedIn, user = null, options) => {
        const shouldClearData = !isLoggedIn && Boolean(options?.clearDataOnLogout);
        set((state) => ({
          isLoggedIn,
          user: isLoggedIn ? user : null,
          tasks: shouldClearData ? [] : state.tasks,
          history: shouldClearData ? [] : state.history,
          activeTaskId: shouldClearData ? null : state.activeTaskId,
          closedSyncIds: shouldClearData ? {} : state.closedSyncIds,
          lastTaskSyncAtById: shouldClearData ? {} : state.lastTaskSyncAtById,
          lastFocusSyncAt: shouldClearData ? 0 : state.lastFocusSyncAt,
          lastBridgeSyncAt: shouldClearData ? 0 : state.lastBridgeSyncAt
        }));
      },

      hydrateCloudData: async (userId) => {
        const snapshot = await loadCloudSnapshot(userId);
        const current = get();
        const mergedHistory = mergeHistoryRecords(current.history, snapshot.history);

        set((state) => ({
          ...state,
          // Hard rule: local active tasks remain local; cloud stores history only.
          tasks: state.tasks,
          history: mergedHistory,
          activeTaskId: state.activeTaskId,
          closedSyncIds: {}
        }));

        queueCloudSync({ historyOnly: true });
      },

      syncCloudData: async (options) => {
        const state = get();
        if (!state.isLoggedIn || !state.user?.id) return;
        await saveCloudSnapshot(state.user.id, state.tasks, state.history, options);
      },

      toggleIsland: () =>
        set((state) => {
          const nextVisible = !state.isIslandVisible;
          void setIslandVisibility(nextVisible);
          return { isIslandVisible: nextVisible };
        }),

      setIslandVisible: (visible) => set({ isIslandVisible: visible })
    }),
    {
      name: 'clawdmate-storage-prod',
      storage: getGuestStorage()
    }
  )
);
