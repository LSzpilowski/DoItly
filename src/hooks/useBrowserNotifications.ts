/**
 * Browser Notifications + Sound Alerts helpers.
 *
 * Usage:
 *   const { notify, playSound } = useBrowserNotifications();
 *
 * `notify(title, body?)` – sends a browser notification if permission is granted
 *   and the "notifications" setting is enabled.
 *
 * `playSound(type)` – plays a short Web Audio API tone if "soundAlerts" is enabled.
 */

import { useCallback, useEffect } from "react";
import { useUIStore } from "@/store/uiStore";

type SoundType = "work_done" | "break_done" | "tick";

/** Request notification permission once on mount (silently). */
export function useRequestNotificationPermission() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {/* ignore */});
    }
  }, []);
}

export function useBrowserNotifications() {
  const { settings } = useUIStore();

  /**
   * Fire a browser notification.
   */
  const notify = useCallback(
    (title: string, body?: string) => {
      if (!settings.notifications) return;
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") {
        // Try requesting on the fly (user gesture may be needed — best-effort)
        Notification.requestPermission().then((perm) => {
          if (perm === "granted") {
            new Notification(title, {
              body,
              icon: "/site.webmanifest",
              tag: "doitly-focus",
            });
          }
        });
        return;
      }
      new Notification(title, {
        body,
        icon: "/site.webmanifest",
        tag: "doitly-focus",
      });
    },
    [settings.notifications]
  );

  /**
   * Play a short tone via Web Audio API.
   */
  const playSound = useCallback(
    (type: SoundType = "work_done") => {
      if (!settings.soundAlerts) return;
      if (typeof window === "undefined" || !window.AudioContext) return;

      try {
        const ctx = new AudioContext();
        const gainNode = ctx.createGain();
        gainNode.connect(ctx.destination);

        const configs: Record<SoundType, { freq: number; duration: number; wave: OscillatorType }[]> = {
          work_done: [
            { freq: 523, duration: 0.15, wave: "sine" }, // C5
            { freq: 659, duration: 0.15, wave: "sine" }, // E5
            { freq: 784, duration: 0.25, wave: "sine" }, // G5
          ],
          break_done: [
            { freq: 784, duration: 0.15, wave: "sine" }, // G5
            { freq: 659, duration: 0.15, wave: "sine" }, // E5
            { freq: 523, duration: 0.25, wave: "sine" }, // C5
          ],
          tick: [
            { freq: 800, duration: 0.05, wave: "square" },
          ],
        };

        const notes = configs[type];
        let startTime = ctx.currentTime;
        notes.forEach(({ freq, duration, wave }) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = wave;
          osc.frequency.setValueAtTime(freq, startTime);
          g.gain.setValueAtTime(0.25, startTime);
          g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(startTime);
          osc.stop(startTime + duration);
          startTime += duration;
        });

        // Auto-close the context after playback
        setTimeout(() => ctx.close(), (startTime - ctx.currentTime + 0.5) * 1000);
      } catch {
        // Web Audio not available — silently ignore
      }
    },
    [settings.soundAlerts]
  );

  return { notify, playSound };
}
