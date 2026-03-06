import { useAuthStore } from "@/store/authStore";
import { AuthSheet } from "./auth/AuthSheet";
import { AccountSheet } from "./auth/AccountSheet";

export const Header = () => {
  const { user } = useAuthStore();

  return (
    <header className="fixed top-0 left-0 w-full p-6 flex justify-between items-center z-50 bg-gradient-to-b from-background/80 to-transparent backdrop-blur-sm">
      <h1 className="text-2xl md:text-3xl font-bold text-white">
        DoItly
      </h1>
      
      <div className="flex items-center gap-4">
        {user ? (
          <AccountSheet />
        ) : (
          <AuthSheet />
        )}
      </div>
    </header>
  );
};
