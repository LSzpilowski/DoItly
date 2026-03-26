import { useState, useMemo } from "react";
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

import { useUIStore } from "@/store/uiStore";
import { useTasksStore } from "@/store/tasksStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { RenameModal } from "./modals/RenameModal";
import type { Category, View } from "@/store/types";

const MAX_CATEGORIES = 6;
const TAGS_GRID_COLS = 3;
const TAGS_MAX_ROWS = 3;

// ─── SortableCategoryItem ─────────────────────────────────────────────────────
interface SortableCatProps {
  cat: Category;
  isActive: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onRemove: () => void;
}

const SortableCategoryItem = ({ cat, isActive, onClick, onDoubleClick, onRemove }: SortableCatProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: cat.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1 group/cat">
      <button
        {...attributes}
        {...listeners}
        className="p-1 opacity-0 group-hover/cat:opacity-40 hover:!opacity-100 text-muted-foreground cursor-grab active:cursor-grabbing transition-opacity"
        tabIndex={-1}
        aria-label="Drag to reorder"
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
        </svg>
      </button>
      <button
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        title="Double-click to rename"
        className={`flex items-center gap-2.5 flex-1 min-w-0 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
          isActive
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
        }`}
      >
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cat.color}`} />
        <span className="truncate">{cat.name}</span>
      </button>
      <button
        onClick={onRemove}
        className="opacity-0 group-hover/cat:opacity-100 p-1 mr-0.5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all cursor-pointer"
        aria-label={`Remove ${cat.name}`}
        title="Remove category"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

// ─── SeeAllTagsModal ───────────────────────────────────────────────────────────
interface TagEntry { tag: string; count: number }
interface SeeAllTagsModalProps {
  tagCounts: Map<string, number>;
  activeTag: string | null;
  onSelect: (tag: string) => void;
  onClose: () => void;
}

const SeeAllTagsModal = ({ tagCounts, activeTag, onSelect, onClose }: SeeAllTagsModalProps) => {
  const sorted = useMemo(() => {
    const entries: TagEntry[] = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => a.tag.localeCompare(b.tag));
    const groups: Record<string, TagEntry[]> = {};
    for (const entry of entries) {
      const letter = entry.tag[0]?.toUpperCase() ?? "#";
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(entry);
    }
    return groups;
  }, [tagCounts]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative z-10 w-[400px] max-h-[80vh] flex flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <h3 className="text-base font-semibold text-foreground">All Tags</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {Object.entries(sorted).map(([letter, entries]) => (
            <div key={letter}>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                {letter} <span className="font-normal normal-case">({entries.length})</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {entries.map(({ tag, count }) => (
                  <button
                    key={tag}
                    onClick={() => { onSelect(tag); onClose(); }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                      activeTag === tag
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent text-foreground hover:bg-accent/80"
                    }`}
                  >
                    <span className="opacity-60">#</span>{tag}
                    <span className="opacity-60 text-[10px]">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── VIEWS ────────────────────────────────────────────────────────────────────
