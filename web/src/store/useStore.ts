/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Task, TaskStatus, DailyRecord, User, SubtaskStatus } from '../types';
import { BridgeTaskPayload, pushTaskFromWeb, setIslandVisibility } from '../lib/islandBridge';

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

function buildBridgePayload(task: Task, statusOverride?: TaskStatus, focusedOverride?: boolean): BridgeTaskPayload {
  const status = statusOverride ?? task.status;
  const elapsedSeconds = Math.max(0, task.totalDuration - task.remainingTime);
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
    updated_at_ms: Date.now()
  };
}

interface AppState {
  tasks: Task[];
  history: DailyRecord[];
  closedSyncIds: Record<string, 'done' | 'cancelled'>;
  lastTaskSyncAtById: Record<string, number>;
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
  setLoggedIn: (isLoggedIn: boolean, user?: User | null) => void;
  toggleIsland: () => void;
  setIslandVisible: (visible: boolean) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      tasks: [],
      history: [],
      closedSyncIds: {},
      lastTaskSyncAtById: {},
      lastFocusSyncAt: 0,
      lastBridgeSyncAt: 0,
      activeTaskId: null,
      user: { name: 'Alex', email: 'alex@example.com', avatar: 'AL' },
      isLoggedIn: true,
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
          startTime: Date.now() - elapsedSeconds * 1000,
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
        return {
          tasks: [...state.tasks, newTask],
          activeTaskId: shouldSwitchActive ? newTask.id : state.activeTaskId
        };
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
        const mappedStatus =
          canApplyFocus && mappedStatusRaw === 'paused' ? 'running' : mappedStatusRaw;
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
          return {
            ...state,
            lastBridgeSyncAt: now
          };
        }

        const existingTask = state.tasks.find((task) => task.syncId === syncId);
        if (!existingTask) {
          if (isTerminal) {
            return {
              ...state,
              lastBridgeSyncAt: now,
              lastTaskSyncAtById: {
                ...state.lastTaskSyncAtById,
                [syncId]: incomingUpdatedAt
              },
              lastFocusSyncAt: canApplyFocus ? incomingUpdatedAt : state.lastFocusSyncAt
            };
          }
          if (isClosedSync) {
            return {
              ...state,
              lastBridgeSyncAt: now,
              lastTaskSyncAtById: {
                ...state.lastTaskSyncAtById,
                [syncId]: incomingUpdatedAt
              },
              lastFocusSyncAt: canApplyFocus ? incomingUpdatedAt : state.lastFocusSyncAt
            };
          }
          const createdTask: Task = {
            id: Math.random().toString(36).substring(7),
            syncId,
            title,
            totalDuration,
            remainingTime,
            startTime: Date.now() - elapsedSeconds * 1000,
            status: mappedStatus,
            subtasks: incomingSubtasks.map((subtask) => ({
              id: Math.random().toString(36).substring(7),
              title: subtask.title,
              status: subtask.status
            })),
            createdAt: Date.now()
          };
          return {
            tasks: [...state.tasks, createdTask],
            activeTaskId: canApplyFocus ? createdTask.id : (state.activeTaskId || createdTask.id),
            lastBridgeSyncAt: now,
            lastTaskSyncAtById: {
              ...state.lastTaskSyncAtById,
              [syncId]: incomingUpdatedAt
            },
            lastFocusSyncAt: canApplyFocus ? incomingUpdatedAt : state.lastFocusSyncAt
          };
        }

        const shouldIgnorePauseOnFocusedTask =
          mappedStatusRaw === 'paused' &&
          payload.focused !== true &&
          state.activeTaskId === existingTask.id;

        if (isTerminal) {
          const finalizedTask: Task = {
            ...existingTask,
            title,
            totalDuration,
            remainingTime,
            status: mappedStatus,
            endTime: Date.now()
          };
          return {
            tasks: state.tasks.filter((task) => task.id !== existingTask.id),
            activeTaskId:
              state.activeTaskId === existingTask.id
                ? null
                : state.activeTaskId,
            history: appendHistory(state.history, finalizedTask),
            closedSyncIds: {
              ...state.closedSyncIds,
              [syncId]: mappedStatus
            },
            lastBridgeSyncAt: now,
            lastTaskSyncAtById: {
              ...state.lastTaskSyncAtById,
              [syncId]: incomingUpdatedAt
            },
            lastFocusSyncAt: canApplyFocus ? incomingUpdatedAt : state.lastFocusSyncAt
          };
        }

        return {
          tasks: state.tasks.map((task) =>
            task.id === existingTask.id
              ? {
                  ...task,
                  title,
                  totalDuration,
                  remainingTime,
                  status: shouldIgnorePauseOnFocusedTask ? task.status : mappedStatus,
                  subtasks: incomingSubtasks.map((subtask, index) => ({
                    id: task.subtasks[index]?.id || Math.random().toString(36).substring(7),
                    title: subtask.title,
                    status: subtask.status
                  }))
                }
              : task
          ),
          activeTaskId: canApplyFocus ? existingTask.id : state.activeTaskId,
          lastBridgeSyncAt: now,
          lastTaskSyncAtById: {
            ...state.lastTaskSyncAtById,
            [syncId]: incomingUpdatedAt
          },
          lastFocusSyncAt: canApplyFocus ? incomingUpdatedAt : state.lastFocusSyncAt
        };
      }),

      updateTaskStatus: (id, status) => {
        set((state) => ({
          tasks: state.tasks.map((task) => (task.id === id ? { ...task, status } : task))
        }));
        const updatedTask = get().tasks.find((task) => task.id === id);
        if (updatedTask) {
          void pushTaskFromWeb(buildBridgePayload(updatedTask, status));
        }
      },

      updateRemainingTime: (id, delta) => set((state) => ({
        tasks: state.tasks.map((task) =>
          task.id === id && task.status === 'running'
            ? { ...task, remainingTime: Math.max(0, task.remainingTime - delta) }
            : task
        )
      })),

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

      deleteTask: (id) => set((state) => ({
        tasks: state.tasks.filter((task) => task.id !== id),
        activeTaskId: state.activeTaskId === id ? null : state.activeTaskId
      })),

      setActiveTask: (id) => {
        const prevActiveTaskId = get().activeTaskId;
        if (id === prevActiveTaskId) return;

        set((state) => ({
          activeTaskId: id,
          tasks: state.tasks.map((item) =>
            item.id === id && item.status !== 'done' && item.status !== 'cancelled'
              ? { ...item, status: 'running' as const }
              : item
          )
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
        void pushTaskFromWeb(buildBridgePayload(taskToSync, 'running', true));
      },

      completeTask: (id) => set((state) => {
        const task = state.tasks.find((item) => item.id === id);
        if (!task) return state;

        const finalizedTask: Task = { ...task, status: 'done', endTime: Date.now() };
        void pushTaskFromWeb(buildBridgePayload(finalizedTask, 'done'));
        const syncId = task.syncId || task.id;
        return {
          tasks: state.tasks.filter((item) => item.id !== id),
          activeTaskId: state.activeTaskId === id ? null : state.activeTaskId,
          history: appendHistory(state.history, finalizedTask),
          closedSyncIds: {
            ...state.closedSyncIds,
            [syncId]: 'done'
          }
        };
      }),

      cancelTask: (id) => set((state) => {
        const task = state.tasks.find((item) => item.id === id);
        if (!task) return state;

        const finalizedTask: Task = { ...task, status: 'cancelled', endTime: Date.now() };
        void pushTaskFromWeb(buildBridgePayload(finalizedTask, 'cancelled'));
        const syncId = task.syncId || task.id;
        return {
          tasks: state.tasks.filter((item) => item.id !== id),
          activeTaskId: state.activeTaskId === id ? null : state.activeTaskId,
          history: appendHistory(state.history, finalizedTask),
          closedSyncIds: {
            ...state.closedSyncIds,
            [syncId]: 'cancelled'
          }
        };
      }),

      addTimeToTask: (id, minutes) => {
        const deltaSeconds = Math.max(0, Math.round(minutes * 60));
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  remainingTime: task.remainingTime + deltaSeconds,
                  totalDuration: task.totalDuration + deltaSeconds
                }
              : task
          )
        }));
        const updatedTask = get().tasks.find((task) => task.id === id);
        if (updatedTask) {
          void pushTaskFromWeb(buildBridgePayload(updatedTask));
        }
      },

      clearTodayHistory: () =>
        set((state) => {
          const today = new Date().toISOString().split('T')[0];
          return {
            history: state.history.filter((record) => record.date !== today)
          };
        }),

      setLoggedIn: (isLoggedIn, user = null) => set({
        isLoggedIn,
        user: isLoggedIn ? (user || { name: 'Alex', email: 'alex@example.com', avatar: 'AL' }) : null
      }),

      toggleIsland: () =>
        set((state) => {
          const nextVisible = !state.isIslandVisible;
          void setIslandVisibility(nextVisible);
          return { isIslandVisible: nextVisible };
        }),

      setIslandVisible: (visible) => set({ isIslandVisible: visible })
    }),
    {
      name: 'clawdmate-storage-prod'
    }
  )
);
