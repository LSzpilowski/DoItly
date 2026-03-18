import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useTasksStore, type Task } from "@/store/tasksStore";
import { useUIStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

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

// ─── Mini chip ────────────────────────────────────────────────────────────────
const Chip = ({
  task,
  onRemove,
}: {
  task: Task;
  onRemove?: () => void;
}) => (
  <div className="group flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium overflow-hidden">
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
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 flex-shrink-0 hover:text-destructive transition-all"
        aria-label="Remove"
      >
        ×
      </button>
    )}
  </div>
);

// ─── Draggable pool card ──────────────────────────────────────────────────────
const DraggablePoolCard = ({ task }: { task: Task }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing">
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border bg-card text-sm transition-all ${
          isDragging ? "opacity-40 border-primary/40 shadow-lg" : "border-border hover:border-border/80"
        }`}
      >
        {task.priority && (
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              task.priority === "high" ? "bg-red-500" : task.priority === "medium" ? "bg-amber-500" : "bg-green-500"
            }`}
          />
        )}
        <span className="flex-1 truncate font-medium text-foreground">{task.title ?? task.text}</span>
        {task.category && (
          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-accent text-muted-foreground">{task.category}</span>
        )}
      </div>
    </div>
  );
};

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
          <Chip key={t.id} task={t} onRemove={() => onRemove(t.id)} />
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
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
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
    () => tasks.filter((t) => (t.status === "active" || t.status === "inProgress") && !t.isTemplate),
    [tasks]
  );

  // All date strings in this month
  const monthDateStrs = useMemo(
    () => monthGrid.flat().filter(Boolean) as string[],
    [monthGrid]
  );

  // Tasks per date — driven by dueDate (single source of truth)
  const dayTasksMap = useMemo(() => {
    const map: Record<string, Task[]> = {};
    monthDateStrs.forEach((dateStr) => {
      map[dateStr] = activeTasks.filter((t) => t.dueDate === dateStr);
    });
    return map;
  }, [activeTasks, monthDateStrs]);

  // Unplanned tasks (no dueDate, or dueDate not in this month)
  const plannedInMonthIds = useMemo(() => {
    const ids = new Set<string>();
    monthDateStrs.forEach((dateStr) => {
      activeTasks.forEach((t) => { if (t.dueDate === dateStr) ids.add(t.id); });
    });
    return ids;
  }, [activeTasks, monthDateStrs]);

  const unplanned = useMemo(
    () => activeTasks.filter((t) => !plannedInMonthIds.has(t.id)),
    [activeTasks, plannedInMonthIds]
  );

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
      // dueDate is the single source of truth.
      updateTaskRich(active.id as string, { dueDate: dateStr }, task.userId);
    }
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
            <div key={wi} className="grid grid-cols-7 gap-px bg-border">
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
                  <div key={`empty-${wi}-${di}`} className="min-h-[80px] bg-muted/20" />
                )
              )}
            </div>
          ))}
        </div>

        {/* Unplanned pool */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Unplanned tasks — drag to a date
            </h2>
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{unplanned.length}</span>
          </div>
          {unplanned.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground/50 text-sm">
              All active tasks are planned for this month!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {unplanned.map((t) => (
                <DraggablePoolCard key={t.id} task={t} />
              ))}
            </div>
          )}
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
