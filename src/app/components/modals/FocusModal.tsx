import { useState, useEffect, useRef, useMemo } from "react";
import { useTasksStore, type Task, type TaskStatus } from "@/store/tasksStore";
import { useUIStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { usePomodoroStore } from "@/store/pomodoroStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useBrowserNotifications } from "@/hooks/useBrowserNotifications";

const WORK_DURATION = 25 * 60;
const BREAK_DURATION = 5 * 60;

const PRIORITY_MAP: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-300",
  high: "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300",
};

export const FocusModal = () => {
  const { tasks: allTasks, markAsCompleted, updateTaskRich } = useTasksStore();
  const { modals, closeAllModals, showNotification, setView, activeWorkspaceId } = useUIStore();
  const { user } = useAuthStore();
  const { workspaces } = useWorkspaceStore();
  const { startSession, endSession } = usePomodoroStore();
  const { notify, playSound } = useBrowserNotifications();
  const isOpen = modals.focus;
  useBodyScrollLock(isOpen);

  // Derive workspace-scoped today tasks (no getActiveTasks() — that ignores workspace)
  const todayTasksSource = useMemo(() => {
    const _n = new Date();
    const today = `${_n.getFullYear()}-${String(_n.getMonth() + 1).padStart(2, "0")}-${String(_n.getDate()).padStart(2, "0")}`;
    const activeWorkspaceName = workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? null;
    return allTasks.filter(
      (t) =>
        (t.status === "active" || t.status === "inProgress") &&
        !t.isTemplate &&
        (!activeWorkspaceName || !t.workspace || t.workspace === activeWorkspaceName) &&
        t.dueDate === today,
    );
  }, [allTasks, activeWorkspaceId, workspaces]);

  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [task, setTask] = useState<Task | null>(null);
  const [timeLeft, setTimeLeft] = useState(WORK_DURATION);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [roundsCompleted, setRoundsCompleted] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isBreakRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const notifyRef = useRef(notify);
  const playSoundRef = useRef(playSound);
  useEffect(() => { notifyRef.current = notify; }, [notify]);
  useEffect(() => { playSoundRef.current = playSound; }, [playSound]);

  const resetTimer = (toBreak?: boolean) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
    const brk = toBreak ?? isBreakRef.current;
    isBreakRef.current = brk;
    setIsBreak(brk);
    setTimeLeft(brk ? BREAK_DURATION : WORK_DURATION);
  };

  useEffect(() => {
    if (!isOpen) return;
    setTodayTasks(todayTasksSource);
    setTask(todayTasksSource[0] ?? null);
    resetTimer(false);
    sessionIdRef.current = null;
    setRoundsCompleted(0);
  }, [isOpen, todayTasksSource]);

  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setIsRunning(false);
          if (sessionIdRef.current) {
            endSession(sessionIdRef.current, user?.id);
            sessionIdRef.current = null;
          }
          const nowBreak = isBreakRef.current;
          showNotification(
            nowBreak
              ? "☕ Break over! Ready for the next session?"
              : "✅ Work session complete! Take a break.",
            nowBreak ? "info" : "success",
          );
          // Browser notification + sound alert
          if (nowBreak) {
            notifyRef.current("☕ Break over!", "Ready for the next work session?");
            playSoundRef.current("break_done");
          } else {
            notifyRef.current("✅ Work session complete!", "Time for a well-deserved break.");
            playSoundRef.current("work_done");
          }
          if (!nowBreak) {
            setRoundsCompleted((r) => r + 1);
          }
          const next = !nowBreak;
          isBreakRef.current = next;
          setIsBreak(next);
          setTimeLeft(next ? BREAK_DURATION : WORK_DURATION);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  const close = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
    // Restore inProgress tasks to active when closing without completing
    todayTasks.forEach((t) => {
      if (t.status === 'inProgress') {
        void updateTaskRich(t.id, { status: 'active' as TaskStatus }, t.userId);
      }
    });
    closeAllModals();
  };

  const handleStart = () => {
    const id = startSession(user?.id, task?.id, isBreak);
    sessionIdRef.current = id;
    setIsRunning(true);
    // Mark the focused task as inProgress
    if (task && task.status !== 'inProgress') {
      void updateTaskRich(task.id, { status: 'inProgress' as TaskStatus }, user?.id);
    }
  };

  const handlePause = () => setIsRunning(false);

  const toggleBreak = () => resetTimer(!isBreak);

  const handleMarkComplete = async () => {
    if (!task) return;
    await markAsCompleted(task.id, user?.id);
    showNotification("Task completed!", "success");
    const remaining = todayTasks.filter((t) => t.id !== task.id);
    setTask(remaining[0] ?? null);
    setTodayTasks(remaining);
    if (remaining.length === 0) close();
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    if (!task?.subtasks) return;
    const updated = task.subtasks.map((st) =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    const updatedTask: Task = { ...task, subtasks: updated };
    // Optimistic local update
    setTask(updatedTask);
    setTodayTasks((prev) => prev.map((t) => t.id === task.id ? updatedTask : t));
    await updateTaskRich(task.id, { subtasks: updated }, user?.id);
  };

  const handleGoToPlanDay = () => {
    close();
    setView("planDay");
  };

  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const seconds = String(timeLeft % 60).padStart(2, "0");
  const progress = isBreak
    ? ((BREAK_DURATION - timeLeft) / BREAK_DURATION) * 100
    : ((WORK_DURATION - timeLeft) / WORK_DURATION) * 100;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background flex flex-col overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="My Flow focus mode"
    >
      <button
        onClick={close}
        aria-label="Close focus mode"
        className="absolute top-5 right-5 p-2 hover:bg-accent rounded-lg transition-colors text-foreground z-10 hover:cursor-pointer"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="flex-1 flex flex-col items-center justify-start py-12 px-4 gap-6 max-w-2xl mx-auto w-full">

        {/* Header */}
        <div className="w-full text-center">
          <h1 className="text-3xl font-bold text-foreground">My Flow</h1>
          <p className="text-muted-foreground text-sm mt-1">Stay focused. One task at a time.</p>
        </div>

        {/* Task Selector */}
        {todayTasks.length > 0 ? (
          <div className="w-full bg-card border border-border rounded-2xl p-6 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Currently focusing on
            </p>
            <div className="flex flex-col gap-2">
              {todayTasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTask(t)}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                    task?.id === t.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-accent"
                  }`}
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                      task?.id === t.id ? "border-primary bg-primary" : "border-muted-foreground/40"
                    }`}
                  >
                    {task?.id === t.id && (
                      <svg className="w-2.5 h-2.5 text-primary-foreground" fill="currentColor" viewBox="0 0 8 8">
                        <circle cx="4" cy="4" r="3" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug">{t.title ?? t.text}</p>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {t.priority && (
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_MAP[t.priority] ?? ""}`}>
                          {t.priority}
                        </span>
                      )}
                      {t.category && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {t.category}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {task && (
              <button
                onClick={handleMarkComplete}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors text-white hover:cursor-pointer" aria-label="Close focus"
              >
                ✓ Mark as Completed
              </button>
            )}
          </div>
        ) : (
          <div className="w-full bg-card border border-border rounded-2xl p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted mx-auto flex items-center justify-center">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-foreground font-medium">No tasks planned for today</p>
              <p className="text-muted-foreground text-sm mt-1">
                Plan your day first — then come back to focus.
              </p>
            </div>
            <button
              onClick={handleGoToPlanDay}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity hover:cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Plan your day
            </button>
          </div>
        )}

        {/* Pomodoro Timer */}
        <div className="w-full bg-card border border-border rounded-2xl p-6 text-center space-y-5">
          <div className="flex items-center justify-center gap-3">
            <h3 className="text-lg font-semibold text-foreground">Pomodoro Timer</h3>
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${
                isBreak ? "bg-teal-700 text-teal-200" : "bg-blue-700 text-blue-200"
              }`}
            >
              {isBreak ? "☕ Break" : "🎯 Work"}
            </span>
          </div>

          <div className="relative inline-flex items-center justify-center">
            <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
              <circle
                cx="60" cy="60" r="54" fill="none"
                stroke={isBreak ? "#14b8a6" : "#3b82f6"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 54}`}
                strokeDashoffset={`${2 * Math.PI * 54 * (1 - progress / 100)}`}
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <span className="absolute text-3xl font-bold font-mono">
              {minutes}:{seconds}
            </span>
          </div>

          <div className="flex gap-2 justify-center">
            {!isRunning ? (
              <button
                onClick={handleStart}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors text-sm text-white hover:cursor-pointer"
              >
                ▶ Start
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="px-5 py-2.5 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-semibold transition-colors text-sm text-white hover:cursor-pointer"
              >
                ⏸ Pause
              </button>
            )}
            <button
              onClick={() => { resetTimer(isBreak); sessionIdRef.current = null; }}
              className="px-5 py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-lg font-semibold transition-colors text-sm hover:cursor-pointer"
            >
              ↺ Reset
            </button>
            <button
              onClick={toggleBreak}
              className="px-5 py-2.5 bg-muted/80 hover:bg-muted text-foreground rounded-lg font-semibold transition-colors text-sm hover:cursor-pointer"
            >
              {isBreak ? "→ Work" : "→ Break"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">25 min work • 5 min break</p>
          {roundsCompleted > 0 && (
            <p className="text-xs text-primary font-medium">
              {roundsCompleted} round{roundsCompleted !== 1 ? "s" : ""} completed this session
            </p>
          )}
        </div>

        {/* Subtasks */}
        {task?.subtasks && task.subtasks.length > 0 && (
          <div className="w-full bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-foreground">Subtasks</h3>
              <span className="text-xs text-muted-foreground">
                {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} done
              </span>
            </div>
            <div className="space-y-2">
              {task.subtasks.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => handleToggleSubtask(st.id)}
                  className="w-full flex items-center gap-3 p-2.5 bg-muted/60 hover:bg-muted rounded-lg transition-colors text-left group"
                >
                  <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                    st.completed
                      ? "bg-green-500 border-green-500"
                      : "border-border group-hover:border-primary/60"
                  }`}>
                    {st.completed && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm flex-1 ${st.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {st.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {task?.notes && (
          <div className="w-full bg-card border border-border rounded-2xl p-6">
            <h3 className="text-base font-semibold mb-2 text-foreground">Notes</h3>
            <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">{task.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
};
