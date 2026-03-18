import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/app/components/auth/AuthProvider";
import { TasksProvider } from "@/app/components/tasks/TasksProvider";
import { SignInReminder } from "@/app/components/tasks/MigrationDialog";
import { SupabaseStatus } from "@/app/components/SupabaseStatus";
import { AuthCallback } from "@/app/auth/callback/AuthCallback";
import { AccessDeniedScreen } from "@/app/components/auth/AccessDeniedScreen";
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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <TasksProvider>
              <SignInReminder />
              <SupabaseStatus />
              <Routes>
                <Route path="/" element={<App />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/access-denied" element={<AccessDeniedScreen />} />
              </Routes>
            </TasksProvider>
          </AuthProvider>
        </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
