import { create } from 'zustand';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  /** null = not checked yet, true = on whitelist, false = blocked */
  isAllowed: boolean | null;

  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;

  signInWithProvider: (provider: 'google' | 'github') => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ error: Error | null }>;
  initialize: () => Promise<void>;
  /** Calls is_user_allowed() RPC and updates isAllowed state */
  checkWhitelist: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  initialized: false,
  isAllowed: null,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (loading) => set({ loading }),
  setInitialized: (initialized) => set({ initialized }),

  checkWhitelist: async () => {
    try {
      const { data, error } = await supabase.rpc('is_user_allowed');
      const allowed = !error && data === true;
      set({ isAllowed: allowed });
      return allowed;
    } catch {
      set({ isAllowed: false });
      return false;
    }
  },

  signInWithProvider: async (provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { error };
  },

  signOut: async () => {
    set({ loading: true });
    await supabase.auth.signOut();
    set({ user: null, session: null, loading: false, isAllowed: null });
  },

  deleteAccount: async () => {
    const { user } = get();
    if (!user) {
      return { error: new Error('No user logged in') };
    }

    try {
      set({ loading: true });

      const { data, error } = await supabase.rpc('delete_user_account');

      if (error) {
        throw new Error(`Failed to delete account: ${error.message}`);
      }

      if (data && !data.success) {
        throw new Error(data.error || 'Failed to delete account');
      }

      await supabase.auth.signOut();
      set({ user: null, session: null, loading: false, isAllowed: null });

      return { error: null };
    } catch (error) {
      set({ loading: false });
      return { error: error as Error };
    }
  },

  initialize: async () => {
    try {
      set({ loading: true });

      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        set({ session, user: session.user });
        // Check whitelist immediately on init if user is already logged in
        await get().checkWhitelist();
      }

      set({ loading: false, initialized: true });

      supabase.auth.onAuthStateChange(async (_event, session) => {
        set({ session, user: session?.user ?? null });

        if (session?.user) {
          // Check whitelist every time auth state changes to a logged-in session
          await get().checkWhitelist();
        } else {
          set({ isAllowed: null });
        }

        set({ loading: false });
      });
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ loading: false, initialized: true });
    }
  },
}));
