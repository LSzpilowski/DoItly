import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/app/components/auth/AuthProvider";
import { TasksProvider } from "@/app/components/tasks/TasksProvider";
import { SignInReminder } from "@/app/components/tasks/MigrationDialog";
import { SupabaseStatus } from "@/app/components/SupabaseStatus";
import { AuthCallback } from "@/app/auth/callback/AuthCallback";
import { AccessDeniedScreen } from "@/app/components/auth/AccessDeniedScreen";
const StatisticsPage = React.lazy(() => import("@/app/components/statistics/StatisticsPage"));
import App from "./App";
import "@/styles/globals.css";

// ── Global Error Boundary ─────────────────────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center space-y-4">
            <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
            <p className="text-muted-foreground text-sm">
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Read saved theme from localStorage so the correct theme is applied on first render.
function getSavedTheme(): string {
  try {
    const raw = localStorage.getItem("doitly_settings");
    if (raw) {
      const s = JSON.parse(raw);
      if (s.theme === "light") return "light";
      if (s.theme === "auto") return "system";
      if (s.theme === "dark") return "dark";
    }
  } catch (_e) { /* ignore */ }
  return "dark";
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme={getSavedTheme()} enableSystem>
      <BrowserRouter>
        <AuthProvider>
          <TasksProvider>
            <SignInReminder />
            <SupabaseStatus />
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/all" element={<App />} />
              <Route path="/today" element={<App />} />
              <Route path="/this-week" element={<App />} />
              <Route path="/calendar" element={<App />} />
              <Route path="/completed" element={<App />} />
              <Route path="/overdue" element={<App />} />
              <Route path="/planner" element={<App />} />
              <Route path="/planner-week" element={<App />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/access-denied" element={<AccessDeniedScreen />} />
              <Route path="/statistics" element={<React.Suspense fallback={null}><StatisticsPage /></React.Suspense>} />
            </Routes>
          </TasksProvider>
        </AuthProvider>
      </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
