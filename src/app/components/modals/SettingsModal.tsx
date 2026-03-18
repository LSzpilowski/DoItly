import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useUIStore } from "@/store/uiStore";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { AppSettings } from "@/store/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}

function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 hover:cursor-pointer ${
          checked ? "bg-primary" : "bg-muted"
        }`}
        role="switch"
        aria-checked={checked}
        aria-label={label}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export const SettingsModal = () => {
  const { modals, settings, closeAllModals, updateSettings, showNotification } = useUIStore();
  const { setTheme } = useTheme();
  const isOpen = modals.settings;
  useBodyScrollLock(isOpen);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<AppSettings>({ ...settings });

  // Reset form to latest settings each time modal is opened
  const prevIsOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({ ...settings });
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, settings]);

  const handleSave = () => {
    updateSettings(form);
    // Ensure theme is applied (may already be set via live preview)
    const themeMap: Record<string, string> = { dark: "dark", light: "light", auto: "system" };
    setTheme(themeMap[form.theme] ?? form.theme);
    showNotification("Settings saved", "success");
    closeAllModals();
  };

  const handleExport = () => {
    const STORAGE_KEY = "doitly_tasks_v2";
    const raw = localStorage.getItem(STORAGE_KEY);
    const blob = new Blob([raw ?? "[]"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "doitly-backup.json";
    a.click();
    URL.revokeObjectURL(url);
    showNotification("Data exported!", "success");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        if (typeof data === "string") {
          localStorage.setItem("doitly_tasks_v2", data);
          showNotification("Data imported! Refresh to see changes.", "info");
        }
      } catch {
        showNotification("Import failed", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleClear = () => {
    localStorage.removeItem("doitly_tasks_v2");
    showNotification("Local data cleared", "info");
    closeAllModals();
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && closeAllModals()}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-xl font-bold text-foreground">Settings</h3>
          <button onClick={closeAllModals} className="p-2 hover:bg-accent rounded-lg transition-colors text-muted-foreground hover:cursor-pointer" aria-label="Close settings">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Theme */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Theme</label>
            <select
              value={form.theme}
              onChange={(e) => {
                const newTheme = e.target.value as AppSettings["theme"];
                setForm((f) => ({ ...f, theme: newTheme }));
                // Apply immediately as live preview
                const themeMap: Record<string, string> = { dark: "dark", light: "light", auto: "system" };
                setTheme(themeMap[newTheme] ?? newTheme);
              }}
              className="w-full px-3 pr-8 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:cursor-pointer transition-colors"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="auto">Auto (System)</option>
            </select>
          </div>

          {/* Toggles */}
          <div className="space-y-4">
            <Toggle
              label="Browser Notifications"
              description="Get notified when tasks are due"
              checked={form.notifications}
              onChange={(v) => setForm((f) => ({ ...f, notifications: v }))}
            />
            <Toggle
              label="Sound Alerts"
              description="Play sound when Pomodoro timer ends"
              checked={form.soundAlerts}
              onChange={(v) => setForm((f) => ({ ...f, soundAlerts: v }))}
            />
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-200 hover:cursor-pointer"
          >
            Save Settings
          </button>

          {/* Data management */}
          <div className="border-t border-border pt-5 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Data Management
            </p>
            <button
              onClick={handleExport}
              className="w-full flex items-center gap-2 px-4 py-2.5 bg-muted text-muted-foreground rounded-lg font-medium hover:bg-accent transition-colors text-sm hover:cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Backup (JSON)
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center gap-2 px-4 py-2.5 bg-muted text-muted-foreground rounded-lg font-medium hover:bg-accent transition-colors text-sm hover:cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
              </svg>
              Import Backup
            </button>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="w-full flex items-center gap-2 px-4 py-2.5 bg-red-700/80 text-red-300 rounded-lg font-medium hover:bg-red-700/60 transition-colors text-sm hover:cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear Local Data
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all local data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete <strong>all local tasks</strong>. This action cannot be undone. Make sure you have exported a backup first.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClear}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Yes, clear all data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
};
