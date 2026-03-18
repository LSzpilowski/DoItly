import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTasksStore } from "@/store/tasksStore";
import { usePomodoroStore } from "@/store/pomodoroStore";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, RadialBarChart, RadialBar,
} from "recharts";

// ── helpers ──────────────────────────────────────────────────────────────────

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const PALETTE = {
  created:   "#3b82f6",  // blue
  completed: "#22c55e",  // green
  deleted:   "#ef4444",  // red
  archived:  "#a78bfa",  // violet
  pomStart:  "#f59e0b",  // amber
  pomEnd:    "#10b981",  // emerald
};

interface ChartEntry {
  label: string;        // "day" or "month" unified as "label"
  created: number;
  completed: number;
  deleted: number;
  archived: number;
  pomStarted: number;
  pomCompleted: number;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

// ── Chart dataset checkboxes ─────────────────────────────────────────────────
interface DatasetKey {
  key: string;
  label: string;
  color: string;
}

const TASK_DATASETS: DatasetKey[] = [
  { key: "created",   label: "Created",   color: PALETTE.created },
  { key: "completed", label: "Completed", color: PALETTE.completed },
  { key: "deleted",   label: "Deleted",   color: PALETTE.deleted },
  { key: "archived",  label: "Archived",  color: PALETTE.archived },
];

const POM_DATASETS: DatasetKey[] = [
  { key: "started",   label: "Started",   color: PALETTE.pomStart },
  { key: "completed", label: "Completed", color: PALETTE.pomEnd },
];

function DatasetCheckboxes({
  datasets,
  enabled,
  onChange,
}: {
  datasets: DatasetKey[];
  enabled: Set<string>;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {datasets.map((d) => (
        <label key={d.key} className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enabled.has(d.key)}
            onChange={() => onChange(d.key)}
            className="w-3.5 h-3.5 rounded accent-[var(--primary)]"
            style={{ accentColor: d.color }}
          />
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
            {d.label}
          </span>
        </label>
      ))}
    </div>
  );
}

// ── Shared card wrapper ───────────────────────────────────────────────────────
function ChartCard({
  title,
  subtitle,
  children,
  datasets,
  enabledDatasets,
  onToggleDataset,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  datasets?: DatasetKey[];
  enabledDatasets?: Set<string>;
  onToggleDataset?: (key: string) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {datasets && enabledDatasets && onToggleDataset && (
          <DatasetCheckboxes datasets={datasets} enabled={enabledDatasets} onChange={onToggleDataset} />
        )}
      </div>
      {children}
    </div>
  );
}

