import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { CalendarPlus, Loader2, X } from "lucide-react";
import { addToCalendar, type CalendarKind } from "@/lib/addToCalendar";
import { toast } from "@/lib/app-toast";

interface AddToCalendarSheetProps {
  activityId: string;
  onClose: () => void;
}

// Brand-coloured letter tiles; lucide has no brand icons.
const OPTIONS: { kind: CalendarKind; tile: React.ReactNode; bg: string }[] = [
  { kind: "device", tile: <CalendarPlus className="h-6 w-6" />, bg: "#111827" },
  { kind: "google", tile: <span className="text-lg font-bold">G</span>, bg: "#4285F4" },
  { kind: "outlook", tile: <span className="text-lg font-bold">O</span>, bg: "#0A64AD" },
];

/** Where should the plan go? The phone's own calendar, Google Calendar, or Outlook. */
export function AddToCalendarSheet({ activityId, onClose }: AddToCalendarSheetProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<CalendarKind | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const labels: Record<CalendarKind, { name: string; desc?: string }> = {
    device: { name: t("calendar.device", "Phone calendar"), desc: t("calendar.deviceDesc", "Apple, Samsung and others") },
    google: { name: t("calendar.google", "Google Calendar") },
    outlook: { name: t("calendar.outlook", "Outlook") },
  };

  const choose = async (kind: CalendarKind) => {
    if (busy) return;
    setBusy(kind);
    try {
      const ok = await addToCalendar(activityId, kind);
      if (ok) onClose();
      else toast.error(t("calendar.failed", "Couldn't open the calendar. Try again."));
    } catch {
      toast.error(t("calendar.failed", "Couldn't open the calendar. Try again."));
    } finally {
      setBusy(null);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 animate-in fade-in duration-200"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div
        role="dialog"
        aria-label={t("calendar.add", "Add to calendar")}
        className="relative w-full max-w-md rounded-t-[28px] bg-white px-5 pt-3 shadow-2xl animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
        <button type="button" onClick={onClose} aria-label={t("common.close", "Close")} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500">
          <X className="h-4 w-4" />
        </button>
        <h3 className="mb-3 text-base font-semibold text-gray-900">{t("calendar.add", "Add to calendar")}</h3>
        <div className="divide-y divide-gray-100">
          {OPTIONS.map(({ kind, tile, bg }) => (
            <button key={kind} type="button" onClick={() => choose(kind)} className="flex w-full items-center gap-3 py-3 text-left active:opacity-70">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ background: bg }}>
                {busy === kind ? <Loader2 className="h-5 w-5 animate-spin" /> : tile}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-medium text-gray-900">{labels[kind].name}</span>
                {labels[kind].desc && <span className="block text-xs text-gray-400">{labels[kind].desc}</span>}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
