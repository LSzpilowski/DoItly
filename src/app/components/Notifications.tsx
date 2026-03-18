import { useEffect, useRef } from "react";
import { useUIStore } from "@/store/uiStore";
import type { AppNotification } from "@/store/types";

export const Notifications = () => {
  const { notifications } = useUIStore();

  return (
    <div className="fixed bottom-6 right-4 md:right-6 space-y-2 z-[60] pointer-events-none">
      {notifications.map((n) => (
        <NotificationToast key={n.id} notification={n} />
      ))}
    </div>
  );
};

const TYPE_STYLES: Record<AppNotification["type"], string> = {
  success: "bg-green-600 border-green-500/50",
  error: "bg-red-600 border-red-500/50",
  warning: "bg-yellow-600 border-yellow-500/50",
  info: "bg-blue-600 border-blue-500/50",
};

function NotificationToast({ notification }: { notification: AppNotification }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.animation = "fadeInUp 0.3s ease forwards";
    }
  }, []);

  return (
    <div
      ref={ref}
      className={`pointer-events-auto ${TYPE_STYLES[notification.type]} text-white px-4 py-3 rounded-xl shadow-lg border max-w-xs opacity-0`}
    >
      <p className="font-semibold text-sm">{notification.title}</p>
      {notification.body && (
        <p className="text-xs mt-0.5 opacity-90">{notification.body}</p>
      )}
    </div>
  );
}
