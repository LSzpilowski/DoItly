import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        subscription.unsubscribe();
        navigate("/");
      } else if (event === "SIGNED_OUT" || (!session && event !== "INITIAL_SESSION")) {
        subscription.unsubscribe();
        navigate("/");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        subscription.unsubscribe();
        navigate("/");
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
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Signing in...</p>
    </div>
  );
}
