import { useState, useEffect, useRef } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTasksStore } from "@/store/tasksStore";
import { useUIStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { Priority, Repeat, TaskFormState, Subtask } from "@/store/types";

const PRIORITIES: Priority[] = ["low", "medium", "high"];
const REPEATS: Repeat[] = ["none", "daily", "weekly", "monthly"];

const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Nice to have",
  medium: "Should have",
  high: "Must have",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  low: "text-green-600 dark:text-green-400",
  medium: "text-amber-600 dark:text-amber-400",
  high: "text-red-600 dark:text-red-400",
};

// ─── SortableSubtaskItem ─────────────────────────────────────────────────────
interface SortableSubtaskProps {
  subtask: Subtask;
  onToggle: () => void;
  onRemove: () => void;
}

const SortableSubtaskItem = ({ subtask, onToggle, onRemove }: SortableSubtaskProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: subtask.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg group"
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="p-0.5 opacity-0 group-hover:opacity-40 hover:!opacity-100 text-muted-foreground cursor-grab active:cursor-grabbing transition-opacity flex-shrink-0"
        tabIndex={-1}
        aria-label="Drag to reorder"
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
        </svg>
      </button>
      <input
        type="checkbox"
        checked={subtask.completed}
        onChange={onToggle}
        className="w-4 h-4 rounded border-border accent-primary cursor-pointer flex-shrink-0"
      />
      <span className={`flex-1 text-sm ${subtask.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
        {subtask.title}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-900/30 rounded transition-all cursor-pointer flex-shrink-0"
        aria-label="Remove subtask"
      >
        <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

// ─── Inner form (keyed, so state always reflects current task) ────────────────
interface InnerProps {
  isEditing: boolean;
  initialForm: TaskFormState;
  onSubmit: (form: TaskFormState) => Promise<void>;
  onClose: () => void;
  categories: { id: string; name: string; color: string }[];
  workspaces: { id: string; name: string; color: string }[];
}

const TaskModalInner = ({
  isEditing,
  initialForm,
  onSubmit,
  onClose,
  categories,
  workspaces,
}: InnerProps) => {
  const [form, setForm] = useState<TaskFormState>(initialForm);
  const [subtaskInput, setSubtaskInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const titleRef = useRef<HTMLInputElement>(null);

  const subtaskSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleSubtaskDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = form.subtasks.findIndex((s) => s.id === active.id);
    const newIdx = form.subtasks.findIndex((s) => s.id === over.id);
    setForm((f) => ({ ...f, subtasks: arrayMove(f.subtasks, oldIdx, newIdx) }));
  };

  // Auto-focus title on mount
  useEffect(() => {
    setTimeout(() => titleRef.current?.focus(), 50);
  }, []);

  const setField = <K extends keyof TaskFormState>(field: K, value: TaskFormState[K]) =>
    setForm((f) => ({ ...f, [field]: value }));

  // Tags as array derived from form.tags string
  const tagList = form.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const addTag = () => {
    const trimmed = tagInput.trim().replace(/^#/, "");
    if (!trimmed || tagList.includes(trimmed)) { setTagInput(""); return; }
    setField("tags", [...tagList, trimmed].join(", "));
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setField("tags", tagList.filter((t) => t !== tag).join(", "));
  };

  const addSubtask = () => {
    const trimmed = subtaskInput.trim();
    if (!trimmed) return;
    const st: Subtask = { id: Date.now().toString(36), title: trimmed, completed: false };
    setForm((f) => ({ ...f, subtasks: [...f.subtasks, st] }));
    setSubtaskInput("");
  };

  const toggleSubtask = (idx: number) =>
    setForm((f) => ({
      ...f,
      subtasks: f.subtasks.map((s, i) =>
        i === idx ? { ...s, completed: !s.completed } : s
      ),
    }));

  const removeSubtask = (idx: number) =>
    setForm((f) => ({ ...f, subtasks: f.subtasks.filter((_, i) => i !== idx) }));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (form.title.length > 150) e.title = "Title too long (max 150 characters)";
    if (form.description.length > 1000) e.description = "Description too long (max 1000 characters)";
    if (form.notes.length > 2000) e.notes = "Notes too long (max 2000 characters)";
    // Repeat requires due date
    const hasDue = !!form.dueDate;
    if (form.repeat !== "none" && !hasDue) {
      e.dueDate = "Due Date required when Repeat is set";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(form);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? "Edit task" : "Add task"}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <h3 className="text-xl font-bold text-foreground">
            {isEditing ? "Edit Task" : "Add Task"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 hover:bg-accent rounded-lg transition-colors text-muted-foreground cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4 overflow-y-auto flex-1">

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              ref={titleRef}
              type="text"
              required
              maxLength={150}
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${errors.title ? "border-red-500" : "border-input"}`}
              placeholder="Task title..."
            />
            <div className="flex justify-between mt-1">
              {errors.title
                ? <p className="text-xs text-red-500">{errors.title}</p>
                : <span />}
              <span className={`text-xs ml-auto ${form.title.length > 130 ? "text-amber-500" : "text-muted-foreground/50"}`}>
                {form.title.length}/150
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">Description</label>
            <textarea
              rows={2}
              maxLength={1000}
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none ${errors.description ? "border-red-500" : "border-input"}`}
              placeholder="Optional description..."
            />
            <div className="flex justify-between mt-1">
              {errors.description
                ? <p className="text-xs text-red-500">{errors.description}</p>
                : <span />}
              {form.description.length > 800 && (
                <span className="text-xs ml-auto text-amber-500">{form.description.length}/1000</span>
              )}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">Due Date</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setField("dueDate", e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${errors.dueDate ? "border-red-500" : "border-input"}`}
            />
            {errors.dueDate && <p className="text-xs text-red-500 mt-1">{errors.dueDate}</p>}
          </div>

          {/* Row: Workspace + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">Workspace</label>
              <select
                value={form.workspace}
                onChange={(e) => setField("workspace", e.target.value)}
                className="w-full px-3 pr-8 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:cursor-pointer"
              >
                <option value="">— None —</option>
                {workspaces.map((w) => (
                  <option key={w.id} value={w.name}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setField("category", e.target.value)}
                className="w-full px-3 pr-8 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:cursor-pointer"
              >
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row: Priority + Repeat */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setField("priority", e.target.value as Priority)}
                className="w-full px-3 pr-8 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:cursor-pointer"
              >
                {PRIORITIES.map((p) => (
                  <option className="hover:cursor-pointer" key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
              <div className={`text-xs mt-1 font-medium ${PRIORITY_COLORS[form.priority]}`}>
                {PRIORITY_LABELS[form.priority]}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">Repeat</label>
              <select
                value={form.repeat}
                onChange={(e) => setField("repeat", e.target.value as Repeat)}
                className="w-full px-3 pr-8 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:cursor-pointer"
              >
                {REPEATS.map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
              {form.repeat !== "none" && (
                <p className="text-xs text-amber-500 mt-1">Start & Due Date required</p>
              )}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">Tags</label>
            {/* Tag chips */}
            {tagList.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tagList.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent text-foreground"
                  >
                    <span className="opacity-50">#</span>{tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-0.5 hover:text-destructive transition-colors cursor-pointer"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addTag(); }
                  if (e.key === ",") { e.preventDefault(); addTag(); }
                }}
                maxLength={30}
                placeholder="Type a tag and press Enter…"
                className="flex-1 px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors text-sm font-medium cursor-pointer"
              >
                + Add
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">Notes</label>
            <textarea
              rows={2}
              maxLength={2000}
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none ${errors.notes ? "border-red-500" : "border-input"}`}
              placeholder="Additional notes..."
            />
            <div className="flex justify-between mt-1">
              {errors.notes
                ? <p className="text-xs text-red-500">{errors.notes}</p>
                : <span />}
              {form.notes.length > 1600 && (
                <span className="text-xs ml-auto text-amber-500">{form.notes.length}/2000</span>
              )}
            </div>
          </div>

          {/* Subtasks */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Subtasks</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={subtaskInput}
                onChange={(e) => setSubtaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addSubtask(); }
                }}
                maxLength={200}
                placeholder="Add subtask and press Enter"
                className="flex-1 px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={addSubtask}
                className="px-3 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors text-sm font-medium cursor-pointer"
              >
                + Add
              </button>
            </div>
            {form.subtasks.length > 0 && (
              <DndContext
                sensors={subtaskSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleSubtaskDragEnd}
              >
                <SortableContext
                  items={form.subtasks.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1">
                    {form.subtasks.map((st, idx) => (
                      <SortableSubtaskItem
                        key={st.id}
                        subtask={st}
                        onToggle={() => toggleSubtask(idx)}
                        onRemove={() => removeSubtask(idx)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 pb-1">
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-200 cursor-pointer"
            >
              {isEditing ? "Save Changes" : "Create Task"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-muted text-muted-foreground rounded-lg font-semibold hover:bg-accent transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── TaskModal (outer shell) ──────────────────────────────────────────────────
export const TaskModal = () => {
  const { addTaskRich, updateTaskRich, tasks } = useTasksStore();
  const { modals, editingTask, closeAllModals, showNotification, categories, activeWorkspaceId } = useUIStore();
  const { user } = useAuthStore();
  const { workspaces, activeWorkspaceId: wsStoreActiveId } = useWorkspaceStore();
  const isOpen = modals.task;

  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  // Determine the active workspace name for auto-assigning to new tasks
  const resolvedWsId = activeWorkspaceId ?? wsStoreActiveId;
  const activeWorkspaceName = workspaces.find((w) => w.id === resolvedWsId)?.name ?? workspaces[0]?.name ?? "";

  // Always resolve the editing task from the live tasks array so we get
  // fresh data even if the modal was opened with a stale reference.
  // Exception: if it's a template or has no userId (prefill-only), use as-is.
  const liveEditingTask = editingTask
    ? editingTask.isTemplate
      ? null  // Template used as prefill → treat as new task
      : (tasks.find((t) => t.id === editingTask.id) ?? editingTask)
    : null;

  const EMPTY: TaskFormState = {
    title: "",
    description: "",
    dueDate: "",
    priority: "medium",
    workspace: activeWorkspaceName,
    category: categories[0]?.name ?? "",
    repeat: "none",
    tags: "",
    notes: "",
    subtasks: [],
  };

  // Source for pre-filling: either the live editing task OR the raw editingTask
  // when it's a template/prefill (isTemplate or no userId means prefill-only)
  const prefillSource = liveEditingTask ?? (editingTask?.isTemplate ? editingTask : null);

  const initialForm: TaskFormState = prefillSource
    ? {
        title: prefillSource.title ?? prefillSource.text ?? "",
        description: prefillSource.description ?? "",
        dueDate: prefillSource.dueDate ?? "",
        priority: prefillSource.priority ?? "medium",
        workspace: prefillSource.workspace ?? (workspaces[0]?.name ?? ""),
        category: prefillSource.category ?? (categories[0]?.name ?? ""),
        repeat: prefillSource.repeat ?? "none",
        tags: prefillSource.tags ? prefillSource.tags.join(", ") : "",
        notes: prefillSource.notes ?? "",
        subtasks: prefillSource.subtasks ? [...prefillSource.subtasks] : [],
      }
    : EMPTY;

  const handleSubmit = async (form: TaskFormState) => {
    if (liveEditingTask) {
      await updateTaskRich(
        liveEditingTask.id,
        {
          title: form.title,
          text: form.title,
          description: form.description || undefined,
          dueDate: form.dueDate || undefined,
          // overdue is auto-resolved by updateTaskRich based on dueDate
          priority: form.priority,
          workspace: form.workspace || undefined,
          category: form.category || undefined,
          repeat: form.repeat,
          tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
          notes: form.notes || undefined,
          subtasks: form.subtasks,
        },
        user?.id,
      );
      showNotification("Task updated!", "success");
    } else {
      await addTaskRich(form, user?.id);
      showNotification("Task created!", "success");
    }
    closeAllModals();
  };

  // Key includes a hash of the live task's mutable fields so the inner
  // component remounts (and re-initialises state) whenever the task is updated
  // in the store — fixes stale data after "Save Changes".
  const taskKey = liveEditingTask
    ? `${liveEditingTask.id}__${liveEditingTask.title ?? ""}__${liveEditingTask.notes ?? ""}__${liveEditingTask.subtasks?.length ?? 0}__${liveEditingTask.dueDate ?? ""}`
    : prefillSource
    ? `prefill__${prefillSource.id}__${isOpen}`
    : `new__${isOpen}`;

  return (
    <TaskModalInner
      key={taskKey}
      isEditing={!!liveEditingTask}
      initialForm={initialForm}
      onSubmit={handleSubmit}
      onClose={closeAllModals}
      categories={categories}
      workspaces={workspaces}
    />
  );
};
