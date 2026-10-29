import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Check, Loader2, X, AlertTriangle } from "lucide-react";
import { type SharePlan, formatPlanWhen } from "@/lib/planShare";
import { getActivityLabel } from "@/data/activityTypes";
import { ShareEventCard } from "@/components/ShareEventCard";
import { getTicketCounts, scanTicket, TICKET_PREFIX, type ScanResult, type TicketCounts } from "@/lib/ticketsApi";

interface TicketScannerSheetProps {
  plan: SharePlan;
  onClose: () => void;
}

const SCAN_EVERY_MS = 150;
// A code that stays in view counts as one scan; it has to leave the frame this long before it can be scanned again
// (which then reports "already checked in", so a re-shown or screenshotted ticket is caught).
const CODE_GONE_AFTER_MS = 1500;
const RESULT_SHOWN_MS = 2600;

/** The host's side: a camera in the plan's card that reads attendees' QR tickets one after another. */
export function TicketScannerSheet({ plan, onClose }: TicketScannerSheetProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraState, setCameraState] = useState<"starting" | "ready" | "denied">("starting");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [counts, setCounts] = useState<TicketCounts | null>(null);
  const resultTimer = useRef<ReturnType<typeof setTimeout>>();

  const refreshCounts = useCallback(() => {
    getTicketCounts(plan.id).then(setCounts).catch(() => {});
  }, [plan.id]);
  useEffect(refreshCounts, [refreshCounts]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let busy = false;
    let lastValue = "";
    let lastSeenAt = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const show = (r: ScanResult) => {
      setResult(r);
      clearTimeout(resultTimer.current);
      resultTimer.current = setTimeout(() => setResult(null), RESULT_SHOWN_MS);
    };

    (async () => {
      try {
        const [{ default: jsQR }, media] = await Promise.all([
          import("jsqr"),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }),
        ]);
        if (stopped) { media.getTracks().forEach((tr) => tr.stop()); return; }
        stream = media;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = media;
        await video.play().catch(() => {});
        setCameraState("ready");

        const tick = async () => {
          if (stopped) return;
          if (!busy && ctx && video.readyState >= 2 && video.videoWidth > 0) {
            const scale = Math.min(1, 480 / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const found = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
            const value = found?.data ?? "";
            if (value.startsWith(TICKET_PREFIX)) {
              const now = Date.now();
              const stillInView = value === lastValue && now - lastSeenAt < CODE_GONE_AFTER_MS;
              lastSeenAt = now;
              if (!stillInView) {
                busy = true;
                lastValue = value;
                const res = await scanTicket(plan.id, value.slice(TICKET_PREFIX.length));
                if (stopped) return;
                show(res);
                if (res.ok) refreshCounts();
                lastSeenAt = Date.now();
                busy = false;
              }
            }
          }
          timer = setTimeout(tick, SCAN_EVERY_MS);
        };
        tick();
      } catch {
        if (!stopped) setCameraState("denied");
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(resultTimer.current);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [plan.id, refreshCounts]);

  const title = plan.note?.trim() || getActivityLabel(plan.activity_type);
  const when = formatPlanWhen(plan, { today: t("common.today", "Today"), tomorrow: t("common.tomorrow", "Tomorrow") });
  const hostedBy = plan.creator_name || "SHAKE";

  const message = !result
    ? null
    : result.ok
    ? t("ticket.scan.ok", "{{name}} is in", { name: result.name || t("chat.shaker", "Shaker") })
    : result.reason === "already_checked_in"
    ? t("ticket.scan.already", "{{name}} already checked in", { name: result.name || t("chat.shaker", "Shaker") })
    : result.reason === "wrong_event"
    ? t("ticket.scan.wrongEvent", "This ticket is for another event")
    : result.reason === "not_host"
    ? t("ticket.scan.notHost", "Only the host can scan tickets")
    : result.reason === "invalid"
    ? t("ticket.scan.invalid", "Not a valid ticket")
    : t("ticket.scan.error", "Couldn't check this ticket. Try again.");

  const hero = (
    <div className="relative h-full aspect-square max-w-full overflow-hidden rounded-2xl bg-black shadow-2xl">
      <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
      {cameraState === "starting" && (
        <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-white/80" /></div>
      )}
      {cameraState === "denied" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center text-xs font-semibold text-white">
          {t("ticket.scan.cameraDenied", "Allow camera access to scan tickets.")}
        </div>
      )}
      {cameraState === "ready" && !result && (
        <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-white/70" />
      )}
      {result && (
        <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center text-white ${result.ok ? "bg-emerald-600/90" : "bg-red-600/90"}`}>
          {result.ok ? <Check className="h-10 w-10" strokeWidth={3} /> : <AlertTriangle className="h-9 w-9" />}
          <span className="text-sm font-bold leading-tight">{message}</span>
        </div>
      )}
    </div>
  );

  const footer = (
    <span className="text-[13px] font-bold">
      {counts
        ? t("ticket.scan.counter", "{{done}} of {{total}} checked in", { done: counts.checkedIn, total: counts.attendees })
        : t("ticket.scan.title", "Scan tickets")}
    </span>
  );

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 animate-in fade-in duration-200" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div
        role="dialog"
        aria-label={t("ticket.scan.title", "Scan tickets")}
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
