import { useMemo, useState } from "react";
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
import { useTasksStore, getISOWeekString, type Task } from "@/store/tasksStore";
import { useUIStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

// ─── Date helpers ─────────────────────────────────────────────────────────────
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getWeekDays(): { dateStr: string; label: string; shortLabel: string; isToday: boolean }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Monday of current week
  const mon = new Date(today);
  const day = mon.getDay(); // 0=Sun, 1=Mon…
  mon.setDate(mon.getDate() - ((day + 6) % 7));

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const dateStr = localDateStr(d);
    const isToday = d.getTime() === today.getTime();
    return {
      dateStr,
      label: d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
      shortLabel: d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" }),
      isToday,
    };
  });
}

// ─── Shared mini task card ────────────────────────────────────────────────────
interface MiniCardProps {
  task: Task;
  dragging?: boolean;
  onRemove?: () => void;
}

const MiniCard = ({ task, dragging, onRemove }: MiniCardProps) => (
  <div
    className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg border bg-card text-xs transition-all ${
      dragging ? "opacity-40 shadow-lg border-primary/40" : "border-border hover:border-border/80"
    }`}
  >
    {task.priority && (
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          task.priority === "high" ? "bg-red-500" : task.priority === "medium" ? "bg-amber-500" : "bg-green-500"
        }`}
      />
    )}
    <span className="truncate text-foreground font-medium flex-1">{task.title ?? task.text}</span>
    {onRemove && (
      <button
        onClick={onRemove}
        className="flex-shrink-0 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all cursor-pointer opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
        aria-label="Remove"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    )}
  </div>
);

const DraggableMiniCard = ({ task, onRemove }: { task: Task; onRemove?: () => void }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing touch-none select-none">
      <MiniCard task={task} dragging={isDragging} onRemove={onRemove} />
    </div>
  );
};

// ─── Day column (droppable) ───────────────────────────────────────────────────
interface DayColumnProps {
  dateStr: string;
  shortLabel: string;
  isToday: boolean;
  tasks: Task[];
  onRemove: (id: string) => void;
}

const DayColumn = ({ dateStr, shortLabel, isToday, tasks, onRemove }: DayColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: `week-day-${dateStr}` });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-2xl border-2 min-h-[180px] transition-colors ${
        isOver
          ? "border-primary/60 bg-primary/5"
          : isToday
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-card"
      }`}
    >
      <div className={`px-3 py-2 border-b text-center flex-shrink-0 ${isToday ? "border-primary/30" : "border-border/60"}`}>
        <p className={`text-xs font-bold ${isToday ? "text-primary" : "text-foreground"}`}>{shortLabel}</p>
        {isToday && <span className="text-[10px] text-primary">Today</span>}
      </div>
      <div className="flex-1 p-2 space-y-1 overflow-y-auto max-h-60">
        {tasks.length === 0 ? (
          <div className={`flex items-center justify-center h-full min-h-[80px] transition-colors ${isOver ? "text-primary" : "text-muted-foreground/30"}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
          </div>
        ) : (
          tasks.map((t) => (
            <DraggableMiniCard key={t.id} task={t} onRemove={() => onRemove(t.id)} />
          ))
        )}
      </div>
      {tasks.length > 0 && (
        <div className="px-3 py-1.5 border-t border-border/40 text-[10px] text-muted-foreground text-center">
          {tasks.length} task{tasks.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
};

// ─── Bottom pool card (draggable, shows priority) ─────────────────────────────
interface PoolBoxProps {
  title: string;
  tasks: Task[];
  accentClass: string;
  dotClass: string;
}
const PoolBox = ({ title, tasks, accentClass, dotClass }: PoolBoxProps) => (
  <div className="rounded-2xl border border-border bg-card flex flex-col min-h-[160px]">
    <div className="px-4 py-2.5 border-b border-border/60 flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
      <h3 className={`text-xs font-bold ${accentClass}`}>{title}</h3>
      <span className="ml-auto text-xs text-muted-foreground">{tasks.length}</span>
    </div>
    <div className="flex-1 p-3 space-y-1.5 overflow-y-auto max-h-52">
      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground/50 py-3 text-center">No tasks</p>
      ) : (
        tasks.map((t) => <DraggableMiniCard key={t.id} task={t} />)
      )}
    </div>
  </div>
);

