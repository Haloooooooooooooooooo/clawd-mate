/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Task, Subtask, TaskStatus, DailyRecord, User } from '../types';

interface AppState {
  tasks: Task[]; // Active or today's tasks
  history: DailyRecord[];
  activeTaskId: string | null;
  user: User | null;
  isLoggedIn: boolean;
  isIslandVisible: boolean;
  
  // Actions
  addTask: (title: string, durationMinutes: number, subtasks: string[]) => void;
  updateTaskStatus: (id: string, status: TaskStatus) => void;
  updateRemainingTime: (id: string, delta: number) => void;
  toggleSubtask: (id: string, subtaskId: string) => void;
  skipSubtask: (id: string, subtaskId: string) => void;
  deleteTask: (id: string) => void;
  setActiveTask: (id: string | null) => void;
  completeTask: (id: string) => void;
  cancelTask: (id: string) => void;
  addTimeToTask: (id: string, minutes: number) => void;
  setLoggedIn: (isLoggedIn: boolean, user?: User | null) => void;
  toggleIsland: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      tasks: [],
      history: [],
      activeTaskId: null,
      user: { name: 'Alex', email: 'alex@example.com', avatar: 'AL' },
      isLoggedIn: true,
      isIslandVisible: false,

      addTask: (title, durationMinutes, subtaskTitles) => set((state) => {
        const newTask: Task = {
          id: Math.random().toString(36).substring(7),
          title,
          totalDuration: durationMinutes * 60,
          remainingTime: durationMinutes * 60,
          startTime: Date.now(),
          status: 'running',
          subtasks: subtaskTitles.map(t => ({
            id: Math.random().toString(36).substring(7),
            title: t,
            status: 'pending'
          })),
          createdAt: Date.now()
        };
        return { 
          tasks: [...state.tasks, newTask],
          activeTaskId: newTask.id 
        };
      }),

      updateTaskStatus: (id, status) => set((state) => ({
        tasks: state.tasks.map(t => t.id === id ? { ...t, status } : t)
      })),

      updateRemainingTime: (id, delta) => set((state) => ({
        tasks: state.tasks.map(t => 
          t.id === id && t.status === 'running' 
            ? { ...t, remainingTime: Math.max(0, t.remainingTime - delta) } 
            : t
        )
      })),

      toggleSubtask: (id, subtaskId) => {
        const task = get().tasks.find(t => t.id === id);
        if (!task) return;
        
        const subtaskIndex = task.subtasks.findIndex(s => s.id === subtaskId);
        const isLast = subtaskIndex === task.subtasks.length - 1;
        const currentStatus = task.subtasks[subtaskIndex].status;

        // If marking last subtask as done, complete entire task
        if (isLast && currentStatus !== 'done') {
          get().completeTask(id);
          return;
        }

        set((state) => ({
          tasks: state.tasks.map(t => t.id === id ? {
            ...t,
            subtasks: t.subtasks.map(s => s.id === subtaskId ? { 
              ...s, 
              status: s.status === 'done' ? 'pending' : 'done' 
            } : s)
          } : t)
        }));
      },

      skipSubtask: (id, subtaskId) => {
        const task = get().tasks.find(t => t.id === id);
        if (!task) return;
        
        const subtaskIndex = task.subtasks.findIndex(s => s.id === subtaskId);
        const isLast = subtaskIndex === task.subtasks.length - 1;

        // If skipping last subtask, complete entire task
        if (isLast) {
          get().completeTask(id);
          return;
        }

        set((state) => ({
          tasks: state.tasks.map(t => t.id === id ? {
            ...t,
            subtasks: t.subtasks.map(s => s.id === subtaskId ? { 
              ...s, 
              status: 'skipped' as const
            } : s)
          } : t)
        }));
      },

      deleteTask: (id) => set((state) => ({
        tasks: state.tasks.filter(t => t.id !== id),
        activeTaskId: state.activeTaskId === id ? null : state.activeTaskId
      })),

      setActiveTask: (id) => set({ activeTaskId: id }),

      completeTask: (id) => set((state) => {
        const task = state.tasks.find(t => t.id === id);
        if (!task) return state;
        
        const updatedTask = { ...task, status: 'done' as const, endTime: Date.now() };
        const today = new Date().toISOString().split('T')[0];
        
        const history = [...state.history];
        const dayRecord = history.find(h => h.date === today);
        
        if (dayRecord) {
          dayRecord.tasks.push(updatedTask);
        } else {
          history.unshift({ date: today, tasks: [updatedTask] });
        }

        return {
          tasks: state.tasks.filter(t => t.id !== id),
          activeTaskId: state.activeTaskId === id ? null : state.activeTaskId,
          history
        };
      }),

      cancelTask: (id) => set((state) => {
        const task = state.tasks.find(t => t.id === id);
        if (!task) return state;
        
        const updatedTask = { ...task, status: 'cancelled' as const, endTime: Date.now() };
        const today = new Date().toISOString().split('T')[0];
        
        const history = [...state.history];
        const dayRecord = history.find(h => h.date === today);
        
        if (dayRecord) {
          dayRecord.tasks.push(updatedTask);
        } else {
          history.unshift({ date: today, tasks: [updatedTask] });
        }

        return {
          tasks: state.tasks.filter(t => t.id !== id),
          activeTaskId: state.activeTaskId === id ? null : state.activeTaskId,
          history
        };
      }),

      addTimeToTask: (id: string, minutes: number) => set((state) => ({
        tasks: state.tasks.map((t) => 
          t.id === id ? { ...t, remainingTime: t.remainingTime + minutes * 60 } : t
        )
      })),

      setLoggedIn: (isLoggedIn, user = null) => set({ isLoggedIn, user: isLoggedIn ? (user || { name: 'Alex', email: 'alex@example.com', avatar: 'AL' }) : null }),

      toggleIsland: () => set((state) => ({ isIslandVisible: !state.isIslandVisible }))
    }),
    {
      name: 'clawdmate-storage-prod',
    }
  )
);
