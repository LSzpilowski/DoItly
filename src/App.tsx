import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Header } from "@/app/components/header";
import { Sidebar } from "@/app/components/Sidebar";
import { TaskList } from "@/app/components/tasks/TaskList";
import { PlannerShell } from "@/app/components/PlannerShell";
import { Footer } from "@/app/components/footer";
const TaskModal = lazy(() => import("@/app/components/modals/TaskModal").then(m => ({ default: m.TaskModal })));
const SearchModal = lazy(() => import("@/app/components/modals/SearchModal").then(m => ({ default: m.SearchModal })));
const FocusModal = lazy(() => import("@/app/components/modals/FocusModal").then(m => ({ default: m.FocusModal })));
const SettingsModal = lazy(() => import("@/app/components/modals/SettingsModal").then(m => ({ default: m.SettingsModal })));
const WorkspaceModal = lazy(() => import("@/app/components/modals/WorkspaceModal").then(m => ({ default: m.WorkspaceModal })));
import { Notifications } from "@/app/components/Notifications";
import { BottomNav } from "@/app/components/BottomNav";
import { MobileCategorySheet } from "@/app/components/MobileCategorySheet";
import { TemplateSheet } from "@/app/components/tasks/displayTasks/templateSheet";
import { TasksHistory } from "@/app/components/tasks/displayTasks/tasksHistory";
import { useTasksStore } from "@/store/tasksStore";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { useRequestNotificationPermission } from "@/hooks/useBrowserNotifications";
import { useOfflineDetector } from "@/hooks/useOfflineDetector";
import type { View } from "@/store/types";

// Map between URL path segments and View ids
const PATH_TO_VIEW: Record<string, View> = {
  "all": "all",
  "today": "today",
  "this-week": "thisWeek",
  "calendar": "calendar",
  "completed": "completed",
  "overdue": "overdue",
  "planner": "planDay",
  "planner-week": "planWeek",
};

const VIEW_TO_PATH: Record<View, string> = {
  all: "/all",
  today: "/today",
  thisWeek: "/this-week",
  calendar: "/calendar",
  completed: "/completed",
  overdue: "/overdue",
  planDay: "/planner",
  planWeek: "/planner-week",
  planMonth: "/planner",
  category: "/all",
};

export default function App() {
  const { getDeletedTasks, clearHistory, tasks: allTasks } = useTasksStore();
  const { user } = useAuthStore();
  const { closeAllModals, currentView, setView, openTaskModal } = useUIStore();

  // Request browser notification permission on first load
  useRequestNotificationPermission();
  useOfflineDetector();

  const navigate = useNavigate();
  const location = useLocation();
  const [browseOpen, setBrowseOpen] = useState(false);
  const historyTasks = getDeletedTasks();

  // Compute overdue count (non-template tasks with status 'overdue')
  const overdueCount = allTasks.filter((t) => t.status === "overdue" && !t.isTemplate).length;

  // On mount: read URL and set view accordingly
  useEffect(() => {
    const segment = location.pathname.replace("/", "").split("/")[0] || "today";
    const view = PATH_TO_VIEW[segment];
    if (view && view !== currentView) {
      setView(view);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // When view changes: update URL (except category view which is internal)
  useEffect(() => {
    const targetPath = VIEW_TO_PATH[currentView] ?? "/today";
    if (currentView !== "category" && location.pathname !== targetPath) {
      navigate(targetPath, { replace: true });
    }
  }, [currentView, navigate, location.pathname]);

  // Redirect away from Overdue view when there are no overdue tasks
  useEffect(() => {
    if (currentView === "overdue" && overdueCount === 0) {
      setView("today");
      navigate("/today", { replace: true });
    }
  }, [currentView, overdueCount, setView, navigate]);

  // Keyboard shortcut: Escape closes modals
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAllModals();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeAllModals]);

  const handleClearHistory = () => clearHistory(user?.id);
  const handleReUseButton = (task: import("@/store/tasksStore").Task) => {
    openTaskModal({ ...task, isTemplate: true });
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-background">
      {/* Fixed header */}
      <Header />

      {/* Main layout: sidebar + content */}
      <div className="flex flex-1 min-h-0">
        <Sidebar />

        {/* Content area */}
        <main className="flex-1 min-w-0 flex flex-col px-4 md:px-6 py-4 md:py-6 pb-24 md:pb-6">
          {/* Toolbar row: Templates + History (desktop) — hidden on planner views */}
          {currentView !== "planDay" && currentView !== "planWeek" && (
            <div className="hidden md:flex items-center gap-3 mb-4">
              <TemplateSheet />
              <TasksHistory
                latestHistoryTasks={historyTasks}
                handleClearHistory={handleClearHistory}
                handleReUseButton={handleReUseButton}
              />
            </div>
          )}

          {/* Main content */}
          {currentView === "planDay" || currentView === "planWeek" ? (
            <PlannerShell initialTab={currentView === "planWeek" ? "week" : "day"} />
          ) : (
            <TaskList />
          )}

          {/* Footer: hidden on mobile — moved to AccountSheet */}
          <div className="hidden md:block">
            <Footer />
          </div>
        </main>
      </div>

      {/* Modals */}
      <Suspense fallback={null}>
        <TaskModal />
        <SearchModal />
        <FocusModal />
        <SettingsModal />
        <WorkspaceModal />
      </Suspense>

      {/* Notifications */}
      <Notifications />

      {/* Mobile bottom nav */}
      <BottomNav
        onOpenBrowse={() => setBrowseOpen(true)}
        browseActive={browseOpen}
      />
      <MobileCategorySheet open={browseOpen} onClose={() => setBrowseOpen(false)} />
    </div>
  );
}
