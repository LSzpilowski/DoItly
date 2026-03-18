import { useState, useCallback } from "react";
import { useTasksStore, type Task } from "@/store/tasksStore";
import { useUIStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import type { Subtask } from "@/store/types";

// ── Badge helpers ────────────────────────────────────────────────────────────

const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-green-900/60 text-green-300 border border-green-700/40",
  medium: "bg-yellow-900/60 text-yellow-300 border border-yellow-700/40",
  high: "bg-red-900/60 text-red-300 border border-red-700/40",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Nice to have",
  medium: "Should have",
  high: "Must have",
};

// Category colors are derived from live uiStore categories (see TaskItem)
// Map bg-X-500 Tailwind classes to badge-safe dark classes
const BG_TO_BADGE: Record<string, string> = {
  "bg-blue-500":   "bg-blue-900/60 text-blue-300 border border-blue-700/40",
  "bg-purple-500": "bg-purple-900/60 text-purple-300 border border-purple-700/40",
  "bg-green-500":  "bg-green-900/60 text-green-300 border border-green-700/40",
  "bg-amber-500":  "bg-amber-900/60 text-amber-300 border border-amber-700/40",
  "bg-rose-500":   "bg-rose-900/60 text-rose-300 border border-rose-700/40",
  "bg-cyan-500":   "bg-cyan-900/60 text-cyan-300 border border-cyan-700/40",
  "bg-orange-500": "bg-orange-900/60 text-orange-300 border border-orange-700/40",
  "bg-pink-500":   "bg-pink-900/60 text-pink-300 border border-pink-700/40",
};

function formatDate(dateStr: string): { label: string; overdue: boolean; today: boolean } {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);

  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);

  if (diff === 0) return { label: "Today", overdue: false, today: true };
  if (diff === 1) return { label: "Tomorrow", overdue: false, today: false };
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, overdue: true, today: false };
  return {
    label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    overdue: false,
    today: false,
  };
}

// ── TaskItem ─────────────────────────────────────────────────────────────────

interface TaskItemProps {
  task: Task;
}

