import { useEffect } from "react";
import { useUIStore } from "@/store/uiStore";

/**
 * Listens to browser online/offline events and surfaces a toast
 * notification using the existing uiStore notification system.
 *
 * Mount once at the top of the component tree (App.tsx).
 */
export function useOfflineDetector() {
  const { showNotification } = useUIStore();

  useEffect(() => {
    const handleOffline = () => {
      showNotification(
        "No internet connection",
        "warning",
        "Changes will not be saved until you reconnect."
      );
    };

    const handleOnline = () => {
      showNotification("Connection restored", "success");
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [showNotification]);
}
