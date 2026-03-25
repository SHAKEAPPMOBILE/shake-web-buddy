import type { ReactNode } from "react";

export type AppNotificationType = "success" | "error" | "warning" | "info";

export type AppNotificationPayload = {
  type: AppNotificationType;
  title: ReactNode;
  subtitle?: ReactNode;
};

type Subscriber = (payload: AppNotificationPayload) => void;

const subscribers = new Set<Subscriber>();

export function subscribeAppNotifications(fn: Subscriber) {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function pushAppNotification(payload: AppNotificationPayload) {
  subscribers.forEach((fn) => fn(payload));
}
