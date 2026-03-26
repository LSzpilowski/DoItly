import React from "react";
import { useUIStore } from "@/store/uiStore";
import { useNavigate } from "react-router-dom";
import type { View } from "@/store/types";

interface BottomNavProps {
  onOpenBrowse: () => void;
  browseActive: boolean;
}

export const BottomNav = ({ onOpenBrowse, browseActive }: BottomNavProps) => {
  const { currentView, setView, openTaskModal } = useUIStore();
  const navigate = useNavigate();

  const isPlannerView = currentView === "planDay" || currentView === "planWeek" || currentView === "planMonth";

  const setNavView = (view: View) => setView(view);

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border">
        <div className="flex items-end justify-around px-2 pt-2 pb-3">
          {/* All */}
          <NavTab
            label="All"
            isActive={currentView === "all"}
            onClick={() => setNavView("all")}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            }
          />

          {/* Planner — navigates directly to Day Planner */}
          <NavTab
            label="Planner"
            isActive={isPlannerView}
            onClick={() => { setView("planDay"); navigate("/planner"); }}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          />

          {/* Add (center, elevated) */}
          <button
            onClick={() => openTaskModal()}
            className="flex flex-col items-center -mt-5"
            aria-label="Add task"
          >
            <span className="flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-500/30 p-3.5 active:scale-95 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </span>
          </button>

                    {/* Today */}
          <NavTab
            label="Today"
            isActive={currentView === "today"}
            onClick={() => { setNavView("today"); navigate("/today"); }}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707.707M6.343 6.343l-.707.707" />
              </svg>
            }
          />

          {/* Browse */}
          <NavTab
            label="Browse"
            isActive={browseActive || currentView === "category" || currentView === "completed"}
            onClick={onOpenBrowse}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
              </svg>
            }
          />
        </div>
      </nav>
    </>
  );
};

function NavTab({
  label,
  isActive,
  onClick,
  icon,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 min-w-0 flex-1"
      aria-label={label}
    >
      <span
        className={`flex items-center justify-center w-10 h-8 rounded-xl transition-colors ${
          isActive ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {icon}
      </span>
      <span className={`text-[10px] font-medium leading-none ${isActive ? "text-primary" : "text-muted-foreground"}`}>
        {label}
      </span>
    </button>
  );
}
