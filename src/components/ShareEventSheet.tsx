import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Share as ShareIcon, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { buildPlanShare, formatPlanWhen, type SharePlan } from "@/lib/planShare";
import { getActivityLabel } from "@/data/activityTypes";
import { toast } from "@/lib/app-toast";
import { ShareEventCard } from "@/components/ShareEventCard";

interface ShareEventSheetProps {
  plan: SharePlan;
  onClose: () => void;
}

/**
 * A preview of the plan's card, with one Share button that hands off to the system share
 * sheet. Everything in that sheet — the people suggested at the top, the apps, the action
 * row underneath — is Apple's (or Android's) and not something an app can read or edit;
 * this screen only decides what the plan looks like before it goes out.
 */
export function ShareEventSheet({ plan, onClose }: ShareEventSheetProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const share = useMemo(() => buildPlanShare(plan, user?.id), [plan, user?.id]);
  const title = !plan.isCarouselJoin && plan.note?.trim() ? plan.note.trim() : getActivityLabel(plan.activity_type);
  const when = formatPlanWhen(plan, { today: t("common.today", "Today"), tomorrow: t("common.tomorrow", "Tomorrow") });
  const hostedBy = plan.creator_name || "SHAKE";
  const joined =
    plan.participant_count && plan.participant_count > 0
      ? t("share.joinedCount", { defaultValue: "{{count}} joined", count: plan.participant_count })
      : null;

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
          <ShareEventCard plan={plan} title={title} when={when} hostedBy={hostedBy} joinedLabel={joined} />
        </div>

        <div className="mt-5 flex justify-center">
          <button type="button" onClick={handleShare} className="flex flex-col items-center gap-1.5">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black text-white shadow-lg active:scale-95 transition-transform">
              <ShareIcon className="h-6 w-6" />
            </span>
            <span className="text-[12px] font-medium text-gray-700">{t("share.share", "Share")}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
