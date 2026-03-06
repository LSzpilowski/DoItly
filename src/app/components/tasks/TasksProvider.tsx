import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useTasksStore } from '@/store/tasksStore';

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuthStore();
  const { loadTasks } = useTasksStore();

  useEffect(() => {
    if (!initialized) {

      return;
    }

    if (user) {

      loadTasks(user.id);
    } else {

      loadTasks();
    }
  }, [user, initialized, loadTasks]);

  return <>{children}</>;
}
