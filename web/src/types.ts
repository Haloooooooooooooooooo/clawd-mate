/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TaskStatus = 'running' | 'paused' | 'done' | 'cancelled';
export type SubtaskStatus = 'pending' | 'done' | 'skipped';

export interface Subtask {
  id: string;
  title: string;
  status: SubtaskStatus;
}

export interface Task {
  id: string;
  syncId?: string;
  title: string;
  totalDuration: number; // in seconds
  remainingTime: number; // in seconds
  startTime: number; // timestamp
  endTime?: number; // timestamp when done/cancelled
  status: TaskStatus;
  subtasks: Subtask[];
  createdAt: number;
}

export interface DailyRecord {
  date: string; // YYYY-MM-DD
  tasks: Task[];
}

export interface DailySummaryTimelineItem {
  title: string;
  status: 'done' | 'cancelled';
  finishedAt: string;
  actualMinutes: number;
}

export interface DailySummaryForImage {
  date: string;
  overview: {
    completedCount: number;
    cancelledCount: number;
    totalFocusMinutes: number;
  };
  timeline: DailySummaryTimelineItem[];
}

export interface DailyImageTaskInput {
  time: string;
  status: 'completed' | 'cancelled';
  title: string;
  duration: number;
}

export interface DailyImagePromptData {
  date: string;
  completed_count: number;
  cancelled_count: number;
  focus_time: number;
  tasks: DailyImageTaskInput[];
  summary_text: string;
}

export interface User {
  id?: string;
  name: string;
  email: string;
  avatar: string; // Initials or URL
}

export interface ToastMessage {
  id: number;
  message: string;
}
