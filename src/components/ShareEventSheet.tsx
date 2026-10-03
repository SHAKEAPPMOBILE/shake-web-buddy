import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Check, Link2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { buildPlanShare, formatPlanWhen, type SharePlan } from "@/lib/planShare";
import { getActivityLabel } from "@/data/activityTypes";
import { toast } from "@/lib/app-toast";
import { ShareEventCard } from "@/components/ShareEventCard";

interface ShareEventSheetProps {
  plan: SharePlan;
  onClose: () => void;
}

// The standard WhatsApp glyph (Simple Icons, CC0); lucide has no brand icons.
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older webviews: fall back to a hidden textarea.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * A preview of the plan's card with the quick ways out: the share icon on the card opens the
 * system share sheet (everything in that sheet — the suggested people, the apps, the action row —
 * belongs to Apple/Android and can't be read or edited by an app), plus WhatsApp and Copy link
 * directly underneath.
 */
export function ShareEventSheet({ plan, onClose }: ShareEventSheetProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>();

  const share = useMemo(() => buildPlanShare(plan, user?.id), [plan, user?.id]);
  const title = !plan.isCarouselJoin && plan.note?.trim() ? plan.note.trim() : getActivityLabel(plan.activity_type);
  const when = formatPlanWhen(plan, { today: t("common.today", "Today"), tomorrow: t("common.tomorrow", "Tomorrow") });
  const hostedBy = plan.creator_name || "SHAKE";
  const joined =
    plan.participant_count && plan.participant_count > 0
      ? t("share.joinedCount", { defaultValue: "{{count}} joined", count: plan.participant_count })
      : null;

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleShare = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({ title: share.title, text: share.text, url: share.url, dialogTitle: share.title });
      } catch (err) {
        if ((err as { errorMessage?: string }).errorMessage !== "Share canceled") toast.error(t("plans.failedToShare"));
      }
    } else if (navigator.share) {
      try {
        await navigator.share({ title: share.title, text: share.text, url: share.url });
      } catch (err) {
        if ((err as Error).name !== "AbortError") toast.error(t("plans.failedToShare"));
      }
    } else {
      try {
        await navigator.clipboard.writeText(share.url);
        toast.success(t("plans.linkCopied"), { description: t("plans.shareFriends") });
      } catch {
        toast.error(t("plans.failedToCopyLink"));
      }
    }
  };

  const handleWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(share.message)}`, "_blank");

  const handleCopy = async () => {
    if (await copyText(share.url)) {
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1800);
    } else {
      toast.error(t("plans.failedToCopyLink"));
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 animate-in fade-in duration-200"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        role="dialog"
        aria-label={t("share.title", "Share plan")}
        className="relative w-full max-w-md max-h-[94vh] overflow-y-auto rounded-t-[28px] bg-white pt-3 shadow-2xl animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close", "Close")}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto w-[min(76vw,300px)]">
          <ShareEventCard plan={plan} title={title} when={when} hostedBy={hostedBy} joinedLabel={joined} onShare={handleShare} shareLabel={t("share.share", "Share")} />
        </div>

        <div className="mt-5 flex justify-center gap-10">
          <button type="button" onClick={handleWhatsApp} className="flex flex-col items-center gap-1.5">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-md active:scale-95 transition-transform">
              <WhatsAppGlyph className="h-7 w-7" />
            </span>
            <span className="text-[12px] font-medium text-gray-700">WhatsApp</span>
          </button>
          <button type="button" onClick={handleCopy} className="flex flex-col items-center gap-1.5">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-white shadow-md active:scale-95 transition-transform">
              {copied ? <Check className="h-6 w-6" /> : <Link2 className="h-6 w-6" />}
            </span>
            <span className="text-[12px] font-medium text-gray-700">
              {copied ? t("share.copied", "Copied") : t("share.copyLink", "Copy link")}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
