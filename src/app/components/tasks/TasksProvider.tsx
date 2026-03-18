import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useTasksStore } from '@/store/tasksStore';

// Returns milliseconds until next midnight (local time)
function msUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setDate(now.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuthStore();
  const { loadTasks, clearTasks, tasks, markOverdue } = useTasksStore();

  // Keep a stable ref to markOverdue so our timers don't capture stale closure
  const markOverdueRef = useRef(markOverdue);
  const tasksRef = useRef(tasks);

  // Keep refs in sync inside an effect (avoids ref-during-render lint rule)
  useEffect(() => {
    markOverdueRef.current = markOverdue;
    tasksRef.current = tasks;
  });

  useEffect(() => {
    if (!initialized) {
      return;
    }
    if (user) {
      loadTasks(user.id);
    } else {
      // Logged out — show only local (anonymous) tasks, not Supabase data
      clearTasks();
    }
  }, [user, initialized, loadTasks, clearTasks]);

  // ── Overdue sweep ─────────────────────────────────────────────────────────
  // Run on mount + whenever tasks change (covers page reload).
  // Also schedules a midnight sweep and a Monday-boundary sweep.
  useEffect(() => {
    const runDailySweep = () => {
      const now = new Date();
      const y = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const today = `${y}-${mo}-${d}`;
      // A task is overdue when its dueDate is strictly in the past.
      // dueDate is the single source of truth — no flag checks needed.
      const overdueIds = tasksRef.current
        .filter(
          (t) =>
            (t.status === 'active' || t.status === 'inProgress') &&
            !t.isTemplate &&
            t.dueDate !== undefined &&
            t.dueDate < today,
        )
        .map((t) => t.id);
      if (overdueIds.length > 0) markOverdueRef.current(overdueIds);
    };

    // Run immediately on mount / tasks change
    runDailySweep();

    // Schedule next midnight sweep
    const midnightTimer = setTimeout(() => {
      runDailySweep();
    }, msUntilMidnight());

    return () => {
      clearTimeout(midnightTimer);
    };
  }, [tasks]);

  return <>{children}</>;
}

