import { useState } from "react";
import { DayPlanningView } from "./DayPlanningView";
import { WeekPlanningView } from "./WeekPlanningView";

type PlannerTab = "day" | "week";

const TABS: { id: PlannerTab; label: string; }[] = [
  { id: "day",  label: "Day"},
  { id: "week", label: "Week"},
];

interface PlannerShellProps {
  /** Optionally open to a specific tab (e.g. "week") */
  initialTab?: PlannerTab;
}

export const PlannerShell = ({ initialTab = "day" }: PlannerShellProps) => {
  const [tab, setTab] = useState<PlannerTab>(initialTab);

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-muted rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:cursor-pointer ${
              tab === t.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "day"  && <DayPlanningView />}
      {tab === "week" && <WeekPlanningView />}
    </div>
  );
};
