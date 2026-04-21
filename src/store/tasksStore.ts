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
  title?: string;         // display title (falls back to text if not set)
  description?: string;
  dueDate?: string;       // YYYY-MM-DD — per-instance due date
  startDate?: string;     // YYYY-MM-DD — first occurrence / cycle start (repeat tasks only)
  repeatEndDate?: string; // YYYY-MM-DD — last occurrence / end of cycle (undefined = infinite)
  templateId?: string;    // UUID — for instances: ID of the template task that generated them
  priority?: Priority;
  category?: string;
  repeat?: Repeat;
  tags?: string[];
  notes?: string;
  subtasks?: Subtask[];
  workspace?: string;
  isHabit?: boolean;   // true for every instance of a repeating (habit) series
  saveError?: boolean;
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
  getHabitGroups: () => HabitGroup[];

  // Actions
  addTask: (text: string, userId?: string) => Promise<void>;
  addTaskRich: (form: TaskFormState, userId?: string) => Promise<void>;
  updateTask: (id: string, text: string, userId?: string) => Promise<void>;
  updateTaskRich: (id: string, updates: Partial<Task>, userId?: string) => Promise<void>;
  deleteTask: (id: string, userId?: string) => Promise<void>;
  deleteHabitInstances: (habitId: string, mode: 'this' | 'future' | 'all', taskId: string, fromDate?: string, userId?: string) => Promise<void>;
  ensureHabitInstances: (userId?: string) => Promise<void>;
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
  bulkUndo: (ids: string[], userId?: string) => Promise<void>;
  bulkDelete: (ids: string[], userId?: string) => Promise<void>;
  bulkSetPriority: (ids: string[], priority: Priority, userId?: string) => Promise<void>;
  markOverdue: (ids: string[]) => Promise<void>;
  clearOverdue: (id: string, userId?: string) => Promise<void>;
  retryTask: (id: string, userId?: string) => Promise<void>;
  
  loadTasks: (userId?: string) => Promise<void>;
  
  clearTasks: () => void;
}

const STORAGE_KEY = 'doitly_tasks_v2';

// ── HabitGroup: aggregated view of a repeating series ───────────────────────
export interface HabitGroup {
  habitId: string;          // = templateId of root task (or id of root itself)
  title: string;
  repeat: Repeat;
  startDate: string;
  repeatEndDate?: string;
  totalCount: number;
  completedCount: number;
  overdueCount: number;
  completionRate: number;   // 0–1 fraction
  instances: Task[];
}

// ── Repeat instance generator ────────────────────────────────────────────────
// Generates occurrence dates within a window:
//   - Start: max(startDate, today)
//   - End: min(repeatEndDate, today + 30 days)
// This "lazy 30-day" approach avoids creating hundreds of instances upfront.
// More instances are generated automatically when loadTasks() detects coverage
// is running low (see ensureHabitInstances).

