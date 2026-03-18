import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";

export function AuthCallback() {
  const navigate = useNavigate();
  const { checkWhitelist } = useAuthStore();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        subscription.unsubscribe();
        // Whitelist check happens in authStore.initialize() via onAuthStateChange,
        // but we also trigger it here explicitly so the redirect is correct.
        const allowed = await checkWhitelist();
        navigate(allowed ? "/today" : "/access-denied");
      } else if (event === "SIGNED_OUT" || (!session && event !== "INITIAL_SESSION")) {
        subscription.unsubscribe();
        navigate("/");
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        subscription.unsubscribe();
        const allowed = await checkWhitelist();
        navigate(allowed ? "/today" : "/access-denied");
      }
    });

    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      navigate("/");
    }, 5000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [navigate, checkWhitelist]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Signing in…</p>
    </div>
  );
}