export const TaskItem = ({ task }: TaskItemProps) => {
  const { markAsCompleted, deleteTask, undoTask, updateTaskRich } = useTasksStore();
  const { toggleTaskSelect, selectedTasks, openTaskModal, showNotification, categories } = useUIStore();
  const { user } = useAuthStore();

  // Resolve category badge class from live category list
  const getCategoryBadge = (categoryName: string) => {
    const cat = categories.find((c) => c.name === categoryName);
    return cat ? (BG_TO_BADGE[cat.color] ?? "bg-muted text-muted-foreground") : "bg-muted text-muted-foreground";
  };

  const isSelected = selectedTasks.has(task.id);
  const isCompleted = task.status === "completed";
  const displayTitle = task.title ?? task.text;

  const totalSubtasks = task.subtasks?.length ?? 0;
  const completedSubtasks = task.subtasks?.filter((s) => s.completed).length ?? 0;
  const [subtasksOpen, setSubtasksOpen] = useState(true);

  // ── Completion animation state: idle | completing | done
  const [completeAnim, setCompleteAnim] = useState<"idle" | "completing" | "done">("idle");

  const handleCheck = useCallback(async () => {
    if (isCompleted) {
      await undoTask(task.id, user?.id);
      showNotification("Task moved back to active", "info");
      setCompleteAnim("idle");
    } else {
      // Step 1: show green fill
      setCompleteAnim("completing");
      // Step 2: after short pause start fade-out, then actually mark complete
      setTimeout(async () => {
        setCompleteAnim("done");
        await markAsCompleted(task.id, user?.id);
        showNotification("Task completed!", "success");
      }, 500);
    }
  }, [isCompleted, task.id, user?.id, markAsCompleted, undoTask, showNotification]);

  const handleDelete = async () => {
    await deleteTask(task.id, user?.id);
    showNotification("Task deleted", "warning");
  };

  // Toggle a subtask's completed state inline (no modal needed)
  const handleSubtaskToggle = async (subtaskId: string) => {
    const updated: Subtask[] = (task.subtasks ?? []).map((s) =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s,
    );
    await updateTaskRich(task.id, { subtasks: updated }, user?.id);
  };

  return (
    <div
      onDoubleClick={() => openTaskModal(task)}
      style={{
        // Fade-out when marking complete
        opacity: completeAnim === "done" ? 0 : 1,
        transition: completeAnim === "done" ? "opacity 0.4s ease-out" : "opacity 0.15s",
        pointerEvents: completeAnim !== "idle" ? "none" : undefined,
      }}
      className={`group relative flex items-start gap-2 p-3 rounded-xl border transition-colors duration-150 cursor-pointer
        ${isSelected ? "border-primary/60 bg-primary/5" : "border-border/50 bg-card hover:border-border hover:shadow-sm"}
        ${isCompleted ? "opacity-60" : ""}`}
    >
      {/* Selection checkbox */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleTaskSelect(task.id); }}
        className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors
          ${isSelected ? "bg-primary border-primary" : "border-muted-foreground/40 hover:border-primary"}`}
        aria-label="Select task"
      >
        {isSelected && (
          <svg className="w-2.5 h-2.5 text-primary-foreground" fill="currentColor" viewBox="0 0 12 12">
            <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Subtask expand arrow — only shown when task has subtasks */}
      {totalSubtasks > 0 ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setSubtasksOpen((o) => !o); }}
          className="mt-0.5 w-5 h-5 flex-shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded"
          aria-label={subtasksOpen ? "Collapse subtasks" : "Expand subtasks"}
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${subtasksOpen ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      ) : (
        /* Spacer to keep alignment consistent when no subtasks */
        <span className="w-5 flex-shrink-0" />
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        <p
          className={`text-sm font-medium leading-snug break-words ${
            isCompleted ? "line-through text-muted-foreground" : "text-foreground"
          }`}
        >
          {displayTitle}
        </p>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</p>
        )}

        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {/* Priority */}
          {task.priority && (
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_BADGE[task.priority] ?? ""}`}>
              {PRIORITY_LABELS[task.priority] ?? task.priority}
            </span>
          )}

          {/* Category */}
          {task.category && (
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${getCategoryBadge(task.category)}`}>
              {task.category}
            </span>
          )}

          {/* Due date */}
          {task.dueDate && (() => {
            const { label, overdue, today: isToday } = formatDate(task.dueDate);
            return (
              <span
                className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
                  overdue
                    ? "bg-red-900/60 text-red-300 border border-red-700/40"
                    : isToday
                    ? "bg-blue-900/60 text-blue-300 border border-blue-700/40"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2" />
                  <path strokeLinecap="round" strokeWidth="2" d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                {label}
              </span>
            );
          })()}

          {/* Repeat */}
          {task.repeat && task.repeat !== "none" && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
              🔄 {task.repeat}
            </span>
          )}

          {/* Subtask count badge */}
          {totalSubtasks > 0 && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
              {completedSubtasks}/{totalSubtasks} done
            </span>
          )}

          {/* Tags */}
          {task.tags?.map((tag) => (
            <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              #{tag}
            </span>
          ))}
        </div>

        {/* Subtasks inline list + progress bar */}
        {totalSubtasks > 0 && (
          <>
            {/* Progress bar */}
            <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-300"
                style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
              />
            </div>

            {/* Expandable subtask list */}
            {subtasksOpen && (
              <ul className="mt-2 space-y-1 border-l-2 border-border/30 ml-1 pl-3">
                {task.subtasks!.map((st) => (
                  <li key={st.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleSubtaskToggle(st.id); }}
                      className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        st.completed
                          ? "bg-green-600 border-green-600"
                          : "border-muted-foreground/40 hover:border-green-500"
                      }`}
                      aria-label={st.completed ? "Uncheck subtask" : "Check subtask"}
                    >
                      {st.completed && (
                        <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span
                      className={`text-xs leading-snug select-none ${
                        st.completed ? "line-through text-muted-foreground" : "text-foreground/80"
                      }`}
                    >
                      {st.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {/* Right-side action bar — always visible on hover, complete btn included */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
        {/* Edit */}
        <button
          onClick={(e) => { e.stopPropagation(); openTaskModal(task); }}
          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Edit task"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>

        {/* Delete */}
        <button
          onClick={(e) => { e.stopPropagation(); handleDelete(); }}
          className="p-1.5 rounded-lg hover:bg-red-900/30 text-muted-foreground hover:text-red-400 transition-colors"
          aria-label="Delete task"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>

        {/* Complete / Undo — moved here from left side */}
        <button
          onClick={(e) => { e.stopPropagation(); handleCheck(); }}
          className={`p-1.5 rounded-lg transition-all duration-300 ${
            isCompleted || completeAnim !== "idle"
              ? "text-green-500 hover:bg-green-900/20"
              : "text-muted-foreground hover:text-green-500 hover:bg-green-900/20"
          }`}
          aria-label={isCompleted ? "Undo completion" : "Mark complete"}
        >
          {isCompleted || completeAnim !== "idle" ? (
            /* Filled green circle with checkmark */
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle
                cx="12" cy="12" r="9"
                className={`transition-all duration-300 ${
                  completeAnim !== "idle" ? "fill-green-600 stroke-green-600" : "fill-green-600 stroke-green-600"
                }`}
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} stroke="white" d="M8 12l3 3 5-6" />
            </svg>
          ) : (
            /* Empty circle */
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="9" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

