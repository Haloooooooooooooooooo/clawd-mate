import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Task, SubTask } from '../types/task';

interface TaskStore {
  tasks: Task[];
  activeTaskId: string | null;

  // Actions
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  setActiveTask: (id: string | null) => void;
  pauseTask: (id: string) => void;
  resumeTask: (id: string) => void;
  completeTask: (id: string) => void;

  // Subtask actions
  addSubTask: (taskId: string, subTask: SubTask) => void;
  updateSubTask: (taskId: string, subTaskId: string, updates: Partial<SubTask>) => void;
  completeSubTask: (taskId: string, subTaskId: string) => void;
  skipSubTask: (taskId: string, subTaskId: string) => void;
}

function activateNextPendingSubTask(subTasks: SubTask[], currentIndex: number): SubTask[] {
  const normalizedSubTasks = subTasks.map((st) =>
    st.status === 'active' ? { ...st, status: 'pending' as const } : st
  );

  const nextPendingIndex = normalizedSubTasks.findIndex((st, index) =>
    index > currentIndex ? st.status === 'pending' : false
  );
  const fallbackPendingIndex =
    nextPendingIndex === -1 ? normalizedSubTasks.findIndex((st) => st.status === 'pending') : nextPendingIndex;

  if (fallbackPendingIndex !== -1) {
    normalizedSubTasks[fallbackPendingIndex] = {
      ...normalizedSubTasks[fallbackPendingIndex],
      status: 'active',
      startedAt: normalizedSubTasks[fallbackPendingIndex].startedAt ?? new Date()
    };
  }

  return normalizedSubTasks;
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      activeTaskId: null,

      addTask: (task) =>
        set((state) => {
          let normalizedTask = task;

          if (task.status === 'active' && task.subTasks.length > 0) {
            const hasActiveSubTask = task.subTasks.some((subTask) => subTask.status === 'active');

            if (!hasActiveSubTask) {
              const firstPendingIndex = task.subTasks.findIndex((subTask) => subTask.status === 'pending');

              if (firstPendingIndex !== -1) {
                const normalizedSubTasks = [...task.subTasks];
                normalizedSubTasks[firstPendingIndex] = {
                  ...normalizedSubTasks[firstPendingIndex],
                  status: 'active',
                  startedAt: normalizedSubTasks[firstPendingIndex].startedAt ?? new Date()
                };

                normalizedTask = {
                  ...task,
                  subTasks: normalizedSubTasks
                };
              }
            }
          }

          return {
            tasks: [...state.tasks, normalizedTask]
          };
        }),

      updateTask: (id, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t))
        })),

      removeTask: (id) =>
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
          activeTaskId: state.activeTaskId === id ? null : state.activeTaskId
        })),

      setActiveTask: (id) => set({ activeTaskId: id }),

      pauseTask: (id) => get().updateTask(id, { status: 'paused' }),

      resumeTask: (id) => {
        get().updateTask(id, { status: 'active' });
        get().setActiveTask(id);
      },

      completeTask: (id) =>
        get().updateTask(id, {
          status: 'completed',
          completedAt: new Date()
        }),

      addSubTask: (taskId, subTask) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, subTasks: [...t.subTasks, subTask] } : t))
        })),

      updateSubTask: (taskId, subTaskId, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subTasks: t.subTasks.map((st) => (st.id === subTaskId ? { ...st, ...updates } : st))
                }
              : t
          )
        })),

      completeSubTask: (taskId, subTaskId) =>
        set((state) => {
          let shouldClearActive = false;

          const tasks = state.tasks.map((task) => {
            if (task.id !== taskId) return task;

            const subTasks = [...task.subTasks];
            const currentIndex = subTasks.findIndex((st) => st.id === subTaskId);
            if (currentIndex === -1) return task;

            subTasks[currentIndex] = {
              ...subTasks[currentIndex],
              status: 'completed',
              completedAt: new Date()
            };

            const allResolved =
              subTasks.length > 0 && subTasks.every((st) => st.status === 'completed' || st.status === 'skipped');
            if (allResolved) {
              const allSkipped = subTasks.every((st) => st.status === 'skipped');
              shouldClearActive = state.activeTaskId === task.id;
              return {
                ...task,
                subTasks,
                status: allSkipped ? ('cancelled' as const) : ('completed' as const),
                completedAt: new Date()
              };
            }

            const normalizedSubTasks = activateNextPendingSubTask(subTasks, currentIndex);
            return { ...task, subTasks: normalizedSubTasks };
          });

          return {
            tasks,
            activeTaskId: shouldClearActive ? null : state.activeTaskId
          };
        }),

      skipSubTask: (taskId, subTaskId) =>
        set((state) => {
          let shouldClearActive = false;

          const tasks = state.tasks.map((task) => {
            if (task.id !== taskId) return task;

            const subTasks = [...task.subTasks];
            const currentIndex = subTasks.findIndex((st) => st.id === subTaskId);
            if (currentIndex === -1) return task;

            subTasks[currentIndex] = {
              ...subTasks[currentIndex],
              status: 'skipped',
              completedAt: new Date()
            };

            const allSkipped = subTasks.length > 0 && subTasks.every((st) => st.status === 'skipped');
            if (allSkipped) {
              shouldClearActive = state.activeTaskId === task.id;
              return {
                ...task,
                subTasks,
                status: 'cancelled' as const,
                completedAt: new Date()
              };
            }

            const allResolved =
              subTasks.length > 0 && subTasks.every((st) => st.status === 'completed' || st.status === 'skipped');
            if (allResolved) {
              shouldClearActive = state.activeTaskId === task.id;
              return {
                ...task,
                subTasks,
                status: 'completed' as const,
                completedAt: new Date()
              };
            }

            const normalizedSubTasks = activateNextPendingSubTask(subTasks, currentIndex);
            return { ...task, subTasks: normalizedSubTasks };
          });

          return {
            tasks,
            activeTaskId: shouldClearActive ? null : state.activeTaskId
          };
        })
    }),
    {
      name: 'clawdmate-tasks'
    }
  )
);
