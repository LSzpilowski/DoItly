// ─── New feature types merged from taskflow-react ───────────────────────────

export type Priority = 'low' | 'medium' | 'high';
export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly';
export type View = 'all' | 'today' | 'completed' | 'category' | 'planDay' | 'planWeek' | 'planMonth' | 'calendar' | 'thisWeek' | 'overdue';
export type SortField = 'created' | 'dueDate' | 'priority' | 'title';
export type SortDir = 'asc' | 'desc';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  notifications: boolean;
  soundAlerts: boolean;
}

export type TaskFormState = {
  title: string;
  description: string;
  dueDate: string;
  priority: Priority;
  workspace: string;
  category: string;
  repeat: Repeat;
  tags: string;
  notes: string;
  subtasks: Subtask[];
};

export interface ModalState {
  task: boolean;
  search: boolean;
  focus: boolean;
  settings: boolean;
  workspace: boolean;
}

// ─── Workspace ───────────────────────────────────────────────────────────────
export interface Workspace {
  id: string;
  name: string;
  color: string; // tailwind bg-* class
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string; // tailwind bg-* class
}

export const CATEGORY_COLORS = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-green-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-orange-500',
  'bg-pink-500',
] as const;
