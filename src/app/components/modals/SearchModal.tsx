import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useTasksStore, type Task } from "@/store/tasksStore";
import { useUIStore } from "@/store/uiStore";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

const RECENT_SEARCHES_KEY = "doitly_recent_searches";
const MAX_RECENT = 8;

function loadRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(term: string) {
  const trimmed = term.trim();
  if (!trimmed) return;
  const existing = loadRecentSearches().filter((s) => s !== trimmed);
  const updated = [trimmed, ...existing].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-300",
  high: "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Nice to have",
  medium: "Should have",
  high: "Must have",
};

function formatDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime()) return "Today";
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.getTime() === tomorrow.getTime()) return "Tomorrow";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const SearchModal = () => {
  const { searchTasks } = useTasksStore();
  const { modals, closeAllModals, openTaskModal } = useUIStore();
  const isOpen = modals.search;
  useBodyScrollLock(isOpen);

  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset query when modal opens and auto-focus
  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery("");
    setRecentSearches(loadRecentSearches());
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  // Derive results from query directly (no separate state needed)
  const results = useMemo(
    () => (query.trim() ? searchTasks(query) : []),
    [query, searchTasks]
  );

  const handleOpenTask = useCallback((task: Task) => {
    if (query.trim()) saveRecentSearch(query);
    closeAllModals();
    setTimeout(() => openTaskModal(task), 100);
  }, [query, closeAllModals, openTaskModal]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim()) {
      saveRecentSearch(query);
      setRecentSearches(loadRecentSearches());
    }
  };

  const handleRecentClick = (term: string) => {
    setQuery(term);
    inputRef.current?.focus();
  };

  const removeRecent = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = loadRecentSearches().filter((s) => s !== term);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    setRecentSearches(updated);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-20 p-4"
      onClick={(e) => e.target === e.currentTarget && closeAllModals()}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Search tasks"
      >
        {/* Search input */}
        <div className="p-4 border-b border-border flex items-center gap-3">
          <svg className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks by title, description, tags..."
            aria-label="Search tasks"
            className="flex-1 py-1 bg-transparent text-foreground placeholder-muted-foreground focus:outline-none text-base"
          />
          <button
            onClick={closeAllModals}
            aria-label="Close search"
            className="px-2 py-1 rounded-lg hover:bg-accent transition-colors text-muted-foreground text-xs font-medium hover:cursor-pointer"
          >
            Esc
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {query.trim() === "" ? (
            recentSearches.length > 0 ? (
              <div className="p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Recent searches</p>
                <div className="space-y-0.5">
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      onClick={() => handleRecentClick(term)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent text-left group transition-colors"
                    >
                      <svg className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="flex-1 text-sm text-foreground truncate">{term}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => removeRecent(term, e)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") removeRecent(term, e as unknown as React.MouseEvent); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground transition-all"
                        aria-label={`Remove "${term}" from recent searches`}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-sm">Type to search tasks</p>
              </div>
            )
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-sm">
                No tasks found for <span className="font-semibold">"{query}"</span>
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {results.map((task) => (
                <button
                  key={task.id}
                  onClick={() => handleOpenTask(task)}
                  className="w-full text-left p-4 hover:bg-accent transition-colors flex items-start gap-3"
                >
                  <div
                    className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                      task.status === "completed" ? "bg-muted-foreground/40" : "bg-blue-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-semibold ${
                        task.status === "completed"
                          ? "line-through text-muted-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {task.title ?? task.text}
                    </p>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {task.priority && (
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[task.priority] ?? ""}`}>
                          {PRIORITY_LABELS[task.priority ?? ""] ?? task.priority}
                        </span>
                      )}
                      {task.dueDate && (
                        <span className="text-[11px] text-muted-foreground">{formatDate(task.dueDate)}</span>
                      )}
                      {task.tags?.map((tag) => (
                        <span key={tag} className="text-[11px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-border/50 text-xs text-muted-foreground">
            {results.length} result{results.length !== 1 ? "s" : ""} — click to edit
          </div>
        )}
      </div>
    </div>
  );
};
