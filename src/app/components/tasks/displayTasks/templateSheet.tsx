import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { FileText, Plus, RotateCcw, Trash2 } from "lucide-react";
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
import { useAuthStore } from "@/store/authStore";

export const TemplateSheet: React.FC = () => {
  const { user } = useAuthStore();
  const tasksStore = useTasksStore();
  const [mounted, setMounted] = useState(false);
  const [templateInput, setTemplateInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState({
    subtitle: "",
  });
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    const templateEmptyMessages = [
      {
        subtitle: "Save tasks you often reuse.",
      },
      {
        subtitle: "Templates help you move faster later.",
      },
      {
        subtitle: "Turn repeating tasks into one-click actions.",
      },
      {
        subtitle: "Create once, reuse anytime.",
      },
    ];

    React.startTransition(() => {
      setMounted(true);
      setMessage(templateEmptyMessages[Math.floor(Math.random() * templateEmptyMessages.length)]);
      setTimeout(() => setShowMessage(true), 100);
    });
  }, []);

  const templates = mounted ? tasksStore.getTemplates() : [];

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = templateInput.trim();
    if (trimmedInput.length >= 3) {
      await tasksStore.createTemplate(trimmedInput, user?.id);
      setTemplateInput("");
    }
  };

  const handleUseTemplate = async (templateId: string) => {
    await tasksStore.useTemplate(templateId, user?.id);
    setIsOpen(false);
  };

  const handleRemoveTemplate = async (templateId: string) => {
    await tasksStore.removeTemplate(templateId, user?.id);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="lg" className="gap-2 hover:bg-white/10" aria-label="Open templates">
          <FileText className="h-5 w-5" />
          Templates
          {mounted && templates.length > 0 && (
            <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
              {templates.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="max-h-screen w-full sm:max-w-lg bg-gradient-to-br from-black to-gray-900">
        <SheetHeader>
          <SheetTitle>Task Templates</SheetTitle>
          <SheetDescription>
            Create reusable task templates for common activities.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Create Template Form */}
          <form onSubmit={handleCreateTemplate} className="flex gap-2">
            <Input
              type="text"
              placeholder="Enter template name..."
              value={templateInput}
              onChange={(e) => setTemplateInput(e.target.value)}
              minLength={3}
              maxLength={70}
              className="flex-1"
              aria-label="Template name"
            />
            <Button type="submit" className="gap-2 bg-black/50 dark:bg-white text-white dark:text-black hover:bg-black/70 dark:hover:bg-white/90">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </form>

          {/* Templates List */}
          {mounted && templates.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Your Templates ({templates.length})
              </h3>
              <ul className="flex flex-col gap-2">
                {templates.map((template) => (
                  <Card key={template.id} className="group transition-all hover:shadow-md hover:bg-black/10 dark:hover:bg-white/10 border-2">
                    <div className="p-3 flex justify-between items-center gap-3">
                      <span className="flex-1 text-base break-words min-w-0 overflow-hidden">
                        {template.text}
                      </span>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          onClick={() => handleUseTemplate(template.id)}
                          size="sm"
                          variant="outline"
                          className="gap-1 hover:bg-white/10"
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
                              className="gap-1 hover:bg-white/10"
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
                              <AlertDialogCancel className="hover:bg-white/10">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRemoveTemplate(template.id)}
                                className="hover:bg-red-600/50 text-white border-1 "
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
              <p className={`text-sm text-muted-foreground mt-1 transition-opacity duration-500 ${showMessage ? 'opacity-100' : 'opacity-0'}`}>{message.subtitle}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
