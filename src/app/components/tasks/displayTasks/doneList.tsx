import React, { useState, useEffect } from "react";
import { CheckCircle2, Undo2, Archive } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button";
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

interface IDone {
  id: string;
  text: string;
  isChecked: boolean;
}

interface IDoneList {
  dones: IDone[];
  handleUndo: (index: number) => void;
  handleArchive: (index: number) => void;
  handleArchiveAll: () => void;
}

export const DonesList: React.FC<IDoneList> = ({ dones, handleUndo, handleArchive, handleArchiveAll }) => {
  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState({
    subtitle: "",
  });
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    const completedEmptyMessages = [
      {
        subtitle: "Your first win is just one task away.",
      },
      {
        subtitle: "Every list starts with one finished task.",
      },
      {
        subtitle: "Complete something small — momentum matters.",
      },
      {
        subtitle: "Progress will show up here.",
      },
    ];

    React.startTransition(() => {
      setMounted(true);
      setMessage(completedEmptyMessages[Math.floor(Math.random() * completedEmptyMessages.length)]);
      setTimeout(() => setShowMessage(true), 100);
    });
  }, []);

  const visibleDones = dones.slice(-10);
  const hiddenCount = dones.length - visibleDones.length;

  return (
    <Card className="w-full md:w-1/2 flex flex-col min-h-65 max-h-65 md:min-h-110 md:max-h-110 shadow-md border-2 transition-all hover:shadow-lg bg-gradient-to-br from-black to-gray-900">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl md:text-2xl font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            Completed
            {mounted && dones.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({dones.length})
              </span>
            )}
          </CardTitle>
          {mounted && dones.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs hover:bg-white/10"
                  aria-label="Archive all completed tasks"
                >
                  <Archive className="h-3.5 w-3.5" />
                  Archive All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive All Completed Tasks?</AlertDialogTitle>
                  <AlertDialogDescription>
                    <span className="block">This will move all {dones.length} completed task{dones.length > 1 ? 's' : ''} to the archive. You can access archived tasks from your account.</span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleArchiveAll}
                    className="bg-black/50 dark:bg-white text-white dark:text-black hover:bg-black/70 dark:hover:bg-white/90"
                  >
                    Archive All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        {mounted && hiddenCount > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Showing last 10 completed tasks
          </p>
        )}
      </CardHeader>
      {mounted && visibleDones.length > 0 ? 
     <CardContent className="max-h-[500px] overflow-y-auto space-y-2">
      <ul className="flex flex-col gap-2">
        {visibleDones.map((done, index) => {
          const actualIndex = dones.length - visibleDones.length + index;
          return (
          <Card
            className="group transition-all hover:shadow-md border bg-green-50/50 dark:bg-green-950/20"
            key={done.id}
          >
            <div className="flex flex-row justify-between gap-2 items-center p-3">
              <s className="flex-1 text-base text-muted-foreground break-words min-w-0 overflow-hidden">
                {done.text}
              </s>
              <div className="flex gap-1 shrink-0">
                <Button
                  onClick={() => handleUndo(actualIndex)}
                  size="sm"
                  variant="outline"
                  className="gap-1 hover:bg-white/10"
                  aria-label="Undo task completion"
                  title="Move back to active tasks"
                >
                  <Undo2 className="h-4 w-4" />
                  Undo
                </Button>
                <Button
                  onClick={() => handleArchive(actualIndex)}
                  size="sm"
                  variant="outline"
                  className="gap-1 hover:bg-white/10"
                  aria-label="Archive task"
                  title="Archive this task"
                >
                  <Archive className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        )})}
      </ul>
      </CardContent>  
    : (
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground text-lg">No completed tasks yet</p>
        <p className={`text-sm text-muted-foreground mt-1 transition-opacity duration-500 ${showMessage ? 'opacity-100' : 'opacity-0'}`}>{message.subtitle}</p>
      </CardContent>
    )}
     
    </Card>
  );
};
