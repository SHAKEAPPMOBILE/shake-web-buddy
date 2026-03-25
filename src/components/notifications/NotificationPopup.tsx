import type { ReactNode } from "react";
import { Check, X, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppNotificationType } from "@/lib/notificationsBridge";

const ICONS: Record<
  AppNotificationType,
  { Icon?: typeof Check; circle: string; char?: string }
> = {
  success: { Icon: Check, circle: "bg-emerald-500" },
  error: { Icon: X, circle: "bg-red-500" },
  warning: { circle: "bg-amber-500", char: "!" },
  info: { Icon: Info, circle: "bg-[hsl(var(--primary))]" },
};

export function NotificationPopup({
  type,
  title,
  subtitle,
  exiting,
}: {
  type: AppNotificationType;
  title: ReactNode;
  subtitle?: ReactNode;
  exiting: boolean;
}) {
  const meta = ICONS[type];

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex w-full max-w-[360px] items-start gap-3 rounded-2xl bg-white p-4",
        "shadow-[0_8px_32px_rgba(0,0,0,0.12)]",
        exiting ? "animate-notification-exit" : "animate-notification-enter",
      )}
      style={{ borderRadius: 16 }}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white",
          meta.circle,
        )}
        aria-hidden
      >
        {meta.char != null ? (
          <span className="text-base font-bold leading-none">{meta.char}</span>
        ) : meta.Icon ? (
          <meta.Icon className="h-4 w-4" strokeWidth={2.5} />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="text-sm font-bold leading-tight text-gray-900">{title}</div>
        {subtitle != null && subtitle !== "" ? (
          <div className="mt-1 text-sm leading-snug text-gray-500">{subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}
