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
import type { Category } from "@/store/types";

// ─── Date helpers ─────────────────────────────────────────────────────────────
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Returns all dates within `dateStrs` on which a repeating task appears. */
function repeatDatesInMonth(
  task: { dueDate?: string; repeat?: string },
  monthDateStrs: string[],
): string[] {
  if (!task.dueDate || !task.repeat || task.repeat === "none") return [];
  const origin = new Date(task.dueDate + "T00:00:00");
  const result: string[] = [];

  for (const dateStr of monthDateStrs) {
    if (dateStr === task.dueDate) continue; // already in dayTasksMap via dueDate
    const d = new Date(dateStr + "T00:00:00");
    if (d <= origin) continue;

    let matches = false;
    if (task.repeat === "daily") {
      matches = true;
    } else if (task.repeat === "weekly") {
      const diffDays = Math.round((d.getTime() - origin.getTime()) / 86400000);
      matches = diffDays % 7 === 0;
    } else if (task.repeat === "monthly") {
      matches = d.getDate() === origin.getDate();
    }
    if (matches) result.push(dateStr);
  }
  return result;
}

function getMonthGrid(year: number, month: number): (string | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7; // Monday-based
  const totalDays = lastDay.getDate();

  const cells: (string | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => {
      return localDateStr(new Date(year, month, i + 1));
    }),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function todayStr() {
  return localDateStr(new Date());
}

// ─── Category color helpers ───────────────────────────────────────────────────
// Map bg-X-500 → a soft chip palette (bg + text) for calendar chips
const BG_TO_CHIP: Record<string, { bg: string; text: string; border: string }> = {
  "bg-blue-500":   { bg: "bg-blue-500/15",   text: "text-blue-400",   border: "border-blue-500/30" },
  "bg-purple-500": { bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/30" },
  "bg-green-500":  { bg: "bg-green-500/15",  text: "text-green-400",  border: "border-green-500/30" },
  "bg-amber-500":  { bg: "bg-amber-500/15",  text: "text-amber-400",  border: "border-amber-500/30" },
  "bg-rose-500":   { bg: "bg-rose-500/15",   text: "text-rose-400",   border: "border-rose-500/30" },
  "bg-cyan-500":   { bg: "bg-cyan-500/15",   text: "text-cyan-400",   border: "border-cyan-500/30" },
  "bg-orange-500": { bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/30" },
  "bg-pink-500":   { bg: "bg-pink-500/15",   text: "text-pink-400",   border: "border-pink-500/30" },
};

const DEFAULT_CHIP = { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" } as const;

// ─── Mini chip (draggable — supports inter-day moves) ────────────────────────
const Chip = ({
  task,
  onClear,
  categoryColor,
}: {
  task: Task;
  onClear?: () => void;
  categoryColor?: string;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const palette: { bg: string; text: string; border: string } =
    (categoryColor ? BG_TO_CHIP[categoryColor] : undefined) ?? DEFAULT_CHIP;
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-1 text-[11px] rounded px-1.5 py-0.5 truncate max-w-full group cursor-grab active:cursor-grabbing transition-opacity border touch-none select-none ${
        isDragging ? "opacity-30" : ""
      } ${palette.bg} ${palette.text} ${palette.border}`}
    >
      <span className="truncate flex-1">{task.text}</span>
      {onClear && (
        <button
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          className="opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity flex-shrink-0 hover:opacity-80 hover:cursor-pointer"
        >
          ×
        </button>
      )}
    </div>
  );
};

// ─── DraggableTaskRow (pool) ──────────────────────────────────────────────────
const DraggableTaskRow = ({ task }: { task: Task }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-sm cursor-grab active:cursor-grabbing transition-opacity touch-none select-none ${
        isDragging ? "opacity-30" : "hover:bg-accent"
      }`}
    >
      <span className="flex-1 truncate">{task.text}</span>
    </div>
  );
};

// ─── CalendarCell ─────────────────────────────────────────────────────────────
const CalendarCell = ({
  dateStr,
  dayNum,
  isToday,
  tasks,
  onClear,
  categories,
}: {
  dateStr: string;
  dayNum: number;
  isToday: boolean;
  tasks: Task[];
  onClear: (id: string) => void;
  categories: Category[];
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: `cal-day-${dateStr}` });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[80px] p-1.5 flex flex-col gap-0.5 transition-colors ${
        isOver ? "bg-primary/10" : "bg-card"
      }`}
    >
      <span
        className={`text-xs font-semibold mb-0.5 self-start ${
          isToday
            ? "w-5 h-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground"
            : "text-muted-foreground"
        }`}
      >
        {dayNum}
      </span>
      <div className="flex flex-col gap-0.5 overflow-hidden">
        {tasks.slice(0, 3).map((t) => {
          const catColor = categories.find((c) => c.name === t.category)?.color;
          return (
            <Chip key={t.id} task={t} onClear={() => onClear(t.id)} categoryColor={catColor} />
          );
        })}
        {tasks.length > 3 && (
          <span className="text-[10px] text-muted-foreground pl-1">+{tasks.length - 3} more</span>
        )}
      </div>
    </div>
  );
};

// ─── CalendarView ─────────────────────────────────────────────────────────────
export const CalendarView = () => {
  const { tasks: allTasks, updateTaskRich } = useTasksStore();
  const { activeWorkspaceId, categories } = useUIStore();
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

  // Tasks per date — driven by dueDate + repeat
  const dayTasksMap = useMemo(() => {
    const map: Record<string, Task[]> = {};
    monthDateStrs.forEach((dateStr) => { map[dateStr] = []; });
    activeTasks.forEach((t) => {
      if (t.dueDate && map[t.dueDate] !== undefined) {
        map[t.dueDate].push(t);
      }
      // Also show on recurring dates within this month view
      for (const rDate of repeatDatesInMonth(t, monthDateStrs)) {
        map[rDate].push(t);
      }
    });
    return map;
  }, [activeTasks, monthDateStrs]);

  // Unplanned = no dueDate (or dueDate not in this month)
  const unplanned = useMemo(
    () => activeTasks.filter((t) => !t.dueDate),
    [activeTasks]
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
    if (overId.startsWith("cal-day-")) {
      const dateStr = overId.replace("cal-day-", "");
      const task = activeTasks.find((t) => t.id === active.id);
      if (task) {
        // updateTaskRich auto-computes overdue from the new dueDate
        updateTaskRich(task.id, { dueDate: dateStr }, task.userId);
      }
    }
  };

  const handleClearDueDate = (id: string) => {
    const task = activeTasks.find((t) => t.id === id);
    if (task) {
      // Passing dueDate:undefined auto-clears overdue in updateTaskRich
      updateTaskRich(task.id, { dueDate: undefined }, task.userId);
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
            <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Drag tasks onto a date to set their due date.
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
                    onClear={handleClearDueDate}
                    categories={categories}
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
              No due date — drag to a date
            </h2>
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{unplanned.length}</span>
          </div>
          {unplanned.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground/50 text-sm">
              All active tasks have a due date!
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {unplanned.map((t) => (
                <DraggableTaskRow key={t.id} task={t} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeTask && (
          <div className="px-3 py-2 rounded-lg bg-card border border-primary shadow-xl text-sm font-medium opacity-90">
            {activeTask.text}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};
