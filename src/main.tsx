import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/app/theme-provider";
import { AuthProvider } from "@/app/components/auth/AuthProvider";
import { TasksProvider } from "@/app/components/tasks/TasksProvider";
import { SignInReminder } from "@/app/components/tasks/MigrationDialog";
import { SupabaseStatus } from "@/app/components/SupabaseStatus";
import { AuthCallback } from "@/app/auth/callback/AuthCallback";
import App from "./App";
import "@/styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system">
      <BrowserRouter>
        <AuthProvider>
          <TasksProvider>
            <SignInReminder />
            <SupabaseStatus />
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
            </Routes>
          </TasksProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
