import { toast } from "@/lib/app-toast";

/** Centered popup notifications (same API as `toast` from `@/lib/app-toast`). */
export function useNotification() {
  return toast;
}
