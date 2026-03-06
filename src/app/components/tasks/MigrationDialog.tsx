import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useTasksStore } from '@/store/tasksStore';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const REMINDER_DISMISSED_KEY = 'doitly_reminder_dismissed';
const TASK_THRESHOLD = 3;

export function SignInReminder() {
  const [open, setOpen] = useState(false);
  const { user } = useAuthStore();
  const { getActiveTasks, getCompletedTasks } = useTasksStore();

  useEffect(() => {
    if (user) return;

    const dismissed = localStorage.getItem(REMINDER_DISMISSED_KEY);
    if (dismissed) return;

    const activeTasks = getActiveTasks();
    const completedTasks = getCompletedTasks();
    const totalTasks = activeTasks.length + completedTasks.length;

    if (totalTasks >= TASK_THRESHOLD) {
      setTimeout(() => setOpen(true), 500);
    }
  }, [user, getActiveTasks, getCompletedTasks]);

  const handleDismiss = () => {
    localStorage.setItem(REMINDER_DISMISSED_KEY, 'true');
    setOpen(false);
  };

  const totalTasks = getActiveTasks().length + getCompletedTasks().length;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Keep your tasks safe! 🔒</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              You&apos;ve created {totalTasks} tasks! 
              It would be a pity to lose your progress.
            </span>
            <span className="block font-medium">
              Sign in to sync your tasks across all devices and never lose them.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button onClick={handleDismiss} variant="outline" className="m-0 sm:flex-1">
            Maybe later
          </Button>
          <AlertDialogAction onClick={handleDismiss} className="m-0 sm:flex-1">
            Got it
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
