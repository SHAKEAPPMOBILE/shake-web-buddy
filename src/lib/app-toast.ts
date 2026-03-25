import type { ReactNode } from "react";
import { pushAppNotification } from "@/lib/notificationsBridge";

/** Matches prior sonner-style options; `duration` and `icon` are ignored (fixed UI + 2s dismiss). */
export type AppToastOptions = {
  description?: ReactNode;
  duration?: number;
  icon?: ReactNode;
};

export const toast = {
  success: (message: ReactNode, options?: AppToastOptions) => {
    pushAppNotification({
      type: "success",
      title: message,
      subtitle: options?.description,
    });
  },
  error: (message: ReactNode, options?: AppToastOptions) => {
    pushAppNotification({
      type: "error",
      title: message,
      subtitle: options?.description,
    });
  },
  info: (message: ReactNode, options?: AppToastOptions) => {
    pushAppNotification({
      type: "info",
      title: message,
      subtitle: options?.description,
    });
  },
  warning: (message: ReactNode, options?: AppToastOptions) => {
    pushAppNotification({
      type: "warning",
      title: message,
      subtitle: options?.description,
    });
  },
};
