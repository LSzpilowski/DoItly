import { useState } from "react";
import { useUIStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useTasksStore } from "@/store/tasksStore";
import { useNavigate } from "react-router-dom";
import type { View } from "@/store/types";

const MAX_CATEGORIES = 6;

interface MobileCategorySheetProps {
  open: boolean;
  onClose: () => void;
}

const VIEWS_LIST: { id: View; label: string; path: string; icon: React.ReactNode }[] = [
  {
    id: "all",
    label: "All Tasks",
    path: "/all",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  {
    id: "today",
    label: "Today",
    path: "/today",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707.707M6.343 6.343l-.707.707" />
      </svg>
    ),
  },
  {
    id: "thisWeek",
    label: "This Week",
    path: "/this-week",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "calendar",
    label: "Calendar",
    path: "/calendar",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "completed",
    label: "Completed",
    path: "/completed",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export const MobileCategorySheet = ({ open, onClose }: MobileCategorySheetProps) => {
  const {
    currentView, currentCategory,
    setView, setCategory,
    categories, addCategory, removeCategory,
    openWorkspaceModal,
  } = useUIStore();
  const { workspaces, activeWorkspaceId, setActiveWorkspace } = useWorkspaceStore();
  const navigate = useNavigate();

  const tasks = useTasksStore((s) => s.tasks);
  const overdueCount = tasks.filter((t) => t.status === "overdue" && !t.isTemplate).length;

  const [adding, setAdding] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  if (!open) return null;

  const handleAdd = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    addCategory(trimmed);
    setNewCatName("");
    setAdding(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border rounded-t-2xl p-5 space-y-4 pb-24">
        <div className="w-10 h-1 bg-muted rounded-full mx-auto -mt-1 mb-2" />
        <h3 className="text-base font-bold text-foreground">Browse</h3>

        {/* Workspace switcher */}
        {workspaces.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
              Workspace
            </p>
            <div className="space-y-1">
              {workspaces.map((ws) => {
                const isWsActive = ws.id === activeWorkspaceId;
                return (
                  <button
                    key={ws.id}
                    onClick={() => setActiveWorkspace(ws.id)}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                      isWsActive ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${ws.color}`} />
                    <span className="flex-1 text-left truncate">{ws.name}</span>
                    {isWsActive && (
                      <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-semibold">Active</span>
                    )}
                  </button>
                );
              })}
              <button
                onClick={() => { openWorkspaceModal(); onClose(); }}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Manage workspaces
              </button>
            </div>
          </div>
        )}

        {/* Views */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
            Views
          </p>
          <div className="space-y-1">
            {VIEWS_LIST.map((view) => {
              const isActive = currentView === view.id;
              return (
                <button
                  key={view.id}
                  onClick={() => { setView(view.id); navigate(view.path); onClose(); }}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                  }`}
                >
                  {view.icon}
                  {view.label}
                </button>
              );
            })}
            {overdueCount > 0 && (
              <button
                onClick={() => { setView("overdue"); navigate("/overdue"); onClose(); }}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  currentView === "overdue"
                    ? "bg-red-500/15 text-red-600 dark:text-red-400"
                    : "text-red-500/70 hover:text-red-600 hover:bg-red-500/10"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Overdue
                <span className="ml-auto text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5 font-semibold">{overdueCount}</span>
              </button>
            )}
          </div>
        </div>

        {/* Categories */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Categories <span className="font-normal normal-case">({categories.length}/{MAX_CATEGORIES})</span>
            </p>
          </div>
          <div className="space-y-1">
            {categories.map((cat) => {
              const isActive = currentView === "category" && currentCategory === cat.name;
              return (
                <div key={cat.id} className="group flex items-center">
                  <button
                    onClick={() => { setCategory(cat.name); onClose(); }}
                    className={`flex items-center gap-3 flex-1 min-w-0 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                      isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cat.color}`} />
                    <span className="truncate">{cat.name}</span>
                  </button>
                  <button
                    onClick={() => removeCategory(cat.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 mr-1 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all cursor-pointer"
                    aria-label={`Remove ${cat.name}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Add category */}
          {adding ? (
            <div className="mt-2 space-y-2">
              <input
                autoFocus
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setAdding(false); setNewCatName(""); } }}
                placeholder="Category name…"
                maxLength={20}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="flex gap-2">
                <button onClick={handleAdd} disabled={!newCatName.trim()} className="flex-1 py-2 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 cursor-pointer">Add</button>
                <button onClick={() => { setAdding(false); setNewCatName(""); }} className="flex-1 py-2 text-sm font-medium rounded-xl border border-border hover:bg-accent cursor-pointer">Cancel</button>
              </div>
            </div>
          ) : (
            categories.length < MAX_CATEGORIES && (
              <button
                onClick={() => setAdding(true)}
                className="flex items-center gap-2 w-full mt-1 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Add Category
              </button>
            )
          )}
        </div>
      </div>
    </>
  );
};
