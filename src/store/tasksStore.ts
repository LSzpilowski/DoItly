import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Priority, Repeat, Subtask, TaskFormState } from './types';

export type TaskStatus = 'active' | 'inProgress' | 'completed' | 'deleted' | 'archived' | 'overdue';

export interface Task {
  id: string;
  text: string;
  status: TaskStatus;
  createdAt: string;
  completedAt?: string;
  deletedAt?: string;
  archivedAt?: string;
  isTemplate?: boolean;
  userId?: string;
  // ── Rich task fields (merged from taskflow-react) ──
  title?: string;        // display title (falls back to text if not set)
  description?: string;
  dueDate?: string;      // YYYY-MM-DD
  priority?: Priority;
  category?: string;
  repeat?: Repeat;
  tags?: string[];
  notes?: string;
  subtasks?: Subtask[];
  workspace?: string;
  // dueDate is the single source of truth for all planning views.
  // It drives: Planner→Day (today), Planner→Week (this week), Planner→Month,
  // Views→Today, Views→Week, Views→Calendar, MyFlow, and overdue detection.
  // status:'overdue' replaces the old overdue:boolean + overdueAt fields.
}

export type UserStats = {
  totalTasksCreated: number;
  activeTasksCount: number;
  completedTasksCount: number;
  deletedTasksCount: number;
  archivedTasksCount: number;
  templatesCount: number;
  
  completionRate: number;
  activeVsCompletedRatio: number;
  
  monthlyTasksCreated?: Record<string, number>;
  monthlyTasksCompleted?: Record<string, number>;
  templatesUsedCount?: number;
  recentlyDeletedCount?: number;
  currentMonth?: string;
};

interface TasksState {
  tasks: Task[];
  loading: boolean;
  
  // Getters
  getActiveTasks: () => Task[];
  getCompletedTasks: () => Task[];
  getDeletedTasks: () => Task[];
  getArchivedTasks: () => Task[];
  getTemplates: () => Task[];
  getStats: () => UserStats;
  
  // ── New rich getters (merged from taskflow-react) ──
  getActiveTodayTasks: () => Task[];
  getUpcomingTasks: () => Task[];
  getTasksByCategory: (category: string) => Task[];
  searchTasks: (query: string) => Task[];

  // Actions
  addTask: (text: string, userId?: string) => Promise<void>;
  addTaskRich: (form: TaskFormState, userId?: string) => Promise<void>;
  updateTask: (id: string, text: string, userId?: string) => Promise<void>;
  updateTaskRich: (id: string, updates: Partial<Task>, userId?: string) => Promise<void>;
  deleteTask: (id: string, userId?: string) => Promise<void>;
  markAsCompleted: (id: string, userId?: string) => Promise<void>;
  undoTask: (id: string, userId?: string) => Promise<void>;
  archiveTask: (id: string, userId?: string) => Promise<void>;
  archiveAllCompleted: (userId?: string) => Promise<void>;
  clearHistory: (userId?: string) => Promise<void>;
  createTemplate: (text: string, userId?: string) => Promise<void>;
  createTemplateRich: (form: TaskFormState, userId?: string) => Promise<void>;
  useTemplate: (templateId: string, userId?: string) => Promise<void>;
  removeTemplate: (templateId: string, userId?: string) => Promise<void>;
  bulkComplete: (ids: string[], userId?: string) => Promise<void>;
  bulkDelete: (ids: string[], userId?: string) => Promise<void>;
  bulkSetPriority: (ids: string[], priority: Priority, userId?: string) => Promise<void>;
  markOverdue: (ids: string[]) => Promise<void>;
  clearOverdue: (id: string, userId?: string) => Promise<void>;
  
  loadTasks: (userId?: string) => Promise<void>;
  
  clearTasks: () => void;
}

const STORAGE_KEY = 'doitly_tasks_v2';

