import { useState, useEffect, useRef } from "react";
import { useTasksStore } from "@/store/tasksStore";
import { useUIStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { Priority, Repeat, TaskFormState } from "@/store/types";

const PRIORITIES: Priority[] = ["low", "medium", "high"];
const HABIT_REPEATS: Exclude<Repeat, "none">[] = ["daily", "weekly", "monthly"];

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

const REPEAT_LABELS: Record<Exclude<Repeat, "none">, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

// ─── Inner form ───────────────────────────────────────────────────────────────
interface InnerProps {
  isEditing: boolean;
  /** True when editing a habit instance (has templateId), not the root habit */
  isInstance: boolean;
  /** True when editing all instances as a series */
  isSeries: boolean;
  initialForm: TaskFormState;
  onSubmit: (form: TaskFormState) => Promise<void>;
  onClose: () => void;
  categories: { id: string; name: string; color: string }[];
  workspaces: { id: string; name: string; color: string }[];
}

const HabitModalInner = ({
  isEditing,
  isInstance,
  isSeries,
  initialForm,
  onSubmit,
  onClose,
  categories,
  workspaces,
}: InnerProps) => {
  const [form, setForm] = useState<TaskFormState>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Auto-focus title on mount
  useEffect(() => {
    setTimeout(() => titleRef.current?.focus(), 50);
  }, []);

  const setField = <K extends keyof TaskFormState>(field: K, value: TaskFormState[K]) =>
    setForm((f) => ({ ...f, [field]: value }));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (form.title.length > 150) e.title = "Title too long (max 150 characters)";
    if (form.description.length > 1000) e.description = "Description too long (max 1000 characters)";
    if (form.notes.length > 2000) e.notes = "Notes too long (max 2000 characters)";
    if (!isInstance) {
      if (!form.startDate) e.startDate = "Start Date is required";
      if (form.startDate && form.repeatEndDate && form.repeatEndDate < form.startDate) {
        e.repeatEndDate = "End Date must be on or after Start Date";
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-background border border-emerald-500/30 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? "Edit Habit" : "Add Habit"}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🔁</span>
              <h3 className="text-xl font-bold text-foreground">
                {isEditing
                  ? (isInstance ? "Edit Habit Occurrence" : "Edit Habit")
                  : "Add Habit"}
              </h3>
            </div>
            {isInstance && (
              <p className="text-xs text-muted-foreground mt-0.5 ml-7">Only description &amp; notes can be set per occurrence</p>
            )}
          </div>
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

          {/* ── INSTANCE MODE: only Title (locked) + Description + Notes ── */}
          {isInstance ? (
            <>
              {/* Title — read-only */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">Title</label>
                <div
                  className="w-full px-3 py-2 text-sm border border-border/50 rounded-lg bg-muted/50 text-muted-foreground"
                  title="Title is shared across all occurrences of this habit"
                >
                  {form.title}
                </div>
                <p className="text-xs text-muted-foreground/60 mt-1">Shared across all occurrences — edit the habit series to change it</p>
              </div>

              {/* Description — series-level, read-only */}
              {form.description ? (
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1">Description</label>
                  <div
                    className="w-full px-3 py-2 text-sm border border-border/50 rounded-lg bg-muted/50 text-muted-foreground"
                    title="Description is shared across all occurrences"
                  >
                    {form.description}
                  </div>
                  <p className="text-xs text-muted-foreground/60 mt-1">Shared across all occurrences — edit the habit series to change it</p>
                </div>
              ) : null}

              {/* Notes — truly per-occurrence */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">
                  Notes
                  <span className="ml-1.5 text-xs font-normal text-emerald-500/80">· this occurrence only</span>
                </label>
                <textarea
                  ref={titleRef as unknown as React.RefObject<HTMLTextAreaElement>}
                  rows={4}
                  maxLength={2000}
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Notes specific to this occurrence (e.g. meditated for 15 min)..."
                />
                {form.notes.length > 1600 && (
                  <span className="text-xs text-amber-500">{form.notes.length}/2000</span>
                )}
              </div>
            </>
          ) : isSeries ? (
            // ── SERIES MODE: Title, Description, Priority, Workspace, Category ──
            <>
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
                  placeholder="Habit title..."
                />
                <div className="flex justify-between mt-1">
                  {errors.title ? <p className="text-xs text-red-500">{errors.title}</p> : <span />}
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
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Optional description..."
                />
                {form.description.length > 800 && (
                  <span className="text-xs text-amber-500">{form.description.length}/1000</span>
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setField("priority", e.target.value as Priority)}
                  className="w-full px-3 pr-8 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:cursor-pointer"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
                <div className={`text-xs mt-1 font-medium ${PRIORITY_COLORS[form.priority]}`}>
                  {PRIORITY_LABELS[form.priority]}
                </div>
              </div>

              {/* Workspace + Category */}
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

              {/* Locked fields info */}
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-muted/40 border border-border/50">
                <svg className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Repeat pattern &amp; dates</span> are locked after creation.
                  To change them, delete this habit and create a new one.
                </p>
              </div>
            </>
          ) : (
            <>
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
              placeholder="Habit title..."
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

          {/* Row: Repeat (required, no "none") + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">
                Repeat {!isInstance && <span className="text-red-500">*</span>}
              </label>
              {isInstance ? (
                <div className="w-full px-3 py-2 text-sm border border-border/50 rounded-lg bg-muted/50 text-muted-foreground flex items-center justify-between" title="Repeat pattern is set on the habit series and cannot be changed per instance">
                  <span>{REPEAT_LABELS[form.repeat as Exclude<Repeat, "none">] ?? form.repeat}</span>
                  <svg className="w-3.5 h-3.5 opacity-50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              ) : (
                <select
                  value={form.repeat}
                  onChange={(e) => setField("repeat", e.target.value as Repeat)}
                  className="w-full px-3 pr-8 py-2 text-sm border border-emerald-500/40 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 hover:cursor-pointer"
                >
                  {HABIT_REPEATS.map((r) => (
                    <option key={r} value={r}>
                      {REPEAT_LABELS[r]}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-emerald-500/80 mt-1 font-medium">
                {isInstance ? "Defined by the habit series" : `${REPEAT_LABELS[form.repeat as Exclude<Repeat, "none">] ?? ""} habit`}
              </p>
            </div>
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
          </div>

          {/* Row: Start Date + End Date (or just Instance Date when editing instance) */}
          {isInstance ? (
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">Instance Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setField("startDate", e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring border-input"
              />
              <p className="text-xs text-muted-foreground mt-1">Date of this specific occurrence</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setField("startDate", e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${errors.startDate ? "border-red-500" : "border-input"}`}
                />
                {errors.startDate
                  ? <p className="text-xs text-red-500 mt-1">{errors.startDate}</p>
                  : <p className="text-xs text-muted-foreground mt-1">First occurrence</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">End Date</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={form.repeatEndDate}
                    min={form.startDate || undefined}
                    onChange={(e) => setField("repeatEndDate", e.target.value)}
                    className={`flex-1 px-3 py-2 text-sm border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${errors.repeatEndDate ? "border-red-500" : "border-input"}`}
                  />
                  {form.repeatEndDate && (
                    <button
                      type="button"
                      onClick={() => setField("repeatEndDate", "")}
                      className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                      aria-label="Clear end date"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {errors.repeatEndDate
                  ? <p className="text-xs text-red-500 mt-1">{errors.repeatEndDate}</p>
                  : <p className="text-xs text-muted-foreground mt-1">
                      {form.repeatEndDate
                        ? "Instances generated up to end date"
                        : "Ongoing — instances generated 30 days ahead"}
                    </p>}
              </div>
            </div>
          )}

          {/* Row: Workspace + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">Workspace</label>
              {isInstance ? (
                <div className="w-full px-3 py-2 text-sm border border-border/50 rounded-lg bg-muted/50 text-muted-foreground flex items-center justify-between" title="Workspace is set on the habit series">
                  <span>{form.workspace || "— None —"}</span>
                  <svg className="w-3.5 h-3.5 opacity-50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              ) : (
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
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">Category</label>
              {isInstance ? (
                <div className="w-full px-3 py-2 text-sm border border-border/50 rounded-lg bg-muted/50 text-muted-foreground flex items-center justify-between" title="Category is set on the habit series">
                  <span>{form.category || "— None —"}</span>
                  <svg className="w-3.5 h-3.5 opacity-50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              ) : (
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
              )}
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

          </>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 pb-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-emerald-500/20 transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V0a12 12 0 00-12 12h4z" />
                </svg>
              )}
              {isSubmitting ? (isEditing ? "Saving…" : "Creating…") : (isEditing ? "Save Changes" : "Create Habit")}
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

// ─── HabitModal (outer shell) ─────────────────────────────────────────────────
export const HabitModal = () => {
  const { addTaskRich, updateTaskRich, tasks } = useTasksStore();
  const { modals, editingTask, closeAllModals, showNotification, categories, activeWorkspaceId, habitEditMode } = useUIStore();
  const { user } = useAuthStore();
  const { workspaces, activeWorkspaceId: wsStoreActiveId } = useWorkspaceStore();
  const isOpen = modals.habit;

  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  const resolvedWsId = activeWorkspaceId ?? wsStoreActiveId;
  const activeWorkspaceName = workspaces.find((w) => w.id === resolvedWsId)?.name ?? workspaces[0]?.name ?? "";

  // Resolve live editing task from store
  const liveEditingTask = editingTask
    ? (tasks.find((t) => t.id === editingTask.id) ?? editingTask)
    : null;

  const EMPTY: TaskFormState = {
    title: "",
    description: "",
    dueDate: "",
    startDate: "",
    repeatEndDate: "",
    priority: "medium",
    workspace: activeWorkspaceName,
    category: categories[0]?.name ?? "",
    repeat: "daily",
    tags: "",
    notes: "",
    subtasks: [],
  };

  const initialForm: TaskFormState = liveEditingTask
    ? {
        title: liveEditingTask.title ?? liveEditingTask.text ?? "",
        description: liveEditingTask.description ?? "",
        dueDate: "",
        startDate: liveEditingTask.startDate ?? liveEditingTask.dueDate ?? "",
        repeatEndDate: liveEditingTask.repeatEndDate ?? "",
        priority: liveEditingTask.priority ?? "medium",
        workspace: liveEditingTask.workspace ?? (workspaces[0]?.name ?? ""),
        category: liveEditingTask.category ?? (categories[0]?.name ?? ""),
        repeat: (liveEditingTask.repeat && liveEditingTask.repeat !== "none")
          ? liveEditingTask.repeat
          : "daily",
        tags: liveEditingTask.tags ? liveEditingTask.tags.join(", ") : "",
        notes: liveEditingTask.notes ?? "",
        subtasks: liveEditingTask.subtasks ? [...liveEditingTask.subtasks] : [],
      }
    : EMPTY;

  // 'series' = edit all instances, 'instance' = edit one occurrence, null = create new
  const isInstance = habitEditMode === 'instance';
  const isSeries   = habitEditMode === 'series';

  const handleSubmit = async (form: TaskFormState) => {
    closeAllModals();
    try {
      if (liveEditingTask) {
        if (isSeries) {
          // Series edit — propagate title, description, priority, workspace, category
          // to ALL non-deleted instances of this habit series
          const habitId = liveEditingTask.templateId ?? liveEditingTask.id;
          const allInstances = tasks.filter(
            t => t.isHabit && !t.deletedAt &&
              (t.id === habitId || t.templateId === habitId)
          );
          const seriesUpdates: Partial<import('@/store/tasksStore').Task> = {
            title:       form.title,
            text:        form.title,
            description: form.description || undefined,
            priority:    form.priority,
            workspace:   form.workspace || undefined,
            category:    form.category || undefined,
          };
          await Promise.all(
            allInstances.map(t => updateTaskRich(t.id, seriesUpdates, user?.id))
          );
          showNotification(`Habit series updated (${allInstances.length} occurrences)`, 'success');
        } else if (isInstance) {
          // Instance edit — only notes are truly per-occurrence.
          // description lives on the root task (series-level) so we never overwrite it here.
          await updateTaskRich(
            liveEditingTask.id,
            {
              notes: form.notes || undefined,
            },
            user?.id,
          );
          showNotification('Habit occurrence updated!', 'success');
        } else {
          // Should not happen (create goes through addTaskRich below), safety fallback
          showNotification('Nothing to update', 'info');
        }
      } else {
        await addTaskRich(form, user?.id);
        showNotification('Habit created!', 'success');
      }
    } catch {
      showNotification('Failed to save habit. Please try again.', 'error');
    }
  };

  const habitKey = liveEditingTask
    ? `habit__${liveEditingTask.id}__${habitEditMode}`
    : `new_habit__${isOpen}`;

  return (
    <HabitModalInner
      key={habitKey}
      isEditing={!!liveEditingTask}
      isInstance={isInstance}
      isSeries={isSeries}
      initialForm={initialForm}
      onSubmit={handleSubmit}
      onClose={closeAllModals}
      categories={categories}
      workspaces={workspaces}
    />
  );
};