// ── Tooltip styling ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-bold text-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StatisticsPage() {
  const navigate = useNavigate();
  const { tasks } = useTasksStore();
  const { sessions: pomSessions } = usePomodoroStore();

  const [viewMode, setViewMode] = useState<"monthly" | "yearly">("monthly");
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth()); // 0-indexed

  // Checkbox state
  const [taskDatasets, setTaskDatasets] = useState<Set<string>>(new Set(["created", "completed"]));
  const [pomDatasets, setPomDatasets] = useState<Set<string>>(new Set(["started", "completed"]));

  const toggleTask = (key: string) => setTaskDatasets((prev) => {
    const n = new Set(prev);
    if (n.has(key)) { n.delete(key); } else { n.add(key); }
    return n;
  });
  const togglePom = (key: string) => setPomDatasets((prev) => {
    const n = new Set(prev);
    if (n.has(key)) { n.delete(key); } else { n.add(key); }
    return n;
  });

  // ── Monthly data: per-day of selected month ──────────────────────────────
  const monthlyData = useMemo((): ChartEntry[] => {
    const days = getDaysInMonth(selectedYear, selectedMonth);
    const prefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;

    return Array.from({ length: days }, (_, i) => {
      const day = i + 1;
      const dateStr = `${prefix}-${String(day).padStart(2, "0")}`;
      const nonTemplates = tasks.filter((t) => !t.isTemplate);

      return {
        label: String(day),
        created:   nonTemplates.filter((t) => t.createdAt?.startsWith(dateStr)).length,
        completed: nonTemplates.filter((t) => t.status === "completed" && t.completedAt?.startsWith(dateStr)).length,
        deleted:   nonTemplates.filter((t) => t.status === "deleted"   && t.deletedAt?.startsWith(dateStr)).length,
        archived:  nonTemplates.filter((t) => t.status === "archived"  && t.archivedAt?.startsWith(dateStr)).length,
        pomStarted:   pomSessions.filter((s) => !s.isBreak && s.startedAt?.startsWith(dateStr)).length,
        pomCompleted: pomSessions.filter((s) => !s.isBreak && s.isEnded && s.startedAt?.startsWith(dateStr)).length,
      };
    });
  }, [tasks, pomSessions, selectedYear, selectedMonth]);

  // ── Yearly data: per-month of selected year ──────────────────────────────
  const yearlyData = useMemo((): ChartEntry[] => {
    return MONTHS_SHORT.map((monthLabel, mi) => {
      const prefix = `${selectedYear}-${String(mi + 1).padStart(2, "0")}`;
      const nonTemplates = tasks.filter((t) => !t.isTemplate);

      return {
        label: monthLabel,
        created:   nonTemplates.filter((t) => t.createdAt?.startsWith(prefix)).length,
        completed: nonTemplates.filter((t) => (t.status === "completed" && t.completedAt?.startsWith(prefix)) || (t.status === "archived" && t.archivedAt?.startsWith(prefix))).length,
        deleted:   nonTemplates.filter((t) => t.status === "deleted" && t.deletedAt?.startsWith(prefix)).length,
        archived:  nonTemplates.filter((t) => t.status === "archived" && t.archivedAt?.startsWith(prefix)).length,
        pomStarted:   pomSessions.filter((s) => !s.isBreak && s.startedAt?.startsWith(prefix)).length,
        pomCompleted: pomSessions.filter((s) => !s.isBreak && s.isEnded && s.startedAt?.startsWith(prefix)).length,
      };
    });
  }, [tasks, pomSessions, selectedYear]);

  const data: ChartEntry[] = viewMode === "monthly" ? monthlyData : yearlyData;

  // ── KPI summary cards ─────────────────────────────────────────────────────
  const totalCreated   = data.reduce((s, d) => s + d.created, 0);
  const totalCompleted = data.reduce((s, d) => s + d.completed, 0);
  const totalDeleted   = data.reduce((s, d) => s + d.deleted, 0);
  const totalPomStart  = data.reduce((s, d) => s + d.pomStarted, 0);
  const totalPomEnd    = data.reduce((s, d) => s + d.pomCompleted, 0);
  const completionRate = totalCreated > 0 ? Math.round((totalCompleted / totalCreated) * 100) : 0;

  // ── Pie chart — task status breakdown (all time) ──────────────────────────
  const nonTemplates = tasks.filter((t) => !t.isTemplate);
  const pieData = [
    { name: "Active",    value: nonTemplates.filter((t) => t.status === "active" || t.status === "inProgress").length,    fill: PALETTE.created },
    { name: "Completed", value: nonTemplates.filter((t) => t.status === "completed").length, fill: PALETTE.completed },
    { name: "Archived",  value: nonTemplates.filter((t) => t.status === "archived").length,  fill: PALETTE.archived },
    { name: "Deleted",   value: nonTemplates.filter((t) => t.status === "deleted").length,   fill: PALETTE.deleted },
  ].filter((d) => d.value > 0);

  // ── Priority breakdown ────────────────────────────────────────────────────
  const priorityData = [
    { name: "High",   value: nonTemplates.filter((t) => t.priority === "high"   && (t.status === "active" || t.status === "inProgress")).length, fill: "#ef4444" },
    { name: "Medium", value: nonTemplates.filter((t) => t.priority === "medium" && (t.status === "active" || t.status === "inProgress")).length, fill: "#f59e0b" },
    { name: "Low",    value: nonTemplates.filter((t) => t.priority === "low"    && (t.status === "active" || t.status === "inProgress")).length, fill: "#22c55e" },
    { name: "None",   value: nonTemplates.filter((t) => !t.priority             && (t.status === "active" || t.status === "inProgress")).length, fill: "#94a3b8" },
  ].filter((d) => d.value > 0);

  // ── Available years ───────────────────────────────────────────────────────
  const years = useMemo(() => {
    const ys = new Set<number>();
    ys.add(new Date().getFullYear());
    tasks.forEach((t) => {
      if (t.createdAt) ys.add(new Date(t.createdAt).getFullYear());
    });
    return Array.from(ys).sort((a, b) => b - a);
  }, [tasks]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header bar */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground hover:cursor-pointer"
          aria-label="Go back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Full Statistics</h1>
          <p className="text-xs text-muted-foreground hidden sm:block">All your productivity data in one place</p>
        </div>

        {/* Period toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setViewMode("monthly")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors hover:cursor-pointer ${viewMode === "monthly" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setViewMode("yearly")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors hover:cursor-pointer ${viewMode === "yearly" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Yearly
          </button>
        </div>

        {/* Year / Month selectors */}
        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-xs bg-muted text-foreground rounded-lg px-2 pr-7 py-1.5 border-0 outline-none cursor-pointer"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          {viewMode === "monthly" && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="text-xs bg-muted text-foreground rounded-lg px-2 pr-7 py-1.5 border-0 outline-none cursor-pointer"
            >
              {MONTHS_SHORT.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* ── KPI row ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: "Created",        value: totalCreated,    color: PALETTE.created},
            { label: "Completed",      value: totalCompleted,  color: PALETTE.completed},
            { label: "Deleted",        value: totalDeleted,    color: PALETTE.deleted},
            { label: "Completion %",   value: `${completionRate}%`, color: "#a78bfa", },
            { label: "Pomodoros",      value: `${totalPomEnd}/${totalPomStart}`, color: PALETTE.pomStart},
          ].map((kpi) => (
            <div key={kpi.label} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1">
              <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* ── Task Activity — Area chart ───────────────────────────────────── */}
        <ChartCard
          title="Task Activity"
          subtitle={viewMode === "monthly" ? `Each day of ${MONTHS_SHORT[selectedMonth]} ${selectedYear}` : `Each month of ${selectedYear}`}
          datasets={TASK_DATASETS}
          enabledDatasets={taskDatasets}
          onToggleDataset={toggleTask}
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                {TASK_DATASETS.map((d) => (
                  <linearGradient key={d.key} id={`grad-${d.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={d.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={d.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              {TASK_DATASETS.filter((d) => taskDatasets.has(d.key)).map((d) => (
                <Area
                  key={d.key} type="monotone" dataKey={d.key} name={d.label}
                  stroke={d.color} fill={`url(#grad-${d.key})`}
                  strokeWidth={2} dot={false} activeDot={{ r: 4 }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* ── Created vs Completed — Bar chart ─────────────────────────────── */}
        <ChartCard
          title="Created vs Completed"
          subtitle="Side-by-side comparison per period"
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="created"   name="Created"   fill={PALETTE.created}   radius={[4,4,0,0]} />
              <Bar dataKey="completed" name="Completed" fill={PALETTE.completed} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* ── Pomodoro Sessions — Line chart ───────────────────────────────── */}
        <ChartCard
          title="Pomodoro Sessions"
          subtitle="Work sessions started vs fully completed"
          datasets={POM_DATASETS}
          enabledDatasets={pomDatasets}
          onToggleDataset={togglePom}
        >
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              {pomDatasets.has("started") && (
                <Line type="monotone" dataKey="pomStarted" name="Started" stroke={PALETTE.pomStart} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              )}
              {pomDatasets.has("completed") && (
                <Line type="monotone" dataKey="pomCompleted" name="Completed" stroke={PALETTE.pomEnd} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* ── Two-column: Pie + Priority ──────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Task status breakdown — Pie */}
          <ChartCard
            title="Task Status Breakdown"
            subtitle="All-time distribution"
          >
            {pieData.length > 0 ? (
              <div className="flex flex-col items-center gap-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData} cx="50%" cy="50%"
                      innerRadius={55} outerRadius={85}
                      paddingAngle={3} dataKey="value"
                    >
                      {pieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [value, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-3">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.fill }} />
                      <span className="text-muted-foreground">{d.name}: </span>
                      <span className="font-bold">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground text-sm py-8">No data yet</p>
            )}
          </ChartCard>

          {/* Priority breakdown — Radial */}
          <ChartCard
            title="Active Tasks by Priority"
            subtitle="Current active task distribution"
          >
            {priorityData.length > 0 ? (
              <div className="flex flex-col items-center gap-4">
                <ResponsiveContainer width="100%" height={200}>
                  <RadialBarChart
                    cx="50%" cy="50%"
                    innerRadius={30} outerRadius={90}
                    data={priorityData} startAngle={180} endAngle={0}
                  >
                    <RadialBar
                      dataKey="value"
                      cornerRadius={6}
                      label={{ position: "insideStart", fill: "#fff", fontSize: 11 }}
                    />
                    <Legend
                      iconSize={10}
                      layout="horizontal"
                      verticalAlign="bottom"
                      formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
                    />
                    <Tooltip formatter={(value, name) => [value, name]} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center text-muted-foreground text-sm py-8">No active tasks</p>
            )}
          </ChartCard>
        </div>

        {/* ── Cumulative completion trend — Area ──────────────────────────── */}
        {viewMode === "yearly" && (
          <ChartCard
            title="Cumulative Progress"
            subtitle="Running total of completed tasks through the year"
          >
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={yearlyData.reduce<{ label: string; total: number }[]>((acc, d, i) => {
                  const prev = acc[i - 1]?.total ?? 0;
                  acc.push({ label: d.label, total: prev + d.completed });
                  return acc;
                }, [])}
                margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="grad-cumulative" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={PALETTE.completed} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={PALETTE.completed} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="total" name="Total Completed" stroke={PALETTE.completed} fill="url(#grad-cumulative)" strokeWidth={2.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

      </div>
    </div>
  );
}
