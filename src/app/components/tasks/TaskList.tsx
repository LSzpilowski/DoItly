import { useMemo, useState, useEffect } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useTasksStore } from "@/store/tasksStore";
import { useUIStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { TaskItem } from "./TaskItem";
import type { Task } from "@/store/tasksStore";
import type { Priority, SortField, View } from "@/store/types";
import { CalendarView } from "@/app/components/CalendarView";
import { getISOWeekString } from "@/store/tasksStore";

const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const SORT_LABELS: Record<SortField, string> = {
  created: "Date Created",
  dueDate: "Due Date",
  priority: "Priority",
  title: "Title A-Z",
};

function sortTasks(tasks: Task[], field: SortField, dir: "asc" | "desc"): Task[] {
  const sorted = [...tasks].sort((a, b) => {
    let cmp = 0;
    if (field === "created") {
      cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else if (field === "dueDate") {
      const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      cmp = aDate - bDate;
    } else if (field === "priority") {
      const aP = PRIORITY_ORDER[a.priority ?? "medium"] ?? 2;
      const bP = PRIORITY_ORDER[b.priority ?? "medium"] ?? 2;
      cmp = aP - bP;
    } else if (field === "title") {
      cmp = (a.title ?? a.text).localeCompare(b.title ?? b.text);
    }
    return dir === "asc" ? cmp : -cmp;
  });
  return sorted;
}

// ── Today: collapsible priority accordion ──────────────────────────────────
const PRIORITY_BUCKETS: { key: Priority; label: string; color: string; dot: string }[] = [
  { key: "high",   label: "Must have",    color: "text-red-600 dark:text-red-400",    dot: "bg-red-500" },
  { key: "medium", label: "Should have",  color: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  { key: "low",    label: "Nice to have", color: "text-green-600 dark:text-green-400",  dot: "bg-green-500" },
];

function PriorityAccordion({
  bucket,
  tasks,
}: {
  bucket: (typeof PRIORITY_BUCKETS)[number];
  tasks: Task[];
}) {
  const [open, setOpen] = useState(true);
  if (tasks.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 py-1 px-1 rounded-lg hover:bg-accent/40 transition-colors w-full text-left group"
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${bucket.dot}`} />
        <span className={`text-xs font-semibold uppercase tracking-wider ${bucket.color}`}>
          {bucket.label}
        </span>
        <span className="text-xs text-muted-foreground ml-1">({tasks.length})</span>
        <span className="ml-auto text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 pl-4">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Upcoming: group by date with formatted headers ──────────────────────────
function formatUpcomingHeader(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const d = new Date(dateStr + "T00:00:00");
  d.setHours(0, 0, 0, 0);

  const dayName = d.toLocaleDateString("en-GB", { weekday: "long" });
  const formatted = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  if (d.getTime() === today.getTime()) {
    return `${formatted} · Today · ${dayName}`;
  }
  if (d.getTime() === tomorrow.getTime()) {
    return `${formatted} · Tomorrow · ${dayName}`;
  }
  return `${formatted} · ${dayName}`;
}

function UpcomingDateGroup({ dateStr, tasks }: { dateStr: string; tasks: Task[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 py-1 px-1 rounded-lg hover:bg-accent/40 transition-colors w-full text-left group"
      >
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {formatUpcomingHeader(dateStr)}
        </span>
        <span className="text-xs text-muted-foreground/60 ml-1">({tasks.length})</span>
        <span className="ml-auto text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 pl-4">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

function formatWeekDayHeader(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  const dayName = d.toLocaleDateString("en-GB", { weekday: "long" });
  const formatted = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  if (d.getTime() === today.getTime()) {
    return `${formatted} · ${dayName} · Today`;
  }
  return `${formatted} · ${dayName}`;
}

function WeekDayGroup({ dateStr, tasks }: { dateStr: string; tasks: Task[] }) {
  const [open, setOpen] = useState(true);
  const _n = new Date();
  const isToday = dateStr === `${_n.getFullYear()}-${String(_n.getMonth() + 1).padStart(2, '0')}-${String(_n.getDate()).padStart(2, '0')}`;
  if (tasks.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 py-1 px-1 rounded-lg hover:bg-accent/40 transition-colors w-full text-left group"
      >
        {isToday && (
          <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
        )}
        <span
          className={`text-xs font-semibold uppercase tracking-wider ${
            isToday ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {formatWeekDayHeader(dateStr)}
        </span>
        <span className="text-xs text-muted-foreground/60 ml-1">({tasks.length})</span>
        <span className="ml-auto text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 pl-4">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

export const TaskList = () => {
  const {
    tasks: storeTasks,
    bulkComplete,
    bulkDelete,
    bulkSetPriority,
  } = useTasksStore();

  const {
    currentView,
    currentCategory,
    sortField,
    sortDir,
    selectedTasks,
    selectAll,
    clearSelection,
    setSortField,
    toggleSortDir,
    showNotification,
    openTaskModal,
    activeWorkspaceId,
    setView,
  } = useUIStore();

  const { user } = useAuthStore();
  const { workspaces } = useWorkspaceStore();

  // Active workspace name — used to scope tasks
  const activeWorkspaceName = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? null,
    [workspaces, activeWorkspaceId],
  );

  // Base task filter: only tasks belonging to the active workspace (or unassigned legacy tasks)
  const workspaceTasks = useMemo(
    () =>
      storeTasks.filter(
        (t) =>
          !t.workspace ||
          t.workspace === activeWorkspaceName ||
          !activeWorkspaceName,
      ),
    [storeTasks, activeWorkspaceName],
  );

  // Resolve tasks for current view — depends on `workspaceTasks` directly so it
  // re-derives immediately whenever the store mutates (no stale getter issue).
  const rawTasks = useMemo((): Task[] => {
    const _now = new Date();
    const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    switch (currentView) {
      case "today":
        return workspaceTasks.filter(
          (t) =>
            (t.status === "active" || t.status === "inProgress") &&
            !t.isTemplate &&
            t.dueDate === today,
        );
      case "completed":
        return workspaceTasks.filter((t) => t.status === "completed");
      case "thisWeek": {
        // Mon-Sun of current ISO week
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const mon = new Date(now);
        mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        const monStr = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`;
        const sunStr = `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, '0')}-${String(sun.getDate()).padStart(2, '0')}`;
        return workspaceTasks
          .filter((t) => {
            if ((t.status !== 'active' && t.status !== 'overdue') || t.isTemplate) return false;
            return !!t.dueDate && t.dueDate >= monStr && t.dueDate <= sunStr;
          })
          .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
      }
      case "overdue":
        return workspaceTasks.filter(
          (t) => t.status === "overdue" && !t.isTemplate,
        );
      case "calendar":
        return []; // CalendarView renders itself
      case "category":
        if (!currentCategory) return workspaceTasks.filter((t) => (t.status === "active" || t.status === "inProgress" || t.status === "overdue") && !t.isTemplate);
        if (currentCategory.startsWith("#")) {
          // Tag view: filter by tags array
          const tagName = currentCategory.slice(1);
          return workspaceTasks.filter(
            (t) =>
              (t.status === "active" || t.status === "inProgress" || t.status === "overdue") &&
              !t.isTemplate &&
              (t.tags ?? []).some((tag) => tag.trim() === tagName),
          );
        }
        return workspaceTasks.filter(
          (t) => (t.status === "active" || t.status === "inProgress" || t.status === "overdue") && !t.isTemplate && t.category === currentCategory,
        );
      default:
        return workspaceTasks.filter((t) => (t.status === "active" || t.status === "inProgress" || t.status === "overdue") && !t.isTemplate);
    }
  }, [workspaceTasks, currentView, currentCategory]);

  const tasks = useMemo(() => sortTasks(rawTasks, sortField, sortDir), [rawTasks, sortField, sortDir]);

  // Today: group by priority bucket
  const todayBuckets = useMemo(() => {
    if (currentView !== "today") return null;
    return PRIORITY_BUCKETS.map((b) => ({
      ...b,
      tasks: tasks.filter((t) => (t.priority ?? "medium") === b.key),
    }));
  }, [tasks, currentView]);

  // Overdue: group by priority bucket
  const overdueBuckets = useMemo(() => {
    if (currentView !== "overdue") return null;
    return PRIORITY_BUCKETS.map((b) => ({
      ...b,
      tasks: tasks.filter((t) => (t.priority ?? "medium") === b.key),
    }));
  }, [tasks, currentView]);

  // This Week: group by dueDate
  const thisWeekGroups = useMemo(() => {
    if (currentView !== "thisWeek") return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const mon = new Date(now);
    mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const dayMap = new Map<string, Task[]>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon.getTime() + i * 86400000);
      dayMap.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, []);
    }
    for (const t of tasks) {
      if (t.dueDate && dayMap.has(t.dueDate)) {
        dayMap.get(t.dueDate)!.push(t);
      }
    }
    return Array.from(dayMap.entries()).map(([date, dayTasks]) => ({ date, tasks: dayTasks }));
  }, [tasks, currentView]);

  // Overdue count — used for info bars in Today + This Week
  const overdueCount = useMemo(
    () => workspaceTasks.filter((t) => t.status === "overdue" && !t.isTemplate).length,
    [workspaceTasks],
  );

  const [overdueBannerDismissed, setOverdueBannerDismissed] = useLocalStorage(
    "doitly_overdue_banner_dismissed",
    false,
  );

  // Re-show the banner whenever new overdue tasks appear
  useEffect(() => {
    if (overdueCount > 0) setOverdueBannerDismissed(false);
  }, [overdueCount, setOverdueBannerDismissed]);

  const allIds = tasks.map((t) => t.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedTasks.has(id));
  const someSelected = selectedTasks.size > 0;

  const handleSelectAll = () => {
    if (allSelected) clearSelection();
    else selectAll(allIds);
  };

  const handleBulkComplete = async () => {
    const ids = [...selectedTasks];
    await bulkComplete(ids, user?.id);
    clearSelection();
    showNotification(`${ids.length} task${ids.length > 1 ? "s" : ""} completed`, "success");
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedTasks];
    await bulkDelete(ids, user?.id);
    clearSelection();
    showNotification(`${ids.length} task${ids.length > 1 ? "s" : ""} deleted`, "warning");
  };

  const handleBulkPriority = async (priority: Priority) => {
    const ids = [...selectedTasks];
    await bulkSetPriority(ids, priority, user?.id);
    clearSelection();
    showNotification(`Priority set to ${priority}`, "info");
  };

  // View label with date context
  const viewLabel = useMemo(() => {
    if (currentView === "category" && currentCategory) {
      return currentCategory.startsWith("#") ? currentCategory : currentCategory;
    }
    if (currentView === "all") return "All Tasks";
    if (currentView === "today") {
      const d = new Date();
      const dayLabel = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
      return `Today — ${dayLabel}`;
    }
    if (currentView === "thisWeek") {
      const weekStr = getISOWeekString(new Date());
      const weekNum = weekStr.split("-W")[1];
      // Mon–Sun range
      const now = new Date();
      now.setHours(0,0,0,0);
      const mon = new Date(now);
      mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      const rangeLabel = `${mon.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${sun.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
      return `This Week — W${weekNum} · ${rangeLabel}`;
    }
    if (currentView === "overdue") return "Overdue";
    if (currentView === "calendar") return "Calendar";
    return currentView.charAt(0).toUpperCase() + currentView.slice(1);
  }, [currentView, currentCategory]);

  return (
    <div className="flex flex-col gap-4 flex-1 min-w-0 pb-8">
      {/* Calendar view: full self-contained component */}
      {currentView === "calendar" ? (
        <CalendarView />
      ) : (
      <>
      {/* Top bar: title + sort */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-foreground">{viewLabel}</h2>
          {tasks.length > 0 && (
            <span className="text-sm text-muted-foreground">({tasks.length})</span>
          )}
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2">
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="text-xs px-2 pr-7 py-1.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring hover:cursor-pointer transition-colors"
          >
            {(Object.keys(SORT_LABELS) as SortField[]).map((f) => (
              <option key={f} value={f}>
                {SORT_LABELS[f]}
              </option>
            ))}
          </select>
          <button
            onClick={toggleSortDir}
            className="p-1.5 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent transition-colors hover:cursor-pointer"
            title={sortDir === "asc" ? "Ascending" : "Descending"}
          >
            {sortDir === "asc" ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9M3 12h5m10 0l-4-4m4 4l-4 4" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9M3 12h5m10 4l-4-4m4 4l-4 4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Overdue info bar — shown in Today and This Week */}
      {(currentView === "today" || currentView === "thisWeek") && overdueCount > 0 && !overdueBannerDismissed && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-sm">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-red-600 dark:text-red-400 font-medium flex-1">
            {overdueCount} task{overdueCount !== 1 ? "s" : ""} became overdue and weren't completed.
          </span>
          <button
            onClick={() => setView("overdue" as View)}
            className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline flex-shrink-0 hover:cursor-pointer"
          >
            View →
          </button>
          <button
            onClick={() => setOverdueBannerDismissed(true)}
            className="p-0.5 rounded text-red-400 hover:text-red-600 hover:bg-red-500/20 transition-colors flex-shrink-0 hover:cursor-pointer"
            aria-label="Dismiss overdue notice"
            title="Dismiss"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Overdue view motivational header */}
      {currentView === "overdue" && tasks.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm">
          <span className="text-amber-700 dark:text-amber-300 font-medium">
            These tasks slipped through. No worries - tackle them now or reschedule!
          </span>
        </div>
      )}

      {/* Bulk actions bar */}
      {someSelected && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-primary/30 bg-primary/5 flex-wrap">
          <span className="text-sm font-medium text-primary">
            {selectedTasks.size} selected
          </span>
          <div className="flex-1" />

          <button
            onClick={handleBulkComplete}
            className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium transition-colors"
          >
            Complete
          </button>

          {/* Priority dropdown */}
          <div className="relative">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkPriority(e.target.value as Priority);
                  e.target.value = "";
                }
              }}
              defaultValue=""
              className="text-xs px-3 pr-8 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium transition-colors cursor-pointer"
            >
              <option value="" disabled>
                Set Priority
              </option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <button
            onClick={handleBulkDelete}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium transition-colors"
          >
            Delete
          </button>

          <button
            onClick={clearSelection}
            className="text-xs px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-accent font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Select all row (only when tasks exist) */}
      {tasks.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={handleSelectAll}
            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0
              ${allSelected ? "bg-primary border-primary" : "border-muted-foreground/40 hover:border-primary"}`}
            aria-label="Select all"
          >
            {allSelected && (
              <svg className="w-2.5 h-2.5 text-primary-foreground" fill="currentColor" viewBox="0 0 12 12">
                <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          <span className="text-xs text-muted-foreground">
            {allSelected ? "Deselect all" : "Select all"}
          </span>
        </div>
      )}

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg className="w-12 h-12 text-muted-foreground/30 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-muted-foreground font-medium">
            {currentView === "overdue" ? "No overdue tasks!" : "No tasks here"}
          </p>
          {currentView === "all" && (
            <button
              onClick={() => openTaskModal()}
              className="mt-3 text-sm text-primary hover:underline hover:cursor-pointer"
            >
              + Add your first task
            </button>
          )}
        </div>
      ) : currentView === "today" && todayBuckets ? (
        // ── Today: priority accordions ─────────────────────────────────────
        <div className="flex flex-col gap-4">
          {todayBuckets.map((b) => (
            <PriorityAccordion key={b.key} bucket={b} tasks={b.tasks} />
          ))}
          {todayBuckets.every((b) => b.tasks.length === 0) && (
            <p className="text-muted-foreground text-sm text-center py-4">No tasks for today</p>
          )}
        </div>
      ) : currentView === "overdue" && overdueBuckets ? (
        // ── Overdue: priority accordions ──────────────────────────────────
        <div className="flex flex-col gap-4">
          {overdueBuckets.map((b) => (
            <PriorityAccordion key={b.key} bucket={b} tasks={b.tasks} />
          ))}
        </div>
      ) : currentView === "thisWeek" && thisWeekGroups ? (
        // ── This Week: day-grouped ─────────────────────────────────────────
        <div className="flex flex-col gap-4">
          {thisWeekGroups.map((g) => (
            <WeekDayGroup key={g.date} dateStr={g.date} tasks={g.tasks} />
          ))}
          {thisWeekGroups.every((g) => g.tasks.length === 0) && (
            <p className="text-muted-foreground text-sm text-center py-4">No tasks planned for this week</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </div>
      )}
      </>
      )}
    </div>
  );
};
