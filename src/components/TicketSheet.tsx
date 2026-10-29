import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import { Check, Loader2, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { type SharePlan, formatPlanWhen } from "@/lib/planShare";
import { getActivityLabel } from "@/data/activityTypes";
import { ShareEventCard } from "@/components/ShareEventCard";
import { getMyTicket, TICKET_PREFIX, type MyTicket } from "@/lib/ticketsApi";

interface TicketSheetProps {
  plan: SharePlan;
  onClose: () => void;
}

/**
 * The attendee's ticket: the plan's card with a QR code where the activity icon normally sits. The host
 * scans it at the door; a ticket only works once, so a screenshot of it is worth nothing after check-in.
 */
export function TicketSheet({ plan, onClose }: TicketSheetProps) {
  const { t } = useTranslation();
  const [ticket, setTicket] = useState<MyTicket | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyTicket(plan.id).then((res) => !cancelled && setTicket(res));
    return () => { cancelled = true; };
  }, [plan.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = plan.note?.trim() || getActivityLabel(plan.activity_type);
  const when = formatPlanWhen(plan, { today: t("common.today", "Today"), tomorrow: t("common.tomorrow", "Tomorrow") });
  const hostedBy = plan.creator_name || "SHAKE";
  const checkedIn = ticket?.ok === true ? ticket.checkedInAt : null;

  let hero: React.ReactNode = null;
  let footer: React.ReactNode = null;
  if (!ticket) {
    hero = <Loader2 className="h-8 w-8 animate-spin text-white/90" />;
    footer = <span className="text-[13px] font-bold">{t("ticket.loading", "Getting your ticket…")}</span>;
  } else if (ticket.ok === true) {
    hero = (
      <div className="relative h-full aspect-square max-w-full rounded-2xl bg-white p-2.5 shadow-2xl">
        <QRCodeSVG value={`${TICKET_PREFIX}${ticket.code}`} size={256} level="M" fgColor="#111111" bgColor="#ffffff" className={cn("h-full w-full", checkedIn && "opacity-20")} />
        {checkedIn && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
              <Check className="h-9 w-9" strokeWidth={3} />
            </span>
          </div>
        )}
      </div>
    );
    footer = checkedIn ? (
      <span className="text-[13px] font-bold">{t("ticket.checkedIn", "Checked in")} · {format(new Date(checkedIn), "h:mm a")}</span>
    ) : (
      <span className="text-[13px] font-bold">{t("ticket.showAtEntrance", "Show this code at the entrance")}</span>
    );
  } else if (ticket.ok === false) {
    hero = <span className="px-4 text-center text-sm font-semibold text-white">{t(`ticket.error.${ticket.reason}`, t("ticket.error.error", "Couldn't load your ticket. Try again in a moment."))}</span>;
    footer = <span className="text-[13px] font-bold">{t("ticket.title", "Your ticket")}</span>;
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 animate-in fade-in duration-200" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div
        role="dialog"
        aria-label={t("ticket.title", "Your ticket")}
        className="relative w-full max-w-md max-h-[94vh] overflow-y-auto rounded-t-[28px] bg-white pt-3 shadow-2xl animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
        <button type="button" onClick={onClose} aria-label={t("common.close", "Close")} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500">
          <X className="h-4 w-4" />
        </button>
        <div className="mx-auto mt-5 w-[min(86vw,340px)]">
          <ShareEventCard plan={plan} title={title} when={when} hostedBy={hostedBy} heroOverride={hero} footer={footer} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
