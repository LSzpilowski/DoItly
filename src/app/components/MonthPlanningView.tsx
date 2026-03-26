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
import { useTasksStore, type Task } from "@/store/tasksStore";
import { useUIStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { Priority } from "@/store/types";

// ─── Date helpers ─────────────────────────────────────────────────────────────
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMonthGrid(year: number, month: number): (string | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7; // Monday-based (0=Mon)
  const totalDays = lastDay.getDate();

  const cells: (string | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => {
      return localDateStr(new Date(year, month, i + 1));
    }),
  ];
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);
  // split into rows
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function todayStr() {
  return localDateStr(new Date());
}

// ─── Draggable chip (placed on calendar day — supports inter-day moves) ───────
const DraggableChip = ({
  task,
  onRemove,
}: {
  task: Task;
  onRemove?: () => void;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`group flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium overflow-hidden cursor-grab active:cursor-grabbing touch-none select-none border border-primary/20 transition-opacity ${
        isDragging ? "opacity-30" : ""
      }`}
    >
      {task.priority && (
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            task.priority === "high" ? "bg-red-500" : task.priority === "medium" ? "bg-amber-500" : "bg-green-500"
          }`}
        />
      )}
      <span className="truncate flex-1">{task.title ?? task.text}</span>
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 flex-shrink-0 hover:text-destructive transition-all"
          aria-label="Remove"
        >
          ×
        </button>
      )}
    </div>
  );
};

// ─── Draggable pool card (full TaskCard style — matches Day/Week) ─────────────
const DraggablePoolCard = ({ task }: { task: Task }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const label = task.title ?? task.text;
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="cursor-grab active:cursor-grabbing touch-none select-none"
    >
      <div
        className={`group flex items-start justify-between gap-2 px-3 py-2.5 rounded-xl border bg-card transition-all ${
          isDragging ? "opacity-50 shadow-lg border-primary/40" : "border-border hover:border-border/80 hover:shadow-sm"
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
            {task.dueDate && (
              <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                Overdue
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Priority pool box ───────────────────────────────────────────────────────
interface PriorityPoolBoxProps {
  title: string;
  tasks: Task[];
  accentClass: string;
  dotClass: string;
}

const PriorityPoolBox = ({ title, tasks, accentClass, dotClass }: PriorityPoolBoxProps) => (
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
        tasks.map((t) => <DraggablePoolCard key={t.id} task={t} />)
      )}
    </div>
  </div>
);

// ─── Droppable calendar cell ──────────────────────────────────────────────────
interface CalendarCellProps {
  dateStr: string;
  dayNum: number;
  isToday: boolean;
  tasks: Task[];
  onRemove: (id: string) => void;
}

const CalendarCell = ({ dateStr, dayNum, isToday, tasks, onRemove }: CalendarCellProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: `month-day-${dateStr}` });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[80px] p-1.5 rounded-xl border-2 flex flex-col gap-1 transition-colors ${
        isOver
          ? "border-primary/60 bg-primary/5"
          : isToday
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card/40"
      }`}
    >
      <span
        className={`text-xs font-semibold leading-none ${
          isToday
            ? "w-5 h-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground"
            : "text-muted-foreground"
        }`}
      >
        {dayNum}
      </span>
      <div className="flex flex-col gap-0.5 overflow-hidden">
        {tasks.slice(0, 3).map((t) => (
          <DraggableChip key={t.id} task={t} onRemove={() => onRemove(t.id)} />
        ))}
        {tasks.length > 3 && (
          <span className="text-[10px] text-muted-foreground pl-1">+{tasks.length - 3} more</span>
        )}
      </div>
    </div>
  );
};

// ─── MonthPlanningView ────────────────────────────────────────────────────────
export const MonthPlanningView = () => {
  const { tasks: allTasks, updateTaskRich } = useTasksStore();
  const { activeWorkspaceId } = useUIStore();
  const { workspaces } = useWorkspaceStore();
  const [activeId, setActiveId] = useState<string | null>(null);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 8 } })
  );

  const monthGrid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const today = todayStr();

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  const activeWorkspaceName = workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? null;
  const tasks = useMemo(
    () => allTasks.filter((t) => !t.workspace || t.workspace === activeWorkspaceName || !activeWorkspaceName),
    [allTasks, activeWorkspaceName],
  );
  const activeTasks = useMemo(
    () => tasks.filter((t) => (t.status === "active" || t.status === "inProgress" || t.status === "overdue") && !t.isTemplate),
    [tasks]
  );

  // All date strings in this month
  const monthDateStrs = useMemo(
    () => monthGrid.flat().filter(Boolean) as string[],
    [monthGrid]
  );

  // Pool: only tasks without a dueDate — so users can plan/schedule them
  const pool = useMemo(
    () => activeTasks.filter((t) => !t.dueDate),
    [activeTasks]
  );

  // Priority buckets for the pool panel
  const buckets = useMemo(() => {
    const sortByDue = (arr: Task[]) =>
      [...arr].sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    return {
      high:   sortByDue(pool.filter((t) => t.priority === "high"   as Priority)),
      medium: sortByDue(pool.filter((t) => t.priority === "medium" as Priority)),
      low:    sortByDue(pool.filter((t) => t.priority === "low"    as Priority)),
      none:   sortByDue(pool.filter((t) => !t.priority)),
    };
  }, [pool]);

  // Tasks per date — driven by dueDate (single source of truth)
  const dayTasksMap = useMemo(() => {
    const map: Record<string, Task[]> = {};
    monthDateStrs.forEach((dateStr) => {
      map[dateStr] = activeTasks.filter((t) => t.dueDate === dateStr);
    });
    return map;
  }, [activeTasks, monthDateStrs]);

  const activeTask = useMemo(
    () => activeTasks.find((t) => t.id === activeId) ?? null,
    [activeTasks, activeId]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const overId = String(over.id);
    if (overId.startsWith("month-day-")) {
      const dateStr = overId.replace("month-day-", "");
      const task = activeTasks.find((t) => t.id === active.id);
      if (!task || task.dueDate === dateStr) return;
      // Assign to this date
      updateTaskRich(active.id as string, { dueDate: dateStr }, task.userId);
    }
    // Optionally, handle removing from a day (drag to pool panel)
    // Could implement if pool panel is droppable, but for now, removal is via onRemove in CalendarCell
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
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">Let's plan the month!</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Drag tasks onto calendar dates to schedule them.
            </p>
          </div>
          {/* Month navigator */}
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-foreground min-w-[120px] text-center">{monthLabel}</span>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {/* Day-of-week header */}
          <div className="grid grid-cols-7 border-b border-border">
            {DOW_LABELS.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
            ))}
          </div>
          {/* Weeks */}
          {monthGrid.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-px">
              {week.map((dateStr, di) =>
                dateStr ? (
                  <CalendarCell
                    key={dateStr}
                    dateStr={dateStr}
                    dayNum={parseInt(dateStr.split("-")[2], 10)}
                    isToday={dateStr === today}
                    tasks={dayTasksMap[dateStr] ?? []}
                    onRemove={(id) => {
                      const task = activeTasks.find((t) => t.id === id);
                      updateTaskRich(id, { dueDate: undefined }, task?.userId);
                    }}
                  />
                ) : (
                  <div key={`empty-${wi}-${di}`} className="min-h-[80px] bg-border rounded-xl border-2" />
                )
              )}
            </div>
          ))}
        </div>

        {/* Priority pool — drag tasks onto calendar dates */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            All active tasks — drag to add to a date
          </h2>
          {/* Mobile carousel */}
          <div className="flex sm:hidden gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-none">
            {buckets.high.length > 0 && <div className="flex-shrink-0 w-[85vw] snap-start"><PriorityPoolBox title="Must have"    tasks={buckets.high}   accentClass="text-red-600 dark:text-red-400"    dotClass="bg-red-500" /></div>}
            {buckets.medium.length > 0 && <div className="flex-shrink-0 w-[85vw] snap-start"><PriorityPoolBox title="Should have"  tasks={buckets.medium} accentClass="text-amber-600 dark:text-amber-400" dotClass="bg-amber-500" /></div>}
            {buckets.low.length > 0 && <div className="flex-shrink-0 w-[85vw] snap-start"><PriorityPoolBox title="Nice to have" tasks={buckets.low}    accentClass="text-green-600 dark:text-green-400" dotClass="bg-green-500" /></div>}
            {buckets.none.length > 0 && <div className="flex-shrink-0 w-[85vw] snap-start"><PriorityPoolBox title="No Priority"  tasks={buckets.none}   accentClass="text-muted-foreground"              dotClass="bg-muted-foreground/40" /></div>}
            {buckets.high.length === 0 && buckets.medium.length === 0 && buckets.low.length === 0 && buckets.none.length === 0 && (
              <div className="w-full text-center py-6 text-sm text-muted-foreground/60">No active tasks</div>
            )}
          </div>
          {/* Desktop grid */}
          <div className="hidden sm:grid sm:grid-cols-3 gap-4">
            {buckets.high.length > 0 && (
              <PriorityPoolBox
                title="Must have"
                tasks={buckets.high}
                accentClass="text-red-600 dark:text-red-400"
                dotClass="bg-red-500"
              />
            )}
            {buckets.medium.length > 0 && (
              <PriorityPoolBox
                title="Should have"
                tasks={buckets.medium}
                accentClass="text-amber-600 dark:text-amber-400"
                dotClass="bg-amber-500"
              />
            )}
            {buckets.low.length > 0 && (
              <PriorityPoolBox
                title="Nice to have"
                tasks={buckets.low}
                accentClass="text-green-600 dark:text-green-400"
                dotClass="bg-green-500"
              />
            )}
            {buckets.none.length > 0 && (
              <PriorityPoolBox
                title="No Priority"
                tasks={buckets.none}
                accentClass="text-muted-foreground"
                dotClass="bg-muted-foreground/40"
              />
            )}
            {buckets.high.length === 0 && buckets.medium.length === 0 && buckets.low.length === 0 && buckets.none.length === 0 && (
              <div className="sm:col-span-3 text-center py-6 text-sm text-muted-foreground/60">
                No active tasks
              </div>
            )}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="px-3 py-2 rounded-xl border bg-card shadow-xl text-sm font-medium text-foreground">
            {activeTask.title ?? activeTask.text}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};
