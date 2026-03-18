import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface PomodoroSession {
  id: string;
  userId?: string;
  taskId?: string;
  startedAt: string;   // ISO string
  endedAt?: string;    // ISO string — set when isEnded becomes true
  isEnded: boolean;
  isBreak: boolean;
}

export interface PomodoroStats {
  thisMonthStarted: number;
  thisMonthEnded: number;
  thisYearStarted: number;
  thisYearEnded: number;
}

interface PomodoroState {
  sessions: PomodoroSession[];

  // Start a new work session — returns the new session id
  startSession: (userId?: string, taskId?: string, isBreak?: boolean) => string;
  // Mark a session as ended
  endSession: (id: string, userId?: string) => void;
  // Computed stats
  getStats: () => PomodoroStats;

  loadSessions: (userId?: string) => Promise<void>;
}

const STORAGE_KEY = 'doitly_pomodoro_sessions_v1';

function loadLocal(): PomodoroSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocal(sessions: PomodoroSession[]) {
  if (typeof window !== 'undefined') {
    // Keep only last 500 sessions to prevent unbounded growth
    const trimmed = sessions.slice(-500);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  }
}

function calcStats(sessions: PomodoroSession[]): PomodoroStats {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentYear = String(now.getFullYear());

  const workSessions = sessions.filter((s) => !s.isBreak);

  const thisMonthStarted = workSessions.filter((s) => s.startedAt.startsWith(currentMonth)).length;
  const thisMonthEnded   = workSessions.filter((s) => s.isEnded && s.startedAt.startsWith(currentMonth)).length;
  const thisYearStarted  = workSessions.filter((s) => s.startedAt.startsWith(currentYear)).length;
  const thisYearEnded    = workSessions.filter((s) => s.isEnded && s.startedAt.startsWith(currentYear)).length;

  return { thisMonthStarted, thisMonthEnded, thisYearStarted, thisYearEnded };
}

export const usePomodoroStore = create<PomodoroState>((set, get) => ({
  sessions: loadLocal(),

  startSession: (userId, taskId, isBreak = false) => {
    const id = crypto.randomUUID();
    const session: PomodoroSession = {
      id,
      userId,
      taskId,
      startedAt: new Date().toISOString(),
      isEnded: false,
      isBreak,
    };
    const sessions = [...get().sessions, session];
    saveLocal(sessions);
    set({ sessions });

    // Persist to Supabase async (fire-and-forget)
    if (userId) {
      supabase
        .from('pomodoro_sessions')
        .insert({
          id,
          user_id: userId,
          task_id: taskId ?? null,
          started_at: session.startedAt,
          is_ended: false,
          is_break: isBreak,
        })
        .then(({ error }) => {
          if (error) console.warn('[pomodoro] insert error', error.message);
        });
    }
    return id;
  },

  endSession: (id, userId) => {
    const endedAt = new Date().toISOString();
    const sessions = get().sessions.map((s) =>
      s.id === id ? { ...s, isEnded: true, endedAt } : s
    );
    saveLocal(sessions);
    set({ sessions });

    if (userId) {
      supabase
        .from('pomodoro_sessions')
        .update({ is_ended: true, ended_at: endedAt })
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.warn('[pomodoro] update error', error.message);
        });
    }
  },

  getStats: () => calcStats(get().sessions),

  loadSessions: async (userId) => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('pomodoro_sessions')
      .select('id, user_id, task_id, started_at, ended_at, is_ended, is_break')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(500);

    if (error || !data) return;

    const sessions: PomodoroSession[] = data.map((r) => ({
      id: r.id,
      userId: r.user_id,
      taskId: r.task_id ?? undefined,
      startedAt: r.started_at,
      endedAt: r.ended_at ?? undefined,
      isEnded: r.is_ended ?? false,
      isBreak: r.is_break ?? false,
    }));
    saveLocal(sessions);
    set({ sessions });
  },
}));
