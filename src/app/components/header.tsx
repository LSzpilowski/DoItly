import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useTasksStore } from "@/store/tasksStore";
import { useUIStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { AuthSheet } from "./auth/AuthSheet";
import { AccountSheet } from "./auth/AccountSheet";
import { TemplateSheet } from "@/app/components/tasks/displayTasks/templateSheet";
import { TasksHistory } from "@/app/components/tasks/displayTasks/tasksHistory";

export const Header = () => {
  const { user } = useAuthStore();
  const { openSearchModal, openFocusModal, openSettingsModal, openWorkspaceModal, setActiveWorkspaceId, setView, openTaskModal } = useUIStore();
  const { workspaces, activeWorkspaceId, setActiveWorkspace } = useWorkspaceStore();
  const navigate = useNavigate();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [burgerOpen, setBurgerOpen] = useState(false);
  const burgerRef = useRef<HTMLDivElement>(null);

  const [accountOpen, setAccountOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { getDeletedTasks, clearHistory } = useTasksStore();
  const historyTasks = getDeletedTasks();
  const handleReUseButton = (task: import("@/store/tasksStore").Task) => {
    openTaskModal({ ...task, isTemplate: true });
  };
  const handleClearHistory = () => clearHistory(user?.id);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  // Close workspace dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  // Close burger on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (burgerRef.current && !burgerRef.current.contains(e.target as Node)) {
        setBurgerOpen(false);
      }
    };
    if (burgerOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [burgerOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        openSearchModal();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openSearchModal]);

  return (
    <header className="sticky top-0 left-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
      <div className="flex items-center justify-between px-4 md:px-6 h-14">
        {/* Logo / Brand */}
        <div className="flex items-center gap-3 md:w-1/4">
          {/* SVG logo — clickable, navigates to All Tasks */}
          <button
            onClick={() => { setView("all"); navigate("/all"); }}
            title="Go to All Tasks"
            aria-label="Go to All Tasks"
            className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity flex-shrink-0 hover:cursor-pointer"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          <div>
            {/* Title — clickable, navigates to All Tasks */}
            <button
              onClick={() => { setView("all"); navigate("/all"); }}
              title="Go to All Tasks"
              aria-label="Go to All Tasks"
              className="text-xl font-bold text-foreground hover:text-primary hover:cursor-pointer transition-colors leading-tight"
            >
              DoItly
            </button>
            {/* Workspace dropdown */}
            <div ref={dropdownRef} className="relative">
                          <button
                            onClick={() => setDropdownOpen((o) => !o)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors group hover:cursor-pointer"
                          >
                            {activeWorkspace && (
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${activeWorkspace.color}`} />
                            )}
                            <span className="max-w-[10rem] truncate">
                              {activeWorkspace?.name ?? "Default"}
                            </span>
                            <svg
                              className={`w-3 h-3 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {dropdownOpen && workspaces.length > 0 && (
                            <div className="absolute top-full left-0 mt-1 z-[60] bg-card border border-border rounded-xl shadow-xl py-1 min-w-[160px]">
                              {workspaces.map((ws) => (
                                <button
                                  key={ws.id}
                                  onClick={() => {
                                    setActiveWorkspace(ws.id);
                                    setActiveWorkspaceId(ws.id);
                                    setDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:cursor-pointer ${
                                    ws.id === activeWorkspaceId
                                      ? "bg-primary/8 text-foreground font-medium"
                                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                  }`}
                                >
                                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${ws.color}`} />
                                  <span className="truncate">{ws.name}</span>
                                  {ws.id === activeWorkspaceId && (
                                    <svg className="w-3 h-3 ml-auto text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                    </div>
                </div>

        {/* Center actions */}
        <div className="flex w-full justify-end md:justify-center items-center gap-1">
          {/* Search — always visible */}
          <button
            onClick={openSearchModal}
            title="Search (Ctrl+K)"
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="hidden sm:inline">Search</span>
          </button>

          {/* Focus Mode — always visible */}
          <button
            onClick={openFocusModal}
            title="Focus Mode"
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>

          {/* Workspace — desktop only */}
          <button
            onClick={openWorkspaceModal}
            title="Workspaces & Teams"
            className="hidden md:flex p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* Settings — desktop only */}
          <button
            onClick={openSettingsModal}
            title="Settings"
            className="hidden md:flex p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* Burger — mobile only: Account, Workspaces & Teams, Settings, Templates, History */}
          <div ref={burgerRef} className="relative md:hidden">
            <button
              onClick={() => setBurgerOpen((o) => !o)}
              title="More"
              aria-label="More options"
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {burgerOpen && (
              <div className="absolute top-full right-0 mt-2 z-[70] bg-card border border-border rounded-xl shadow-xl py-2 w-52">
                {/* Account */}
                <button
                  onClick={() => { setBurgerOpen(false); setAccountOpen(true); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Account
                </button>
                <div className="mx-2 my-1 border-t border-border/50" />
                {/* Workspaces & Teams */}
                <button
                  onClick={() => { setBurgerOpen(false); openWorkspaceModal(); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Workspaces &amp; Teams
                </button>
                {/* Settings */}
                <button
                  onClick={() => { setBurgerOpen(false); openSettingsModal(); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </button>
                <div className="mx-2 my-1 border-t border-border/50" />
                {/* Templates */}
                <button
                  onClick={() => { setBurgerOpen(false); setTemplatesOpen(true); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 2v5a1 1 0 0 0 1 1h5" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9H8" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 13H8" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 17H8" />
                  </svg>
                  Templates
                </button>
                {/* History */}
                <button
                  onClick={() => { setBurgerOpen(false); setHistoryOpen(true); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v5h5" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v5l4 2" />
                  </svg>
                  History
                  {historyTasks.length > 0 && (
                    <span className="ml-auto text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                      {historyTasks.length}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Controlled sheets for burger menu — no DOM output when isControlled (SheetTrigger not rendered) */}
          {user
            ? <AccountSheet open={accountOpen} onOpenChange={setAccountOpen} />
            : <AuthSheet open={accountOpen} onOpenChange={setAccountOpen} />
          }
          <TemplateSheet open={templatesOpen} onOpenChange={setTemplatesOpen} />
          <TasksHistory
            open={historyOpen}
            onOpenChange={setHistoryOpen}
            latestHistoryTasks={historyTasks}
            handleClearHistory={handleClearHistory}
            handleReUseButton={handleReUseButton}
          />
        </div>

        {/* Auth — desktop only (mobile: via Burger) */}
        <div className="flex items-center gap-3 md:w-1/4 justify-end">
          <div className="hidden md:block">
            {user ? <AccountSheet /> : <AuthSheet />}
          </div>
        </div>
      </div>
    </header>
  );
};

