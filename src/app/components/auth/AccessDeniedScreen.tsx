import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

export function AccessDeniedScreen() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-destructive"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            You don&apos;t have access yet
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            This app is currently in <span className="font-medium text-foreground">private testing phase</span>.
            Only approved users can sign in.
          </p>
        </div>

        {/* Email info */}
        {user?.email && (
          <div className="bg-muted/50 border border-border rounded-lg px-4 py-3 text-sm text-muted-foreground">
            Signed in as{" "}
            <span className="font-medium text-foreground">{user.email}</span>
            {" "}– this address is not on the access list.
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleSignOut}
            className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
          >
            Sign out
          </button>

          {/* Placeholder — można podpiąć formularz / email w przyszłości */}
          <button
            disabled
            className="w-full px-4 py-2.5 rounded-lg border border-border text-sm text-muted-foreground cursor-not-allowed opacity-50"
            title="Coming soon"
          >
            Request access
          </button>
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground/60">
          If you want to join private testing phase or you believe this is a mistake, contact the app administrator. <a href="https://www.linkedin.com/in/lszpilowski/" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">LSzpilowski</a>
        </p>
        
      </div>
    </div>
  );
}
