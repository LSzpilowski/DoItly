
import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { testSupabaseConnection } from '@/lib/supabase';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((state) => state.initialize);
  const initialized = useAuthStore((state) => state.initialized);

  useEffect(() => {
    if (!initialized) {
      initialize();
      testSupabaseConnection();
    }
  }, [initialize, initialized]);

  return <>{children}</>;
}
