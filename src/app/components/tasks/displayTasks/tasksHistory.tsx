import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { History, RotateCcw } from "lucide-react";
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
import type { Task } from "@/store/tasksStore";

interface ITasksHistory {
  latestHistoryTasks: Task[];
  handleClearHistory: () => void;
  handleReUseButton: (task: Task) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const TasksHistory: React.FC<ITasksHistory> = ({
  latestHistoryTasks,
  handleClearHistory,
  handleReUseButton,
  open: controlledOpen,
  onOpenChange,
}) => {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const effectiveOpen = controlledOpen !== undefined ? controlledOpen : isOpen;
  const handleOpenChange = (val: boolean) => {
    setIsOpen(val);
    onOpenChange?.(val);
  };
  const [message, setMessage] = useState({
    subtitle: "",
  });
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    const historyEmptyMessages = [
      {
        subtitle: "Deleted tasks will show up here.",
      },
      {
        subtitle: "Nothing deleted so far.",
      },
      {
        subtitle: "This is your safety net — just in case.",
      },
      {
        subtitle: "Accidental deletes? They'll appear here.",
      },
    ];

    React.startTransition(() => {
      setMounted(true);
      setMessage(historyEmptyMessages[Math.floor(Math.random() * historyEmptyMessages.length)]);
      setTimeout(() => setShowMessage(true), 100);
    });
  }, []);

  const isControlled = controlledOpen !== undefined && onOpenChange !== undefined;

  return (
    <Sheet open={effectiveOpen} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <SheetTrigger asChild>
          <Button variant="outline" size="lg" className="gap-2" aria-label="Open task history">
            <History className="h-5 w-5" />
            History
            {mounted && latestHistoryTasks.length > 0 && (
              <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                {latestHistoryTasks.length}
              </span>
            )}
          </Button>
        </SheetTrigger>
      )}
      <SheetContent className="w-full sm:max-w-lg bg-background overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Task History</SheetTitle>
          <SheetDescription>
            Recently deleted tasks. You can reuse them.
          </SheetDescription>
          <p className="text-xs text-muted-foreground mt-2">
            Showing last 10 deleted tasks
          </p>
        </SheetHeader>
        <Card className="flex flex-col border-0 shadow-none bg-transparent mt-6">
          {latestHistoryTasks.length > 0 && (
            <CardHeader className="px-0 pt-0">
              <CardTitle className="flex flex-col items-center justify-between gap-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full bg-primary text-primary-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors duration-300 ease-in-out"
                      aria-label="Clear all task history"
                    >
                      Clear All History
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-background z-9999">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear All History?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all {latestHistoryTasks.length} task{latestHistoryTasks.length > 1 ? 's' : ''} from history. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="hover:bg-accent" >Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleClearHistory}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
                      >
                        Clear All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardTitle>
            </CardHeader>
          )}
          {latestHistoryTasks.length > 0 ? (
             <CardContent className="px-0">
            {latestHistoryTasks.length > 0 && (
              <ul className="flex flex-col gap-2">
                {latestHistoryTasks.map((task) => (
                  <Card key={task.id} className="group transition-all hover:shadow-md hover:bg-accent border-2">
                    <div className="py-3 px-4 text-base flex justify-between items-center w-full">
                      <div className="flex-1 overflow-hidden min-w-0">
                        <span className="block break-words text-sm font-medium">{task.title ?? task.text}</span>
                        {(task.category || task.priority) && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {task.priority && (
                              <span className="text-[11px] text-muted-foreground capitalize">{task.priority}</span>
                            )}
                            {task.category && (
                              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{task.category}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <Button
                        onClick={() => { handleReUseButton(task); setIsOpen(false); }}
                        size="sm"
                        variant="secondary"
                        className="ml-3 gap-2 shrink-0"
                        aria-label="Restore task from history"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Reuse
                      </Button>
                    </div>
                  </Card>
                ))}
              </ul>
            )}
          </CardContent>
          ) : (
            <CardContent className="px-0 py-12 text-center">
              <History className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
              <p className="text-muted-foreground text-lg mt-4">No history yet</p>
              <p className={`text-sm text-muted-foreground mt-1 transition-opacity duration-500 ${showMessage ? 'opacity-100' : 'opacity-0'}`}>{message.subtitle}</p>
            </CardContent>
          )}
        </Card>
      </SheetContent>
    </Sheet>
  );
};
