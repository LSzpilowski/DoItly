import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export type TaskStatus = 'active' | 'completed' | 'deleted' | 'archived';

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
  
  // Actions
  addTask: (text: string, userId?: string) => Promise<void>;
  updateTask: (id: string, text: string, userId?: string) => Promise<void>;
  deleteTask: (id: string, userId?: string) => Promise<void>;
  markAsCompleted: (id: string, userId?: string) => Promise<void>;
  undoTask: (id: string, userId?: string) => Promise<void>;
  archiveTask: (id: string, userId?: string) => Promise<void>;
  archiveAllCompleted: (userId?: string) => Promise<void>;
  clearHistory: (userId?: string) => Promise<void>;
  createTemplate: (text: string, userId?: string) => Promise<void>;
  useTemplate: (templateId: string, userId?: string) => Promise<void>;
  removeTemplate: (templateId: string, userId?: string) => Promise<void>;
  
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }
};

const calculateStats = (tasks: Task[]): UserStats => {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const nonTemplates = tasks.filter(t => !t.isTemplate);
  const templates = tasks.filter(t => t.isTemplate);
  
  const active = nonTemplates.filter(t => t.status === 'active');
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
  getActiveTasks: () => get().tasks.filter(t => t.status === 'active' && !t.isTemplate),
  getCompletedTasks: () => get().tasks.filter(t => t.status === 'completed'),
  getDeletedTasks: () => get().tasks.filter(t => t.status === 'deleted').slice(-10), // Last 10
  getArchivedTasks: () => get().tasks.filter(t => t.status === 'archived'),
  getTemplates: () => get().tasks.filter(t => t.isTemplate),
  getStats: () => calculateStats(get().tasks),

  addTask: async (text: string, userId?: string) => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      text,
      status: 'active',
      createdAt: new Date().toISOString(),
      userId,
    };


    if (userId) {

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

  deleteTask: async (id: string, userId?: string) => {
    const deletedAt = new Date().toISOString();
    
    if (userId) {
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
    
    if (userId) {
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
    if (userId) {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: 'active', 
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
      const tasks = get().tasks.map(task =>
        task.id === id ? { 
          ...task, 
          status: 'active' as TaskStatus, 
          completedAt: undefined,
          deletedAt: undefined 
        } : task
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

  useTemplate: async (templateId: string, userId?: string) => {
    const template = get().tasks.find(t => t.id === templateId && t.isTemplate);
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
        text: t.text,
        status: t.status as TaskStatus,
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
}));
