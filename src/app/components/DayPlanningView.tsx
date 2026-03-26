import { useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useTasksStore, type Task } from "@/store/tasksStore";
import { useUIStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { Priority } from "@/store/types";
import { useState } from "react";

// ─── helpers ──────────────────────────────────────────────────────────────────
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayStr() {
  return localDateStr(TODAY);
}

function isOverdue(dateStr: string): boolean {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d < TODAY;
}

function dueDateLabel(dateStr?: string): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() === TODAY.getTime()) return "Today";
  const diff = Math.round((d.getTime() - TODAY.getTime()) / 86400000);
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sortByDueDate(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
}

// ─── DraggableTaskCard ────────────────────────────────────────────────────────
interface TaskCardProps {
  task: Task;
  dragging?: boolean;
  onRemove?: () => void;
  showRemove?: boolean;
}

const TaskCard = ({ task, dragging, onRemove, showRemove }: TaskCardProps) => {
  const label = task.title ?? task.text;
  const due = dueDateLabel(task.dueDate);
  const overdue = task.dueDate ? isOverdue(task.dueDate) : false;

  return (
    <div
      className={`group flex items-start justify-between gap-2 px-3 py-2.5 rounded-xl border bg-card transition-all ${
        dragging
          ? "opacity-50 shadow-lg border-primary/40"
          : "border-border hover:border-border/80 hover:shadow-sm"
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{label}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {task.category && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-accent text-muted-foreground font-medium">
              {task.category}
            </span>
          )}
          {due && (
            <span
              className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
                overdue
                  ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                  : due === "Today"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {due}
            </span>
          )}
        </div>
      </div>
      {showRemove && onRemove && (
        <button
          onClick={onRemove}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all cursor-pointer opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
          aria-label="Remove from today"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

const DraggableTaskCard = ({ task }: { task: Task }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="cursor-grab active:cursor-grabbing touch-none select-none"
    >
      <TaskCard task={task} dragging={isDragging} />
    </div>
  );
};

// ─── DroppableTodayBox ────────────────────────────────────────────────────────
interface TodayBoxProps {
  tasks: Task[];
  onRemove: (id: string) => void;
}

const TodayBox = ({ tasks, onRemove }: TodayBoxProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: "today-box" });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border-2 transition-colors min-h-[140px] flex flex-col ${
        isOver
          ? "border-primary/60 bg-primary/5"
          : "border-border bg-card"
      }`}
    >
      <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
        <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="text-sm font-bold text-foreground">To do today</h2>
        {tasks.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">{tasks.length} task{tasks.length !== 1 ? "s" : ""}</span>
        )}
      </div>
      <div className="flex-1 p-3 space-y-2">
        {tasks.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-6 text-center transition-colors ${isOver ? "text-primary" : "text-muted-foreground/50"}`}>
            <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <p className="text-xs">Drag tasks here to plan your day</p>
          </div>
        ) : (
          tasks.map((t) => (
            <TaskCard key={t.id} task={t} showRemove onRemove={() => onRemove(t.id)} />
          ))
        )}
      </div>
    </div>
  );
};

// ─── PriorityBox ──────────────────────────────────────────────────────────────
interface PriorityBoxProps {
  title: string;
  tasks: Task[];
  accentClass: string;
  dotClass: string;
}

const PriorityBox = ({ title, tasks, accentClass, dotClass }: PriorityBoxProps) => (
  <div className="rounded-2xl border border-border bg-card flex flex-col min-h-[180px]">
    <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClass}`} />
      <h3 className={`text-sm font-bold ${accentClass}`}>{title}</h3>
      <span className="ml-auto text-xs text-muted-foreground">{tasks.length}</span>
    </div>
    <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-80">
      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground/50 py-4 text-center">No tasks</p>
      ) : (
        tasks.map((t) => <DraggableTaskCard key={t.id} task={t} />)
      )}
    </div>
  </div>
);