const VIEWS: { id: View; label: string; icon: React.ReactNode }[] = [
  {
    id: "all",
    label: "All Tasks",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  {
    id: "today",
    label: "Today",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "thisWeek",
    label: "This Week",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    id: "completed",
    label: "Completed",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────
export const Sidebar = () => {
  const {
    currentView, currentCategory,
    setView, setCategory,
    openTaskModal,
    categories, addCategory, removeCategory, renameCategory, reorderCategories,
    activeWorkspaceId,
  } = useUIStore();

  const allTasks = useTasksStore((s) => s.tasks);
  const { workspaces } = useWorkspaceStore();

  // Scope tasks to active workspace
  const activeWorkspaceName = workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? null;
  const tasks = useMemo(
    () => allTasks.filter((t) => !t.workspace || t.workspace === activeWorkspaceName || !activeWorkspaceName),
    [allTasks, activeWorkspaceName],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const [renameTarget, setRenameTarget] = useState<{
    kind: "category";
    id: string;
    name: string;
    color: string;
  } | null>(null);

  const [adding, setAdding] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showAllTags, setShowAllTags] = useState(false);

  // ── Collapsible sections (persisted)
  const loadCollapsed = (): Record<string, boolean> => {
    try { return JSON.parse(localStorage.getItem("doitly_sidebar_collapsed") ?? "{}"); } catch { return {}; }
  };
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);
  const toggleSection = (key: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("doitly_sidebar_collapsed", JSON.stringify(next));
      return next;
    });
  };

  const overdueCount = useMemo(
    () => tasks.filter((t) => t.status === "overdue" && !t.isTemplate).length,
    [tasks]
  );

  const tagCounts = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();
    for (const t of tasks) {
      if (t.isTemplate) continue;
      if (t.status === "deleted" || t.status === "archived") continue;
      for (const tag of t.tags ?? []) {
        const trimmed = tag.trim();
        if (trimmed) map.set(trimmed, (map.get(trimmed) ?? 0) + 1);
      }
    }
    return map;
  }, [tasks]);

  const sortedTags = useMemo(
    () => Array.from(tagCounts.entries()).sort((a, b) => a[0].localeCompare(b[0])),
    [tagCounts]
  );
  const maxVisible = TAGS_GRID_COLS * TAGS_MAX_ROWS;
  const visibleTags = sortedTags.slice(0, maxVisible);
  const hiddenCount = sortedTags.length - visibleTags.length;

  const handleAddCategory = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    addCategory(trimmed);
    setNewCatName("");
    setAdding(false);
  };

  const handleCatDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = categories.findIndex((c) => c.id === active.id);
    const newIdx = categories.findIndex((c) => c.id === over.id);
    reorderCategories(arrayMove(categories, oldIdx, newIdx));
  };

  const handleTagClick = (tag: string) => {
    if (activeTag === tag) {
      setActiveTag(null);
      setView("all");
    } else {
      setActiveTag(tag);
      setCategory(`#${tag}`);
    }
  };

  return (
    <>
      <aside
        className="hidden md:flex flex-col w-64 shrink-0 border-r border-border/50 bg-background/50 pt-4 pb-6 px-3 gap-2 overflow-y-auto"
        aria-label="Main navigation"
      >

        {/* Add Task */}
        <button
          onClick={() => openTaskModal()}
          aria-label="Add new task"
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-200 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Add Task
        </button>

        {/* Planner button */}
        <button
          onClick={() => setView("planDay" as View)}
          className={`flex items-center gap-2 w-full px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 cursor-pointer ${
            currentView === "planDay" || currentView === "planWeek"
              ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-purple-500/20"
              : "bg-gradient-to-r from-violet-500/80 to-purple-600/80 text-white hover:shadow-lg hover:shadow-purple-500/20"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Planner
        </button>

        {/* VIEWS */}
        <div className="space-y-0.5">
          <button
            onClick={() => toggleSection("views")}
            className="flex items-center justify-between w-full px-2 py-1 group cursor-pointer"
          >
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">Views</p>
            <svg
              className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${collapsed["views"] ? "-rotate-90" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {!collapsed["views"] && VIEWS.map((view) => {
            const isActive = currentView === view.id && currentView !== "category";
            return (
              <button
                key={view.id}
                onClick={() => setView(view.id)}
                aria-label={`Go to ${view.label} view`}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
              >
                {view.icon}
                {view.label}
              </button>
            );
          })}
          {!collapsed["views"] && overdueCount > 0 && (
            <button
              onClick={() => setView("overdue" as View)}
              aria-label="Go to Overdue view"
              aria-current={currentView === "overdue" ? "page" : undefined}
              className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                currentView === "overdue"
                  ? "bg-red-500/15 text-red-600 dark:text-red-400"
                  : "text-red-500/70 hover:text-red-600 hover:bg-red-500/10"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Overdue
              {overdueCount > 0 && (
                <span className="ml-auto text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5 font-semibold">{overdueCount}</span>
              )}
            </button>
          )}
        </div>

        {/* CATEGORIES */}
        <div className="space-y-0.5 mt-3">
          <button
            onClick={() => toggleSection("categories")}
            className="flex items-center justify-between w-full px-2 py-1 group cursor-pointer"
          >
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
              Categories
              <span className="ml-1.5 font-normal normal-case">({categories.length}/{MAX_CATEGORIES})</span>
            </p>
            <svg
              className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${collapsed["categories"] ? "-rotate-90" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {!collapsed["categories"] && (
            <>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCatDragEnd}>
              <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-0.5">
                  {categories.map((cat) => {
                    const isActive = currentView === "category" && currentCategory === cat.name;
                    return (
                      <SortableCategoryItem
                        key={cat.id}
                        cat={cat}
                        isActive={isActive}
                        onClick={() => setCategory(cat.name)}
                        onDoubleClick={() =>
                          setRenameTarget({ kind: "category", id: cat.id, name: cat.name, color: cat.color })
                        }
                        onRemove={() => removeCategory(cat.id)}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>

            {adding ? (
              <div className="px-2 pt-1 space-y-1.5">
                <input
                  autoFocus
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddCategory();
                    if (e.key === "Escape") { setAdding(false); setNewCatName(""); }
                  }}
                  placeholder="Category name…"
                  maxLength={20}
                  className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={handleAddCategory}
                    disabled={!newCatName.trim()}
                    className="flex-1 py-1 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 cursor-pointer"
                  >Add</button>
                  <button
                    onClick={() => { setAdding(false); setNewCatName(""); }}
                    className="flex-1 py-1 text-xs font-medium rounded-lg border border-border hover:bg-accent cursor-pointer"
                  >Cancel</button>
                </div>
              </div>
            ) : (
              categories.length < MAX_CATEGORIES && (
                <button
                  onClick={() => setAdding(true)}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Category
                </button>
              )
            )}
            </>
          )}
        </div>

        {/* TAGS */}
        {sortedTags.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between px-2 py-1">
              <button
                onClick={() => toggleSection("tags")}
                className="flex items-center gap-1 group cursor-pointer w-full justify-between"
              >
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
                  Tags
                  <span className="ml-1.5 font-normal normal-case">({sortedTags.length})</span>
                </p>
                <svg
                  className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ml-1 ${collapsed["tags"] ? "-rotate-90" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {activeTag && (
                <button
                  onClick={() => { setActiveTag(null); setView("all"); }}
                  className="text-[10px] text-primary hover:opacity-80 cursor-pointer"
                >Clear</button>
              )}
            </div>

            {!collapsed["tags"] && (
            <>
            <div
              className="grid gap-1 px-1"
              style={{ gridTemplateColumns: `repeat(${TAGS_GRID_COLS}, minmax(0, 1fr))` }}
            >
              {visibleTags.map(([tag, count]) => (
                <button
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  title={`${tag} (${count})`}
                  className={`flex items-center gap-0.5 px-2 py-1.5 rounded-lg text-xs font-medium truncate transition-colors cursor-pointer ${
                    activeTag === tag
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent/60 text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <span className="opacity-60">#</span>
                  <span className="truncate">{tag}</span>
                </button>
              ))}
            </div>

            {hiddenCount > 0 && (
              <button
                onClick={() => setShowAllTags(true)}
                className="flex items-center gap-1.5 w-full px-3 py-1.5 mt-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h7" />
                </svg>
                See all tags (+{hiddenCount} more)
              </button>
            )}
            </>
            )}
          </div>
        )}
      </aside>

      {renameTarget && (
        <RenameModal
          open={!!renameTarget}
          title="Rename Category"
          initialName={renameTarget.name}
          initialColor={renameTarget.color}
          onSave={(name, color) => {
            renameCategory(renameTarget.id, name, color);
          }}
          onClose={() => setRenameTarget(null)}
        />
      )}

      {showAllTags && (
        <SeeAllTagsModal
          tagCounts={tagCounts}
          activeTag={activeTag}
          onSelect={handleTagClick}
          onClose={() => setShowAllTags(false)}
        />
      )}
    </>
  );
};
