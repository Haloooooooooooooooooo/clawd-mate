export type TaskMode = 'simple' | 'structured';
export type TaskStatus = 'pending' | 'active' | 'paused' | 'completed' | 'cancelled';

export interface SubTask {
  id: string;
  title: string;
  order: number;
  status: 'pending' | 'active' | 'completed' | 'skipped';
  duration: number; // seconds
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface Task {
  id: string;
  syncId?: string;
  title: string;
  mode: TaskMode;
  status: TaskStatus;
  plannedDuration: number; // minutes
  actualDuration: number; // seconds
  startedAt: Date | null;
  completedAt: Date | null;
  subTasks: SubTask[];
  createdAt: Date;
}