// ─── DayPlanningView ─────────────────────────────────────────────────────────
export const DayPlanningView = () => {
  const { tasks: allTasks, updateTaskRich } = useTasksStore();
  const { activeWorkspaceId } = useUIStore();
  const { workspaces } = useWorkspaceStore();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 8 } })
  );

  // Scope to active workspace
  const activeWorkspaceName = workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? null;
  const tasks = useMemo(
    () => allTasks.filter((t) => !t.workspace || t.workspace === activeWorkspaceName || !activeWorkspaceName),
    [allTasks, activeWorkspaceName],
  );

  // Active tasks only (not completed/deleted/archived/template)
  const activeTasks = useMemo(
    () => tasks.filter((t) => (t.status === "active" || t.status === "inProgress" || t.status === "overdue") && !t.isTemplate),
    [tasks]
  );

  // "To do today" = all tasks with dueDate set to today (single source of truth)
  // Includes overdue tasks with dueDate === today (per test expectations)
  const todayTasks = useMemo(
    () =>
      activeTasks.filter(
        (t) => t.dueDate === todayStr()
      ),
    [activeTasks]
  );

  // Pool: only tasks without a dueDate OR overdue (so users can plan/reschedule them)
  // Do NOT exclude tasks scheduled for today or any other date; only dueDate presence matters
  const pool = useMemo(
    () => activeTasks.filter((t) => !t.dueDate || t.status === "overdue"),
    [activeTasks]
  );
  const buckets = useMemo(() => ({
    high:   sortByDueDate(pool.filter((t) => t.priority === "high")),
    medium: sortByDueDate(pool.filter((t) => t.priority === "medium")),
    low:    sortByDueDate(pool.filter((t) => t.priority === "low")),
    none:   sortByDueDate(pool.filter((t) => !t.priority)),
  }), [pool]);

  const activeTask = useMemo(
    () => activeTasks.find((t) => t.id === activeId) ?? null,
    [activeTasks, activeId]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (over?.id === "today-box") {
      const task = activeTasks.find((t) => t.id === active.id);
      // dueDate=today is the single source of truth — this makes the task
      // appear in Today view, Planner→Day, Week, Calendar, and MyFlow.
      updateTaskRich(active.id as string, { dueDate: todayStr() }, task?.userId);
    }
  };

  const handleRemoveFromToday = (id: string) => {
    const task = activeTasks.find((t) => t.id === id);
    // Setting dueDate to undefined removes it from all views (single source of truth).
    updateTaskRich(id, { dueDate: undefined }, task?.userId);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setActiveId(e.active.id as string)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="space-y-6">
        {/* Title */}
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Let's plan my day!</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · Drag tasks into <span className="font-medium text-foreground">To do today</span> to build your focus list.
            </p>
          </div>
        </div>

        {/* Row 1: To do today */}
        <TodayBox tasks={todayTasks} onRemove={handleRemoveFromToday} />

        {/* Row 2: Priority buckets — mobile carousel, desktop grid */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            All active tasks — drag to add to today
          </h2>
          {/* Mobile carousel */}
          <div className="flex sm:hidden gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-none">
            {buckets.high.length > 0 && (
              <div className="flex-shrink-0 w-[85vw] snap-start">
                <PriorityBox title="Must have" tasks={buckets.high} accentClass="text-red-600 dark:text-red-400" dotClass="bg-red-500" />
              </div>
            )}
            {buckets.medium.length > 0 && (
              <div className="flex-shrink-0 w-[85vw] snap-start">
                <PriorityBox title="Should have" tasks={buckets.medium} accentClass="text-amber-600 dark:text-amber-400" dotClass="bg-amber-500" />
              </div>
            )}
            {buckets.low.length > 0 && (
              <div className="flex-shrink-0 w-[85vw] snap-start">
                <PriorityBox title="Nice to have" tasks={buckets.low} accentClass="text-green-600 dark:text-green-400" dotClass="bg-green-500" />
              </div>
            )}
            {buckets.none.length > 0 && (
              <div className="flex-shrink-0 w-[85vw] snap-start">
                <PriorityBox title="No Priority" tasks={buckets.none} accentClass="text-muted-foreground" dotClass="bg-muted-foreground/40" />
              </div>
            )}
            {buckets.high.length === 0 && buckets.medium.length === 0 && buckets.low.length === 0 && buckets.none.length === 0 && (
              <div className="w-full text-center py-6 text-sm text-muted-foreground/60">
                All tasks are planned for today
              </div>
            )}
          </div>
          {/* Desktop grid */}
          <div className="hidden sm:grid sm:grid-cols-3 gap-4">
            {buckets.high.length > 0 && (
              <PriorityBox
                title="Must have"
                tasks={buckets.high}
                accentClass="text-red-600 dark:text-red-400"
                dotClass="bg-red-500"
              />
            )}
            {buckets.medium.length > 0 && (
              <PriorityBox
                title="Should have"
                tasks={buckets.medium}
                accentClass="text-amber-600 dark:text-amber-400"
                dotClass="bg-amber-500"
              />
            )}
            {buckets.low.length > 0 && (
              <PriorityBox
                title="Nice to have"
                tasks={buckets.low}
                accentClass="text-green-600 dark:text-green-400"
                dotClass="bg-green-500"
              />
            )}
            {buckets.none.length > 0 && (
              <PriorityBox
                title="No Priority"
                tasks={buckets.none}
                accentClass="text-muted-foreground"
                dotClass="bg-muted-foreground/40"
              />
            )}
            {buckets.high.length === 0 && buckets.medium.length === 0 && buckets.low.length === 0 && buckets.none.length === 0 && (
              <div className="sm:col-span-3 text-center py-6 text-sm text-muted-foreground/60">
                All tasks are planned for today
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeTask && <TaskCard task={activeTask} />}
      </DragOverlay>
    </DndContext>
  );
};
