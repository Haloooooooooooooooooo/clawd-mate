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

export interface User {
  name: string;
  email: string;
  avatar: string; // Initials or URL
}