// ─── WeekPlanningView ─────────────────────────────────────────────────────────
export const WeekPlanningView = () => {
  const { tasks: allTasks, updateTaskRich } = useTasksStore();
  const { activeWorkspaceId } = useUIStore();
  const { workspaces } = useWorkspaceStore();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 8 } })
  );

  const weekDays = useMemo(() => getWeekDays(), []);
  const weekDateStrs = useMemo(() => weekDays.map((d) => d.dateStr), [weekDays]);
  // First and last date of the current week (for range checks)
  const weekStart = weekDays[0]?.dateStr ?? "";
  const weekEnd   = weekDays[6]?.dateStr ?? "";

  const activeWorkspaceName = workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? null;
  const tasks = useMemo(
    () => allTasks.filter((t) => !t.workspace || t.workspace === activeWorkspaceName || !activeWorkspaceName),
    [allTasks, activeWorkspaceName],
  );

  const activeTasks = useMemo(
    () => tasks.filter((t) => (t.status === "active" || t.status === "inProgress") && !t.isTemplate),
    [tasks]
  );

  // ── Source of truth: dueDate within this week ─────────────────────────────
  // A task belongs to a day column if and only if its dueDate matches that day.
  const dayTasksMap = useMemo(() => {
    const map: Record<string, Task[]> = {};
    weekDateStrs.forEach((dateStr) => { map[dateStr] = []; });
    for (const t of activeTasks) {
      if (t.dueDate && t.dueDate >= weekStart && t.dueDate <= weekEnd) {
        map[t.dueDate]?.push(t);
      }
    }
    return map;
  }, [activeTasks, weekDateStrs, weekStart, weekEnd]);

  // Planned IDs = any task that appears in a day column
  const plannedThisWeekIds = useMemo(() => {
    const ids = new Set<string>();
    weekDateStrs.forEach((dateStr) => {
      dayTasksMap[dateStr]?.forEach((t) => ids.add(t.id));
    });
    return ids;
  }, [dayTasksMap, weekDateStrs]);

  const unplanned = useMemo(
    () => activeTasks.filter((t) => !plannedThisWeekIds.has(t.id)),
    [activeTasks, plannedThisWeekIds]
  );

  const buckets = useMemo(() => ({
    high:   unplanned.filter((t) => t.priority === "high"),
    medium: unplanned.filter((t) => t.priority === "medium"),
    low:    unplanned.filter((t) => t.priority === "low"),
    none:   unplanned.filter((t) => !t.priority),
  }), [unplanned]);

  const activeTask = useMemo(
    () => activeTasks.find((t) => t.id === activeId) ?? null,
    [activeTasks, activeId]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const overId = String(over.id);
    if (overId.startsWith("week-day-")) {
      const toDateStr = overId.replace("week-day-", "");
      const task = activeTasks.find((t) => t.id === active.id);
      if (!task) return;
      if (task.dueDate === toDateStr) return; // dropped on same day — no-op
      // dueDate is the single source of truth: one write updates all views.
      updateTaskRich(active.id as string, { dueDate: toDateStr }, task.userId);
    }
  };

  const handleRemoveFromDay = (taskId: string, _dateStr: string) => {
    const task = activeTasks.find((t) => t.id === taskId);
    // Setting dueDate to undefined removes it from all views (single source of truth).
    updateTaskRich(taskId, { dueDate: undefined }, task?.userId);
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
        <div>
          <h1 className="text-2xl font-bold text-foreground">Let's plan the week!</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {(() => {
              const weekStr = getISOWeekString(new Date());
              const weekNum = weekStr.split("-W")[1];
              const days = weekDays;
              const mon = days[0]?.dateStr ? new Date(days[0].dateStr + "T12:00:00") : new Date();
              const sun = days[6]?.dateStr ? new Date(days[6].dateStr + "T12:00:00") : new Date();
              const range = `${mon.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${sun.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
              return `Week ${weekNum} · ${range}`;
            })()}
          </p>
        </div>

        {/* 7-column day grid — carousel on mobile (2 columns visible at a time), grid on desktop */}
        <div className="sm:grid sm:grid-cols-4 lg:grid-cols-7 sm:gap-3 flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin snap-x snap-mandatory">
          {weekDays.map(({ dateStr, shortLabel, isToday }) => (
            <div key={dateStr} className="flex-shrink-0 w-[48%] sm:w-auto snap-start">
              <DayColumn
                dateStr={dateStr}
                shortLabel={shortLabel}
                isToday={isToday}
                tasks={dayTasksMap[dateStr] ?? []}
                onRemove={(id) => handleRemoveFromDay(id, dateStr)}
              />
            </div>
          ))}
        </div>

        {/* Unplanned pool — hide empty boxes */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Unplanned tasks — drag to a day
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {buckets.high.length > 0 && <PoolBox title="Must have"    tasks={buckets.high}   accentClass="text-red-600 dark:text-red-400"    dotClass="bg-red-500" />}
            {buckets.medium.length > 0 && <PoolBox title="Should have"  tasks={buckets.medium} accentClass="text-amber-600 dark:text-amber-400" dotClass="bg-amber-500" />}
            {buckets.low.length > 0 && <PoolBox title="Nice to have" tasks={buckets.low}    accentClass="text-green-600 dark:text-green-400" dotClass="bg-green-500" />}
            {buckets.none.length > 0 && <PoolBox title="No Priority"  tasks={buckets.none}   accentClass="text-muted-foreground"              dotClass="bg-muted-foreground/40" />}
            {buckets.high.length === 0 && buckets.medium.length === 0 && buckets.low.length === 0 && buckets.none.length === 0 && (
              <div className="sm:col-span-2 lg:col-span-4 text-center py-6 text-sm text-muted-foreground/60">
                All tasks are assigned to days
              </div>
            )}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeTask && <MiniCard task={activeTask} />}
      </DragOverlay>
    </DndContext>
  );
};