const getLocalTasks = (): Task[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveLocalTasks = (tasks: Task[]) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      // QuotaExceededError — localStorage full; silently ignore for now
      console.warn('[tasksStore] localStorage quota exceeded — local tasks not saved', e);
    }
  }
};

/** Returns YYYY-MM-DD for a given Date using local timezone (avoids toISOString off-by-one) */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Given a dueDate string (YYYY-MM-DD) or undefined, returns whether the task
 * should have 'overdue' status:
 *  - past    → 'overdue'
 *  - today   → 'active'
 *  - future  → 'active'
 *  - undefined (removed) → 'active'
 */
function resolveStatusFromDueDate(currentStatus: TaskStatus, dueDate: string | undefined): TaskStatus {
  // Only auto-set overdue for active/overdue tasks
  if (currentStatus !== 'active' && currentStatus !== 'overdue') return currentStatus;
  if (!dueDate) return 'active';
  const today = localDateStr(new Date());
  return dueDate < today ? 'overdue' : 'active';
}

/** Returns ISO week string like "2026-W11" for a given date */
export function getISOWeekString(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Thursday in current week decides the year
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/** Guards against Supabase 400 errors caused by non-UUID task ids (e.g. legacy Date.now() ids) */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(id: string): boolean {
  return UUID_RE.test(id);
}

const calculateStats = (tasks: Task[]): UserStats => {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const nonTemplates = tasks.filter(t => !t.isTemplate);
  const templates = tasks.filter(t => t.isTemplate);
  
  const active = nonTemplates.filter(t => t.status === 'active' || t.status === 'inProgress' || t.status === 'overdue');
  const completed = nonTemplates.filter(t => t.status === 'completed');
  const deleted = nonTemplates.filter(t => t.status === 'deleted');
  const archived = nonTemplates.filter(t => t.status === 'archived');
  
  const allDone = completed.length + archived.length;
  const totalCreated = nonTemplates.length;
  const meaningfulTotal = active.length + allDone;
  const completionRate = meaningfulTotal > 0 ? allDone / meaningfulTotal : 0;
  const activeVsCompletedRatio = allDone > 0 ? active.length / allDone : 0;

  // Monthly stats
  const monthlyTasksCreated: Record<string, number> = {};
  const monthlyTasksCompleted: Record<string, number> = {};
  
  nonTemplates.forEach(task => {
    const month = task.createdAt.substring(0, 7); // YYYY-MM
    if (task.status !== 'deleted') {
      // Only count non-deleted tasks as "created" for monthly stats
      monthlyTasksCreated[month] = (monthlyTasksCreated[month] || 0) + 1;
    }
    
    // Count both completed and archived as "done" for monthly completed stats
    if (task.status === 'completed' && task.completedAt) {
      const completedMonth = task.completedAt.substring(0, 7);
      monthlyTasksCompleted[completedMonth] = (monthlyTasksCompleted[completedMonth] || 0) + 1;
    } else if (task.status === 'archived' && task.archivedAt) {
      const archivedMonth = task.archivedAt.substring(0, 7);
      monthlyTasksCompleted[archivedMonth] = (monthlyTasksCompleted[archivedMonth] || 0) + 1;
    }
  });
  
  // Recently deleted (last 10)
  const recentlyDeletedCount = deleted.slice(-10).length;
  
  return {
    totalTasksCreated: totalCreated,
    activeTasksCount: active.length,
    completedTasksCount: allDone,
    deletedTasksCount: deleted.length,
    archivedTasksCount: archived.length,
    templatesCount: templates.length,
    completionRate,
    activeVsCompletedRatio,
    monthlyTasksCreated,
    monthlyTasksCompleted,
    recentlyDeletedCount,
    currentMonth,
  };
};

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  loading: false,

  // Getters
  getActiveTasks: () => get().tasks.filter(t => (t.status === 'active' || t.status === 'inProgress' || t.status === 'overdue') && !t.isTemplate),
  getCompletedTasks: () => get().tasks.filter(t => t.status === 'completed'),
  getDeletedTasks: () => get().tasks.filter(t => t.status === 'deleted').slice(-10), // Last 10
  getArchivedTasks: () => get().tasks.filter(t => t.status === 'archived'),
  getTemplates: () => get().tasks.filter(t => t.isTemplate),
  getStats: () => calculateStats(get().tasks),

  // ── New rich getters (merged from taskflow-react) ──
  getActiveTodayTasks: () => {
    const _n = new Date();
    const today = `${_n.getFullYear()}-${String(_n.getMonth() + 1).padStart(2, '0')}-${String(_n.getDate()).padStart(2, '0')}`;
    return get().tasks.filter(
      t => t.status === 'active' && !t.isTemplate && t.dueDate === today
    );
  },

  getUpcomingTasks: () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return get()
      .tasks.filter(t => {
        if ((t.status !== 'active' && t.status !== 'overdue') || t.isTemplate || !t.dueDate) return false;
        return new Date(t.dueDate) > today;
      })
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
  },

  getTasksByCategory: (category: string) => {
    return get().tasks.filter(
      t => (t.status === 'active' || t.status === 'overdue') && !t.isTemplate && t.category === category,
    );
  },

  searchTasks: (query: string) => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return get().tasks.filter(t => {
      const titleMatch = (t.title ?? t.text).toLowerCase().includes(q);
      const descMatch = t.description?.toLowerCase().includes(q) ?? false;
      const tagMatch = t.tags?.some(tag => tag.toLowerCase().includes(q)) ?? false;
      const notesMatch = t.notes?.toLowerCase().includes(q) ?? false;
      const catMatch = t.category?.toLowerCase().includes(q) ?? false;
      return titleMatch || descMatch || tagMatch || notesMatch || catMatch;
    });
  },

  addTask: async (text: string, userId?: string) => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      text,
      status: 'active',
      createdAt: new Date().toISOString(),
      userId,
    };


    if (userId) {
      // Rate limit: max 60 tasks/hour per user
      const { data: allowed } = await supabase.rpc('check_task_rate_limit');
      if (!allowed) {
        console.warn('[tasksStore] Rate limit exceeded');
        return;
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert([{
          id: newTask.id,
          text: newTask.text,
          status: newTask.status,
          user_id: userId,
          created_at: newTask.createdAt,
        }])
        .select();

      if (error) {
        console.error('Error adding task to Supabase:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error hint:', error.hint);
        console.error('Error details:', error.details);
        
        // Show user-friendly error
        if (error.code === '42P01') {
          console.error('❌ Table "tasks" does not exist! Please run supabase-setup.sql in your Supabase SQL Editor.');
        } else if (error.code === '42703' || error.code === 'PGRST204') {
          console.error('❌ Column does not exist! Your table is OUTDATED!');
          console.error('👉 Please run supabase-migration.sql in your Supabase SQL Editor to add missing columns.');
          console.error('👉 See SUPABASE_SETUP_INSTRUCTIONS.md for details.');
        }
        return;
      }
      

      await get().loadTasks(userId);
    } else {
      const tasks = [...get().tasks, newTask];
      set({ tasks });
      saveLocalTasks(tasks);
    }
  },

  // ── addTaskRich: create a task with all rich fields ──
  addTaskRich: async (form: TaskFormState, userId?: string) => {
    const tags = form.tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const newTask: Task = {
      id: crypto.randomUUID(),
      text: form.title,
      title: form.title,
      description: form.description || undefined,
      dueDate: form.dueDate || undefined,
      priority: form.priority,
      category: form.category,
      workspace: form.workspace || undefined,
      repeat: form.repeat,
      tags: tags.length > 0 ? tags : undefined,
      notes: form.notes || undefined,
      subtasks: form.subtasks.length > 0 ? form.subtasks : undefined,
      status: 'active',
      createdAt: new Date().toISOString(),
      userId,
    };

    if (userId) {
      // Rate limit: max 60 tasks/hour per user
      const { data: allowed } = await supabase.rpc('check_task_rate_limit');
      if (!allowed) {
        console.warn('[tasksStore] Rate limit exceeded');
        return;
      }

      const { error } = await supabase
        .from('tasks')
        .insert([{
          id: newTask.id,
          text: newTask.text,
          title: newTask.title,
          description: newTask.description ?? null,
          due_date: newTask.dueDate ?? null,
          priority: newTask.priority ?? null,
          category: newTask.category ?? null,
          workspace: newTask.workspace ?? null,
          repeat: newTask.repeat ?? null,
          tags: newTask.tags ?? null,
          notes: newTask.notes ?? null,
          subtasks: newTask.subtasks ? JSON.stringify(newTask.subtasks) : '[]',
          status: newTask.status,
          is_template: false,
          user_id: userId,
          created_at: newTask.createdAt,
        }]);

      if (error) {
        console.error('Error adding rich task to Supabase:', error);
        return;
      }
      await get().loadTasks(userId);
    } else {
      const tasks = [...get().tasks, newTask];
      set({ tasks });
      saveLocalTasks(tasks);
    }
  },

  updateTask: async (id: string, text: string, userId?: string) => {
    if (userId) {
      const { error } = await supabase
        .from('tasks')
        .update({ text })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating task:', error);
        return;
      }
      await get().loadTasks(userId);
    } else {
      const tasks = get().tasks.map(task =>
        task.id === id ? { ...task, text } : task
      );
      set({ tasks });
      saveLocalTasks(tasks);
    }
  },

  // ── updateTaskRich: update any subset of rich fields locally AND in Supabase ──
  updateTaskRich: async (id: string, updates: Partial<Task>, userId?: string) => {
    // ── Auto-resolve overdue status whenever dueDate is being changed ─────────
    const currentTask = get().tasks.find(t => t.id === id);
    const resolvedUpdates: Partial<Task> = { ...updates };
    if ('dueDate' in updates && currentTask) {
      resolvedUpdates.status = resolveStatusFromDueDate(
        resolvedUpdates.status ?? currentTask.status,
        updates.dueDate
      );
    }

    if (userId) {
      const supabaseUpdates: Record<string, unknown> = {};
      if (resolvedUpdates.text !== undefined || resolvedUpdates.title !== undefined) {
        supabaseUpdates.text  = resolvedUpdates.text ?? resolvedUpdates.title ?? '';
        supabaseUpdates.title = resolvedUpdates.title ?? resolvedUpdates.text ?? '';
      }
      if (resolvedUpdates.description !== undefined) supabaseUpdates.description = resolvedUpdates.description ?? null;
      // Use 'in' not '!== undefined' so explicit dueDate removal (undefined) also writes null to DB
      if ('dueDate' in resolvedUpdates) supabaseUpdates.due_date = resolvedUpdates.dueDate ?? null;
      if (resolvedUpdates.priority     !== undefined) supabaseUpdates.priority    = resolvedUpdates.priority ?? null;
      if (resolvedUpdates.category     !== undefined) supabaseUpdates.category    = resolvedUpdates.category ?? null;
      if (resolvedUpdates.workspace    !== undefined) supabaseUpdates.workspace   = resolvedUpdates.workspace ?? null;
      if (resolvedUpdates.repeat       !== undefined) supabaseUpdates.repeat      = resolvedUpdates.repeat ?? null;
      if (resolvedUpdates.tags         !== undefined) supabaseUpdates.tags        = resolvedUpdates.tags ?? null;
      if (resolvedUpdates.notes        !== undefined) supabaseUpdates.notes       = resolvedUpdates.notes ?? null;
      if (resolvedUpdates.subtasks     !== undefined) supabaseUpdates.subtasks    = JSON.stringify(resolvedUpdates.subtasks ?? []);
      if (resolvedUpdates.status       !== undefined) supabaseUpdates.status      = resolvedUpdates.status;

      if (Object.keys(supabaseUpdates).length > 0 && isValidUUID(id)) {
        const { error } = await supabase
          .from('tasks')
          .update(supabaseUpdates)
          .eq('id', id)
          .eq('user_id', userId);
        if (error) console.error('Error updating task in Supabase:', error);
      }
    }
    const tasks = get().tasks.map(task =>
      task.id === id
        ? { ...task, ...resolvedUpdates, text: resolvedUpdates.title ?? resolvedUpdates.text ?? task.text }
        : task,
    );
    set({ tasks });
    // Only persist locally when not authenticated — authenticated users use Supabase
    if (!userId) saveLocalTasks(tasks);
  },

  // ── Bulk operations (merged from taskflow-react) ──
  bulkComplete: async (ids: string[], userId?: string) => {
    const completedAt = new Date().toISOString();
    if (userId) {
      for (const id of ids) {
        if (!isValidUUID(id)) continue;
        await supabase
          .from('tasks')
          .update({ status: 'completed', completed_at: completedAt })
          .eq('id', id)
          .eq('user_id', userId);
      }
      await get().loadTasks(userId);
    } else {
      const tasks = get().tasks.map(task =>
        ids.includes(task.id) ? { ...task, status: 'completed' as TaskStatus, completedAt } : task,
      );
      set({ tasks });
      saveLocalTasks(tasks);
    }
  },

  bulkDelete: async (ids: string[], userId?: string) => {
    const deletedAt = new Date().toISOString();
    if (userId) {
      for (const id of ids) {
        if (!isValidUUID(id)) continue;
        await supabase
          .from('tasks')
          .update({ status: 'deleted', deleted_at: deletedAt })
          .eq('id', id)
          .eq('user_id', userId);
      }
      await get().loadTasks(userId);
    } else {
      const tasks = get().tasks.map(task =>
        ids.includes(task.id) ? { ...task, status: 'deleted' as TaskStatus, deletedAt } : task,
      );
      set({ tasks });
      saveLocalTasks(tasks);
    }
  },

  bulkSetPriority: async (ids: string[], priority: Priority, userId?: string) => {
    const tasks = get().tasks.map(task =>
      ids.includes(task.id) ? { ...task, priority } : task,
    );
    set({ tasks });
    saveLocalTasks(tasks);
    // NOTE: Priority is a rich field stored locally only for now.
    // TODO: Extend Supabase table with priority/metadata column to persist this.
  },

  deleteTask: async (id: string, userId?: string) => {
    const deletedAt = new Date().toISOString();
    
    if (userId && isValidUUID(id)) {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'deleted', deleted_at: deletedAt })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting task:', error);
        return;
      }
      await get().loadTasks(userId);
    } else {
      const tasks = get().tasks.map(task =>
        task.id === id ? { ...task, status: 'deleted' as TaskStatus, deletedAt } : task
      );
      set({ tasks });
      saveLocalTasks(tasks);
    }
  },

  markAsCompleted: async (id: string, userId?: string) => {
    const completedAt = new Date().toISOString();
    
    if (userId && isValidUUID(id)) {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'completed', completed_at: completedAt })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('Error marking task as completed:', error);
        return;
      }
      await get().loadTasks(userId);
    } else {
      const tasks = get().tasks.map(task =>
        task.id === id ? { ...task, status: 'completed' as TaskStatus, completedAt } : task
      );
      set({ tasks });
      saveLocalTasks(tasks);
    }
  },

  undoTask: async (id: string, userId?: string) => {
    const task = get().tasks.find(t => t.id === id);
    const restoredStatus = task ? resolveStatusFromDueDate('active', task.dueDate) : 'active';
    if (userId) {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: restoredStatus, 
          completed_at: null,
          deleted_at: null 
        })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('Error undoing task:', error);
        return;
      }
      await get().loadTasks(userId);
    } else {
      const tasks = get().tasks.map(t =>
        t.id === id ? { 
          ...t, 
          status: restoredStatus as TaskStatus, 
          completedAt: undefined,
          deletedAt: undefined 
        } : t
      );
      set({ tasks });
      saveLocalTasks(tasks);
    }
  },

  archiveTask: async (id: string, userId?: string) => {
    const archivedAt = new Date().toISOString();
    
    if (userId) {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'archived', archived_at: archivedAt })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('Error archiving task:', error);
        return;
      }
      await get().loadTasks(userId);
    } else {
      const tasks = get().tasks.map(task =>
        task.id === id ? { ...task, status: 'archived' as TaskStatus, archivedAt } : task
      );
      set({ tasks });
      saveLocalTasks(tasks);
    }
  },

  archiveAllCompleted: async (userId?: string) => {
    const archivedAt = new Date().toISOString();
    const completedTasks = get().getCompletedTasks();
    
    if (userId) {
      const completedIds = completedTasks.map(t => t.id);
      if (completedIds.length === 0) return;
      
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'archived', archived_at: archivedAt })
        .in('id', completedIds)
        .eq('user_id', userId);

      if (error) {
        console.error('Error archiving all completed:', error);
        return;
      }
      await get().loadTasks(userId);
    } else {
      const tasks = get().tasks.map(task =>
        task.status === 'completed' ? { ...task, status: 'archived' as TaskStatus, archivedAt } : task
      );
      set({ tasks });
      saveLocalTasks(tasks);
    }
  },

  clearHistory: async (userId?: string) => {
    const deletedTasks = get().getDeletedTasks();
    
    if (userId) {
      const deletedIds = deletedTasks.map(t => t.id);
      if (deletedIds.length === 0) return;
      
      const { error } = await supabase
        .from('tasks')
        .delete()
        .in('id', deletedIds)
        .eq('user_id', userId);

      if (error) {
        console.error('Error clearing history:', error);
        return;
      }
      await get().loadTasks(userId);
    } else {
      const tasks = get().tasks.filter(task => task.status !== 'deleted');
      set({ tasks });
      saveLocalTasks(tasks);
    }
  },

  createTemplate: async (text: string, userId?: string) => {
    const newTemplate: Task = {
      id: crypto.randomUUID(),
      text,
      status: 'active',
      createdAt: new Date().toISOString(),
      isTemplate: true,
      userId,
    };

    if (userId) {
      const { error } = await supabase
        .from('tasks')
        .insert([{
          id: newTemplate.id,
          text: newTemplate.text,
          status: newTemplate.status,
          is_template: true,
          user_id: userId,
          created_at: newTemplate.createdAt,
        }]);

      if (error) {
        console.error('Error creating template:', error);
        return;
      }
      
      await get().loadTasks(userId);
    } else {
      const tasks = [...get().tasks, newTemplate];
      set({ tasks });
      saveLocalTasks(tasks);
    }
  },

  createTemplateRich: async (form: TaskFormState, userId?: string) => {
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
    const newTemplate: Task = {
      id: crypto.randomUUID(),
      text: form.title,
      title: form.title,
      description: form.description || undefined,
      dueDate: form.dueDate || undefined,
      priority: form.priority,
      category: form.category || undefined,
      workspace: form.workspace || undefined,
      repeat: form.repeat,
      tags: tags.length > 0 ? tags : undefined,
      notes: form.notes || undefined,
      subtasks: form.subtasks.length > 0 ? form.subtasks : undefined,
      status: 'active',
      createdAt: new Date().toISOString(),
      isTemplate: true,
      userId,
    };

    if (userId) {
      const { error } = await supabase
        .from('tasks')
        .insert([{
          id: newTemplate.id,
          text: newTemplate.text,
          title: newTemplate.title,
          description: newTemplate.description ?? null,
          due_date: newTemplate.dueDate ?? null,
          priority: newTemplate.priority ?? null,
          category: newTemplate.category ?? null,
          workspace: newTemplate.workspace ?? null,
          repeat: newTemplate.repeat ?? null,
          tags: newTemplate.tags ?? null,
          notes: newTemplate.notes ?? null,
          subtasks: newTemplate.subtasks ? JSON.stringify(newTemplate.subtasks) : '[]',
          status: newTemplate.status,
          is_template: true,
          user_id: userId,
          created_at: newTemplate.createdAt,
        }]);

      if (error) {
        console.error('Error creating rich template:', error);
        return;
      }
      await get().loadTasks(userId);
    } else {
      const tasks = [...get().tasks, newTemplate];
      set({ tasks });
      saveLocalTasks(tasks);
    }
  },

  useTemplate: async (templateId: string, userId?: string) => {    const template = get().tasks.find(t => t.id === templateId && t.isTemplate);
    if (!template) return;
    
    // Create a new active task based on template
    await get().addTask(template.text, userId);
  },

  removeTemplate: async (templateId: string, userId?: string) => {
    if (userId) {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', templateId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error removing template:', error);
        return;
      }
      await get().loadTasks(userId);
    } else {
      const tasks = get().tasks.filter(task => task.id !== templateId);
      set({ tasks });
      saveLocalTasks(tasks);
    }
  },

  loadTasks: async (userId?: string) => {
    set({ loading: true });

    if (userId) {

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading tasks from Supabase:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        set({ loading: false });
        return;
      }


      const tasks: Task[] = data?.map(t => ({
        id: t.id,
        text: t.text ?? '',
        title: t.title ?? undefined,
        description: t.description ?? undefined,
        dueDate: t.due_date ?? undefined,
        priority: t.priority ?? undefined,
        category: t.category ?? undefined,
        workspace: t.workspace ?? undefined,
        repeat: t.repeat ?? undefined,
        tags: t.tags ?? undefined,
        notes: t.notes ?? undefined,
        subtasks: t.subtasks ? (typeof t.subtasks === 'string' ? JSON.parse(t.subtasks) : t.subtasks) : undefined,
        // Migrate: 'overdue' status from Supabase status field OR legacy outdated bool
        status: (
          t.status === 'overdue'
            ? 'overdue'
            : (t.outdated === true && t.status === 'active' ? 'overdue' : t.status)
        ) as TaskStatus,
        createdAt: t.created_at,
        completedAt: t.completed_at || undefined,
        deletedAt: t.deleted_at || undefined,
        archivedAt: t.archived_at || undefined,
        isTemplate: t.is_template || false,
        userId: t.user_id,
      })) || [];

      set({ tasks, loading: false });
    } else {

      const tasks = getLocalTasks();

      set({ tasks, loading: false });
    }
  },

  clearTasks: () => {
    set({ tasks: [] });
  },

  markOverdue: async (ids) => {
    if (ids.length === 0) return;
    const tasks = get().tasks.map((t) =>
      ids.includes(t.id)
        ? { ...t, status: 'overdue' as TaskStatus }
        : t
    );
    set({ tasks });
    // Only update localStorage for unauthenticated users
    const hasAuthenticatedTasks = tasks.some(t => t.userId);
    if (!hasAuthenticatedTasks) saveLocalTasks(tasks);
    for (const id of ids) {
      const task = tasks.find((t) => t.id === id);
      if (task?.userId && isValidUUID(id)) {
        await supabase.from('tasks').update({
          status: 'overdue',
        }).eq('id', id).eq('user_id', task.userId);
      }
    }
  },

  clearOverdue: async (id, userId) => {
    const tasks = get().tasks.map((t) =>
      t.id === id ? { ...t, status: 'active' as TaskStatus } : t
    );
    set({ tasks });
    if (!userId) saveLocalTasks(tasks);
    if (userId && isValidUUID(id)) {
      await supabase.from('tasks').update({ status: 'active' }).eq('id', id).eq('user_id', userId);
    }
  },
}));