/** Generates dates in [windowStart, windowEnd] following the repeat rule. */
function generateRepeatDates(
  startDate: string,
  repeat: 'daily' | 'weekly' | 'monthly',
  repeatEndDate?: string,
  windowStart?: string,   // default = startDate
  windowEnd?: string,     // default = today+30 days
): string[] {
  const dates: string[] = [];

  // Determine the generation window
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const plus30 = new Date(todayDate);
  plus30.setDate(todayDate.getDate() + 30);

  // Series hard end
  const seriesEnd = repeatEndDate ? (() => {
    const [ey, em, ed] = repeatEndDate.split('-').map(Number);
    return new Date(ey, em - 1, ed);
  })() : null;

  // Effective window end = min(seriesEnd, today+30)
  const effectiveEnd = seriesEnd ? (seriesEnd < plus30 ? seriesEnd : plus30) : plus30;

  // Window start supplied (used when expanding forward) — else use startDate
  const winStartStr = windowStart ?? startDate;
  const [wsy, wsm, wsd] = winStartStr.split('-').map(Number);
  const winStartDate = new Date(wsy, wsm - 1, wsd);

  // Iterate from startDate until we're within window
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const current = new Date(sy, sm - 1, sd);

  while (current <= effectiveEnd) {
    if (current >= winStartDate) {
      const yyyy = current.getFullYear();
      const mm   = String(current.getMonth() + 1).padStart(2, '0');
      const dd   = String(current.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }

    // Advance
    if (repeat === 'daily') {
      current.setDate(current.getDate() + 1);
    } else if (repeat === 'weekly') {
      current.setDate(current.getDate() + 7);
    } else if (repeat === 'monthly') {
      current.setMonth(current.getMonth() + 1);
    }
  }

  return dates;
}

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
  getDeletedTasks: () => get().tasks.filter(t => t.status === 'deleted' && !t.isHabit).slice(-10), // Last 10, habits excluded
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


    // Optimistic update
    const optimisticTasks = [...get().tasks, newTask];
    set({ tasks: optimisticTasks });
    if (!userId) saveLocalTasks(optimisticTasks);

    if (userId) {
      // Rate limit: max 60 tasks/hour per user
      const { data: allowed } = await supabase.rpc('check_task_rate_limit');
      if (!allowed) {
        console.warn('[tasksStore] Rate limit exceeded');
        set({ tasks: get().tasks.filter(t => t.id !== newTask.id) });
        return;
      }

      const { error } = await supabase
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
        if (error.code === '42P01') {
          console.error('❌ Table "tasks" does not exist! Please run supabase-setup.sql in your Supabase SQL Editor.');
        } else if (error.code === '42703' || error.code === 'PGRST204') {
          console.error('❌ Column does not exist! Your table is OUTDATED!');
        }
        // Mark task as failed (keep it visible, show error indicator)
        set({ tasks: get().tasks.map(t => t.id === newTask.id ? { ...t, saveError: true } : t) });
        throw error;
      }

      // Sync in background
      get().loadTasks(userId);
    }
  },

  // ── addTaskRich: create a task (or a series of repeat instances) ──
  addTaskRich: async (form: TaskFormState, userId?: string) => {
    const tags = form.tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const isRepeat = form.repeat !== 'none';
    const now = new Date().toISOString();

    // ── Build task(s) to insert ───────────────────────────────────────────────
    let newTasks: Task[];

    if (isRepeat && form.startDate) {
      // Generate one task per occurrence in the repeat series.
      // Each instance shares all fields but gets its own id + dueDate.
      const dates = generateRepeatDates(
        form.startDate,
        form.repeat as 'daily' | 'weekly' | 'monthly',
        form.repeatEndDate || undefined,
      );

      // Root is the first instance. Its id is used as templateId for all others.
      // NOTE: templateId is deliberately NOT set on the root itself so it can be
      // inserted without a FK cycle (root row must exist before instances reference it).
      const rootId = crypto.randomUUID();

      newTasks = dates.map((date, idx) => ({
        id: idx === 0 ? rootId : crypto.randomUUID(),
        text: form.title,
        title: form.title,
        description: form.description || undefined,
        dueDate: date,
        startDate: form.startDate,
        repeatEndDate: form.repeatEndDate || undefined,
        // Root has no templateId; instances reference the root
        templateId: idx === 0 ? undefined : rootId,
        priority: form.priority,
        category: form.category || undefined,
        workspace: form.workspace || undefined,
        repeat: form.repeat,
        tags: tags.length > 0 ? tags : undefined,
        notes: form.notes || undefined,
        subtasks: form.subtasks.length > 0 ? form.subtasks : undefined,
        status: 'active' as const,
        isHabit: true,
        createdAt: now,
        userId,
      }));
    } else {
      // Single task (no repeat)
      newTasks = [{
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
        status: 'active' as const,
        createdAt: now,
        userId,
      }];
    }

    // Optimistic update — add all instances to store immediately
    const optimisticTasks = [...get().tasks, ...newTasks];
    set({ tasks: optimisticTasks });
    if (!userId) saveLocalTasks(optimisticTasks);

    if (userId) {
      const toRow = (task: Task) => ({
        id: task.id,
        text: task.text,
        title: task.title ?? null,
        description: task.description ?? null,
        due_date: task.dueDate ?? null,
        start_date: task.startDate ?? null,
        repeat_end_date: task.repeatEndDate ?? null,
        template_id: task.templateId ?? null,
        priority: task.priority ?? null,
        category: task.category ?? null,
        workspace: task.workspace ?? null,
        repeat: task.repeat ?? null,
        tags: task.tags ?? null,
        notes: task.notes ?? null,
        subtasks: task.subtasks ? JSON.stringify(task.subtasks) : '[]',
        status: task.status,
        is_habit: task.isHabit ?? false,
        is_template: false,
        user_id: userId,
        created_at: task.createdAt,
      });

      // For repeat series: insert root first (so FK template_id → tasks(id) is satisfied),
      // then all instances in a single batch. For a single task: one insert.
      const insertedIds = new Set(newTasks.map(t => t.id));

      const markFailed = () => {
        set({ tasks: get().tasks.map(t => insertedIds.has(t.id) ? { ...t, saveError: true } : t) });
      };

      if (newTasks.length === 1) {
        const { error } = await supabase.from('tasks').insert([toRow(newTasks[0])]);
        if (error) {
          console.error('Error adding task to Supabase:', error);
          markFailed();
          throw error;
        }
      } else {
        // Step 1: insert root (index 0)
        const { error: rootError } = await supabase.from('tasks').insert([toRow(newTasks[0])]);
        if (rootError) {
          console.error('Error inserting root repeat task:', rootError);
          markFailed();
          throw rootError;
        }
        // Step 2: insert all instances in one batch (they can now reference rootId via FK)
        // Chunk into batches of 50 to stay safely within Supabase request size limits
        const instances = newTasks.slice(1);
        const CHUNK = 50;
        for (let i = 0; i < instances.length; i += CHUNK) {
          const chunk = instances.slice(i, i + CHUNK).map(toRow);
          const { error: chunkError } = await supabase.from('tasks').insert(chunk);
          if (chunkError) {
            console.error(`Error inserting repeat instances (chunk ${i / CHUNK + 1}):`, chunkError);
            markFailed();
            throw chunkError;
          }
        }
      }

      get().loadTasks(userId);
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
      if ('dueDate' in resolvedUpdates)       supabaseUpdates.due_date        = resolvedUpdates.dueDate ?? null;
      if ('startDate' in resolvedUpdates)     supabaseUpdates.start_date      = resolvedUpdates.startDate ?? null;
      if ('repeatEndDate' in resolvedUpdates) supabaseUpdates.repeat_end_date = resolvedUpdates.repeatEndDate ?? null;
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

  bulkUndo: async (ids: string[], userId?: string) => {
    if (userId) {
      for (const id of ids) {
        if (!isValidUUID(id)) continue;
        await supabase
          .from('tasks')
          .update({ status: 'active', completed_at: null })
          .eq('id', id)
          .eq('user_id', userId);
      }
      await get().loadTasks(userId);
    } else {
      const tasks = get().tasks.map(task =>
        ids.includes(task.id) ? { ...task, status: 'active' as TaskStatus, completedAt: undefined } : task,
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
        startDate: t.start_date ?? undefined,
        repeatEndDate: t.repeat_end_date ?? undefined,
        templateId: t.template_id ?? undefined,
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
        isHabit: t.is_habit || false,
        userId: t.user_id,
      })) || [];

      set({ tasks, loading: false });
      // After loading, ensure habits have enough future instances
      await get().ensureHabitInstances(userId);
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

  // ── getHabitGroups: aggregate habit instances into one entry per series ──
  getHabitGroups: (): HabitGroup[] => {
    const allTasks = get().tasks;
    const habitTasks = allTasks.filter(t => t.isHabit && !t.isTemplate && t.status !== 'deleted' && t.status !== 'archived');

    const grouped = new Map<string, Task[]>();
    for (const t of habitTasks) {
      const key = t.templateId ?? t.id;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(t);
    }

    const groups: HabitGroup[] = [];
    for (const [habitId, instances] of grouped.entries()) {
      const root = instances.find(t => !t.templateId) ?? instances[0];
      const nonDeleted = instances.filter(t => t.status !== 'deleted' && t.status !== 'archived');
      const completed = nonDeleted.filter(t => t.status === 'completed');
      const overdue = nonDeleted.filter(t => t.status === 'overdue');
      groups.push({
        habitId,
        title: root.title ?? root.text,
        repeat: root.repeat ?? 'daily',
        startDate: root.startDate ?? root.dueDate ?? root.createdAt.slice(0, 10),
        repeatEndDate: root.repeatEndDate,
        totalCount: nonDeleted.length,
        completedCount: completed.length,
        overdueCount: overdue.length,
        completionRate: nonDeleted.length > 0 ? completed.length / nonDeleted.length : 0,
        instances: nonDeleted.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')),
      });
    }

    return groups.sort((a, b) => a.startDate.localeCompare(b.startDate));
  },

  // ── deleteHabitInstances: delete one / future / all instances of a habit ──
  deleteHabitInstances: async (
    habitId: string,
    mode: 'this' | 'future' | 'all',
    taskId: string,
    fromDate?: string,
    userId?: string,
  ) => {
    const deletedAt = new Date().toISOString();
    const allTasks = get().tasks;

    let idsToDelete: string[];

    if (mode === 'this') {
      idsToDelete = [taskId];
    } else if (mode === 'future') {
      const cutoff = fromDate ?? '';
      idsToDelete = allTasks
        .filter(t => (t.templateId === habitId || t.id === habitId) && t.isHabit && (t.dueDate ?? '') >= cutoff)
        .map(t => t.id);
      if (!idsToDelete.includes(taskId)) idsToDelete.push(taskId);
    } else {
      idsToDelete = allTasks
        .filter(t => t.templateId === habitId || t.id === habitId)
        .map(t => t.id);
    }

    if (userId) {
      const validIds = idsToDelete.filter(isValidUUID);
      if (validIds.length > 0) {
        const CHUNK = 50;
        for (let i = 0; i < validIds.length; i += CHUNK) {
          const chunk = validIds.slice(i, i + CHUNK);
          await supabase
            .from('tasks')
            .update({ status: 'deleted', deleted_at: deletedAt })
            .in('id', chunk)
            .eq('user_id', userId);
        }
      }
      await get().loadTasks(userId);
    } else {
      const idSet = new Set(idsToDelete);
      const tasks = get().tasks.map(t =>
        idSet.has(t.id) ? { ...t, status: 'deleted' as TaskStatus, deletedAt } : t,
      );
      set({ tasks });
      saveLocalTasks(tasks);
    }
  },

  // ── ensureHabitInstances: generate new instances for habits running low on coverage ──
  ensureHabitInstances: async (userId?: string) => {
    const allTasks = get().tasks;
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const today = localDateStr(todayDate);
    const threshold = new Date(todayDate);
    threshold.setDate(todayDate.getDate() + 28);
    const thresholdStr = localDateStr(threshold);

    const roots = allTasks.filter(
      t => t.isHabit && !t.templateId && !t.isTemplate &&
           t.status !== 'deleted' && t.status !== 'archived',
    );

    const newInstances: Task[] = [];

    for (const root of roots) {
      if (!root.repeat || root.repeat === 'none') continue;
      if (!root.startDate) continue;
      if (root.repeatEndDate && root.repeatEndDate < today) continue;

      const seriesInstances = allTasks.filter(
        t => (t.templateId === root.id || t.id === root.id) &&
             t.isHabit &&
             (t.status === 'active' || t.status === 'overdue' || t.status === 'inProgress'),
      );

      const futureDates = seriesInstances
        .map(t => t.dueDate ?? '')
        .filter(d => d >= today)
        .sort();

      const lastCoveredDate = futureDates.length > 0 ? futureDates[futureDates.length - 1] : '';
      if (lastCoveredDate >= thresholdStr) continue;

      const existingDates = new Set(
        allTasks
          .filter(t => t.templateId === root.id || t.id === root.id)
          .map(t => t.dueDate ?? ''),
      );

      const windowStart = lastCoveredDate
        ? (() => {
            const d = new Date(lastCoveredDate + 'T00:00:00');
            d.setDate(d.getDate() + 1);
            return localDateStr(d);
          })()
        : today;

      const newDates = generateRepeatDates(
        root.startDate,
        root.repeat as 'daily' | 'weekly' | 'monthly',
        root.repeatEndDate,
        windowStart,
      ).filter(d => !existingDates.has(d));

      if (newDates.length === 0) continue;

      const now = new Date().toISOString();
      for (const date of newDates) {
        newInstances.push({
          id: crypto.randomUUID(),
          text: root.text,
          title: root.title,
          description: root.description,
          dueDate: date,
          startDate: root.startDate,
          repeatEndDate: root.repeatEndDate,
          templateId: root.id,
          priority: root.priority,
          category: root.category,
          workspace: root.workspace,
          repeat: root.repeat,
          tags: root.tags,
          notes: root.notes,
          subtasks: root.subtasks,
          status: 'active' as const,
          isHabit: true,
          createdAt: now,
          userId,
        });
      }
    }

    if (newInstances.length === 0) return;

    const optimistic = [...get().tasks, ...newInstances];
    set({ tasks: optimistic });

    if (userId) {
      const toRow = (t: Task) => ({
        id: t.id,
        text: t.text,
        title: t.title ?? null,
        description: t.description ?? null,
        due_date: t.dueDate ?? null,
        start_date: t.startDate ?? null,
        repeat_end_date: t.repeatEndDate ?? null,
        template_id: t.templateId ?? null,
        priority: t.priority ?? null,
        category: t.category ?? null,
        workspace: t.workspace ?? null,
        repeat: t.repeat ?? null,
        tags: t.tags ?? null,
        notes: t.notes ?? null,
        subtasks: t.subtasks ? JSON.stringify(t.subtasks) : '[]',
        status: t.status,
        is_habit: true,
        is_template: false,
        user_id: userId,
        created_at: t.createdAt,
      });

      const CHUNK = 50;
      for (let i = 0; i < newInstances.length; i += CHUNK) {
        const chunk = newInstances.slice(i, i + CHUNK).map(toRow);
        const { error } = await supabase.from('tasks').insert(chunk);
        if (error) {
          console.error('[ensureHabitInstances] Insert error:', error);
          const ids = new Set(newInstances.map(inst => inst.id));
          set({ tasks: get().tasks.map(t => ids.has(t.id) ? { ...t, saveError: true } : t) });
          return;
        }
      }
    } else {
      saveLocalTasks(get().tasks);
    }
  },

  // ── retryTask: attempt to re-save a failed task (saveError: true) to Supabase ──
  retryTask: async (id: string, userId?: string) => {
    const task = get().tasks.find(t => t.id === id);
    if (!task || !userId) return;

    const { error } = await supabase
      .from('tasks')
      .insert([{
        id: task.id,
        text: task.text,
        title: task.title ?? null,
        description: task.description ?? null,
        due_date: task.dueDate ?? null,
        start_date: task.startDate ?? null,
        repeat_end_date: task.repeatEndDate ?? null,
        template_id: task.templateId ?? null,
        priority: task.priority ?? null,
        category: task.category ?? null,
        workspace: task.workspace ?? null,
        repeat: task.repeat ?? null,
        tags: task.tags ?? null,
        notes: task.notes ?? null,
        subtasks: task.subtasks ? JSON.stringify(task.subtasks) : '[]',
        status: task.status,
        is_habit: task.isHabit ?? false,
        is_template: false,
        user_id: userId,
        created_at: task.createdAt,
      }]);

    if (error) {
      console.error('Retry failed:', error);
      // Keep saveError: true so the indicator stays visible
      return;
    }

    // Success: clear the error flag
    set({ tasks: get().tasks.map(t => t.id === id ? { ...t, saveError: false } : t) });
    get().loadTasks(userId);
  },
}));
