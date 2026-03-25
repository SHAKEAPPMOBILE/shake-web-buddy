import * as React from "react";
import { pushAppNotification } from "@/lib/notificationsBridge";

type ToastProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive";
  duration?: number;
  action?: React.ReactElement;
};

function toast({ title, description, variant }: ToastProps) {
  const type = variant === "destructive" ? "error" : "success";
  const hasTitle = title != null && title !== "";
  pushAppNotification({
    type,
    title: hasTitle ? title : (description ?? ""),
    subtitle: hasTitle ? description : undefined,
  });
  return {
    id: "app-toast",
    dismiss: () => {},
    update: () => {},
  };
}

function useToast() {
  return {
    toasts: [] as const,
    toast,
    dismiss: () => {},
  };
}

export { useToast, toast };
