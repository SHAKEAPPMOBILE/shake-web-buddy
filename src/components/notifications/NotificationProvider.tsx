import { useEffect, useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import {
  subscribeAppNotifications,
  type AppNotificationPayload,
  type AppNotificationType,
} from "@/lib/notificationsBridge";
import { NotificationPopup } from "./NotificationPopup";
import type { ReactNode } from "react";

const AUTO_DISMISS_MS = 2000;
const EXIT_MS = 200;

type Item = {
  id: string;
  type: AppNotificationType;
  title: ReactNode;
  subtitle?: ReactNode;
  exiting: boolean;
};

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const dismissTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const exitTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearDismissTimer = useCallback((id: string) => {
    const t = dismissTimersRef.current.get(id);
    if (t) clearTimeout(t);
    dismissTimersRef.current.delete(id);
  }, []);

  const clearExitTimer = useCallback((id: string) => {
    const t = exitTimersRef.current.get(id);
    if (t) clearTimeout(t);
    exitTimersRef.current.delete(id);
  }, []);

  const removeItem = useCallback(
    (id: string) => {
      clearDismissTimer(id);
      clearExitTimer(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
    },
    [clearDismissTimer, clearExitTimer],
  );

  const startExit = useCallback(
    (id: string) => {
      clearDismissTimer(id);
      clearExitTimer(id);
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, exiting: true } : x)));
      const t = setTimeout(() => removeItem(id), EXIT_MS);
      exitTimersRef.current.set(id, t);
    },
    [clearDismissTimer, clearExitTimer, removeItem],
  );

  const scheduleAutoDismiss = useCallback(
    (id: string) => {
      clearDismissTimer(id);
      const t = setTimeout(() => startExit(id), AUTO_DISMISS_MS);
      dismissTimersRef.current.set(id, t);
    },
    [clearDismissTimer, startExit],
  );

  const enqueue = useCallback(
    (payload: AppNotificationPayload) => {
      const id = genId();
      setItems((prev) => {
        let next = [...prev];
        const active = next.filter((x) => !x.exiting);
        if (active.length >= 2) {
          const victim = active[0];
          clearDismissTimer(victim.id);
          clearExitTimer(victim.id);
          next = next.map((x) => (x.id === victim.id ? { ...x, exiting: true } : x));
          const t = setTimeout(() => {
            removeItem(victim.id);
          }, EXIT_MS);
          exitTimersRef.current.set(victim.id, t);
        }
        next.push({
          id,
          type: payload.type,
          title: payload.title,
          subtitle: payload.subtitle,
          exiting: false,
        });
        return next;
      });
      window.setTimeout(() => scheduleAutoDismiss(id), 0);
    },
    [clearDismissTimer, clearExitTimer, removeItem, scheduleAutoDismiss],
  );

  useEffect(() => {
    return subscribeAppNotifications(enqueue);
  }, [enqueue]);

  useEffect(() => {
    return () => {
      dismissTimersRef.current.forEach((t) => clearTimeout(t));
      dismissTimersRef.current.clear();
      exitTimersRef.current.forEach((t) => clearTimeout(t));
      exitTimersRef.current.clear();
    };
  }, []);

  const portal =
    typeof document !== "undefined"
      ? createPortal(
          <div
            className="pointer-events-none fixed inset-x-0 top-0 z-[500] flex flex-col items-center gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))]"
            aria-live="polite"
          >
            {items.map((item) => (
              <NotificationPopup
                key={item.id}
                type={item.type}
                title={item.title}
                subtitle={item.subtitle}
                exiting={item.exiting}
              />
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {children}
      {portal}
    </>
  );
}
