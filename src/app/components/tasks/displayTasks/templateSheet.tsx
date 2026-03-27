"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { FileText, Plus, RotateCcw, Trash2, ChevronDown } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import { useTasksStore } from "@/store/tasksStore";
import { useUIStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import type { Priority, Repeat, TaskFormState } from "@/store/types";

const PRIORITIES: Priority[] = ["low", "medium", "high"];
const REPEATS: Repeat[] = ["none", "daily", "weekly", "monthly"];

const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Nice to have",
  medium: "Should have",
  high: "Must have",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  low: "text-green-600 dark:text-green-400",
  medium: "text-amber-600 dark:text-amber-400",
  high: "text-red-600 dark:text-red-400",
};

const EMPTY_FORM: TaskFormState = {
  title: "",
  description: "",
  dueDate: "",
  priority: "medium",
  workspace: "",
  category: "",
  repeat: "none",
  tags: "",
  notes: "",
  subtasks: [],
};

interface TemplateSheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const TemplateSheet: React.FC<TemplateSheetProps> = ({ open: controlledOpen, onOpenChange }) => {
  const { user } = useAuthStore();
  const tasksStore = useTasksStore();
  const { openTaskModal } = useUIStore();

  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const effectiveOpen = controlledOpen !== undefined ? controlledOpen : isOpen;
  const handleOpenChange = (val: boolean) => {
    setIsOpen(val);
    onOpenChange?.(val);
  };
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState<TaskFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState({ subtitle: "" });
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    const msgs = [
      { subtitle: "Save tasks you often reuse." },
      { subtitle: "Templates help you move faster later." },
      { subtitle: "Turn repeating tasks into one-click actions." },
      { subtitle: "Create once, reuse anytime." },
    ];
    React.startTransition(() => {
      setMounted(true);
      setMessage(msgs[Math.floor(Math.random() * msgs.length)]);
      setTimeout(() => setShowMessage(true), 100);
    });
  }, []);

  const templates = mounted ? tasksStore.getTemplates() : [];

  const setField = <K extends keyof TaskFormState>(key: K, val: TaskFormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || form.title.trim().length < 3) {
      setFormError("Title must be at least 3 characters.");
      return;
    }
    setFormError("");
    await tasksStore.createTemplateRich(form, user?.id);
    setForm(EMPTY_FORM);
    setShowCreateForm(false);
  };

  const handleUseTemplate = (templateId: string) => {
    const template = tasksStore.getTemplates().find((t) => t.id === templateId);
    if (!template) return;
    // Pre-fill the Add Task modal with template data (opens as new task, not edit)
    openTaskModal(template);
    setIsOpen(false);
  };

  const handleRemoveTemplate = async (templateId: string) => {
    await tasksStore.removeTemplate(templateId, user?.id);
  };

  const isControlled = controlledOpen !== undefined && onOpenChange !== undefined;

  return (
    <Sheet open={effectiveOpen} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <SheetTrigger asChild>
          <Button variant="outline" size="lg" className="gap-2 hover:bg-accent" aria-label="Open templates">
            <FileText className="h-5 w-5" />
            Templates
            {mounted && templates.length > 0 && (
              <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                {templates.length}
              </span>
            )}
          </Button>
        </SheetTrigger>
      )}

      <SheetContent side="left" className="max-h-screen w-full sm:max-w-lg bg-background flex flex-col overflow-hidden">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>Task Templates</SheetTitle>
          <SheetDescription>
            Create reusable task templates for common activities.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-4 flex-1 overflow-hidden">
          {/* Toggle create form */}
          <Button
            variant="outline"
            className="w-full gap-2 justify-between flex-shrink-0"
            onClick={() => setShowCreateForm((v) => !v)}
          >
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Template
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showCreateForm ? "rotate-180" : ""}`} />
          </Button>

          {/* Create Template Form */}
          {showCreateForm && (
            <form onSubmit={handleCreateTemplate} className="space-y-3 border border-border rounded-xl p-4 bg-muted/20 flex-shrink-0 overflow-y-auto max-h-[50vh]">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="Template name..."
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  minLength={3}
                  maxLength={70}
                  className="text-sm"
                />
                {formError && <p className="text-xs text-red-500 mt-1">{formError}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  placeholder="Optional description..."
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              {/* Priority + Repeat row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setField("priority", e.target.value as Priority)}
                    className="w-full px-3 pr-8 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:cursor-pointer"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Repeat</label>
                  <select
                    value={form.repeat}
                    onChange={(e) => setField("repeat", e.target.value as Repeat)}
                    className="w-full px-3 pr-8 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:cursor-pointer"
                  >
                    {REPEATS.map((r) => (
                      <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Category</label>
                <Input
                  type="text"
                  placeholder="e.g. Work, Personal..."
                  value={form.category}
                  onChange={(e) => setField("category", e.target.value)}
                  className="text-sm"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Tags <span className="text-muted-foreground font-normal">(comma-separated)</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. design, review..."
                  value={form.tags}
                  onChange={(e) => setField("tags", e.target.value)}
                  className="text-sm"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  placeholder="Additional notes..."
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button type="submit" className="flex-1 gap-2 bg-primary text-primary-foreground hover:opacity-90">
                  <Plus className="h-4 w-4" />
                  Save Template
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setShowCreateForm(false); setForm(EMPTY_FORM); setFormError(""); }}
                  className="hover:bg-accent"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Templates List */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {mounted && templates.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Your Templates ({templates.length})
                </h3>
                <ul className="flex flex-col gap-2">
                  {templates.map((template) => (
                    <Card key={template.id} className="group transition-all hover:shadow-md hover:bg-accent border-2">
                      <div className="p-3 flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <span className="block text-sm font-medium break-words">
                            {template.title ?? template.text}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {template.priority && (
                              <span className={`text-[11px] font-medium ${PRIORITY_COLORS[template.priority as Priority] ?? "text-muted-foreground"}`}>
                                {PRIORITY_LABELS[template.priority as Priority] ?? template.priority}
                              </span>
                            )}
                            {template.category && (
                              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                                {template.category}
                              </span>
                            )}
                            {template.repeat && template.repeat !== "none" && (
                              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                                {template.repeat}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            onClick={() => handleUseTemplate(template.id)}
                            size="sm"
                            variant="outline"
                            className="gap-1 hover:bg-accent"
                            aria-label="Use template"
                          >
                            <RotateCcw className="h-4 w-4" />
                            Use
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 hover:bg-accent"
                                aria-label="Remove template"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Template?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  <span className="block">Are you sure you want to remove this template? This action cannot be undone.</span>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="hover:bg-accent">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemoveTemplate(template.id)}
                                  className="hover:bg-red-600/50 text-white border-1"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </Card>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                <p className="text-muted-foreground text-lg mt-4">No templates yet</p>
                <p className={`text-sm text-muted-foreground mt-1 transition-opacity duration-500 ${showMessage ? "opacity-100" : "opacity-0"}`}>
                  {message.subtitle}
                </p>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
