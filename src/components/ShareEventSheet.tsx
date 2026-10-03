import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Check, Instagram, Loader2, Mail, MessageCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useShareContacts, type ShareContact } from "@/hooks/useShareContacts";
import { buildPlanShare, formatPlanWhen, type SharePlan } from "@/lib/planShare";
import { getActivityLabel } from "@/data/activityTypes";
import { getDisplayAvatarUrl } from "@/lib/avatar";
import { toast } from "@/lib/app-toast";
import { ShareEventCard } from "@/components/ShareEventCard";

interface ShareEventSheetProps {
  plan: SharePlan;
  onClose: () => void;
}

/** Hand a URL to the OS (Messages, Mail, Instagram). window.open rather than assigning
 *  location.href: in the Capacitor shells it goes out to the system and can never replace the app page. */
function openExternal(url: string) {
  window.open(url, "_blank");
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * One bottom sheet for sharing a plan: a preview of the card, the people the user
 * talks to most (tap to send straight into a SHAKE chat), then Instagram, Messages
 * and Mail. Replaces going straight to the OS share sheet.
 */
export function ShareEventSheet({ plan, onClose }: ShareEventSheetProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { contacts, isLoading } = useShareContacts();
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const share = useMemo(() => buildPlanShare(plan, user?.id), [plan, user?.id]);
  const title = !plan.isCarouselJoin && plan.note?.trim() ? plan.note.trim() : getActivityLabel(plan.activity_type);
  const when = formatPlanWhen(plan, { today: t("common.today", "Today"), tomorrow: t("common.tomorrow", "Tomorrow") });
  const hostedBy = plan.creator_name || "SHAKE";
  const joined = plan.participant_count && plan.participant_count > 0
    ? t("share.joinedCount", { defaultValue: "{{count}} joined", count: plan.participant_count })
    : null;
  const platform = Capacitor.getPlatform();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sendTo = async (contact: ShareContact) => {
    if (!user || sendingId || sentIds.has(contact.user_id)) return;
    const first = contact.name?.split(" ")[0] || t("share.them", "them");
    setSendingId(contact.user_id);
    const { error } = await supabase.from("private_messages").insert({
      sender_id: user.id,
      receiver_id: contact.user_id,
      message: share.message,
      message_type: "text",
    });
    setSendingId(null);
    if (error) {
      toast.error(t("plans.failedToShare"));
      return;
    }
    setSentIds((prev) => new Set(prev).add(contact.user_id));
    toast.success(t("share.sentTo", { defaultValue: "Sent to {{name}}", name: first }));

    // Same follow-ups a normal chat message gets — un-hide the thread on our side and notify them.
    void supabase
      .from("private_conversation_hidden")
      .delete()
      .eq("user_id", user.id)
      .eq("other_user_id", contact.user_id)
      .then(() => {});
    void (async () => {
      const { data: me } = await supabase.from("profiles").select("name").eq("user_id", user.id).maybeSingle();
      await supabase.functions.invoke("send-push-notification", {
        body: {
          to_user_id: contact.user_id,
          title: `${me?.name || "Someone"} shared a plan with you 🎉`,
          body: `${share.label} in ${plan.city}`,
          data: { tab: "chat", other_user_id: user.id },
        },
      });
    })();
  };

  const sendSms = () => openExternal(`sms:${platform === "ios" ? "&" : "?"}body=${encodeURIComponent(share.message)}`);
  const sendMail = () =>
    openExternal(`mailto:?subject=${encodeURIComponent(share.title)}&body=${encodeURIComponent(share.message)}`);

  const sendInstagram = async () => {
    // Instagram has no public "send this to a friend" link. Put the message on the clipboard
    // and open Instagram so it's one paste away; Android falls back to its own share sheet.
    if (platform === "android") {
      try {
        await Share.share({ title: share.title, text: share.text, url: share.url, dialogTitle: share.title });
      } catch (err) {
        if ((err as { errorMessage?: string }).errorMessage !== "Share canceled") toast.error(t("plans.failedToShare"));
      }
      return;
    }
    const copied = await copyToClipboard(share.message);
    if (copied) toast.success(t("share.copiedForInstagram", "Link copied — paste it in Instagram"));
    openExternal(platform === "ios" ? "instagram://sharesheet?text=" + encodeURIComponent(share.message) : "https://www.instagram.com/direct/inbox/");
  };

  const apps = [
    { key: "instagram", label: "Instagram", onClick: sendInstagram, icon: <Instagram className="h-6 w-6 text-white" />, bg: "linear-gradient(45deg,#f9ce34,#ee2a7b 50%,#6228d7)" },
    { key: "messages", label: t("share.messages", "Messages"), onClick: sendSms, icon: <MessageCircle className="h-6 w-6 text-white" />, bg: "#34c759" },
    { key: "mail", label: t("share.mail", "Mail"), onClick: sendMail, icon: <Mail className="h-6 w-6 text-white" />, bg: "#0a84ff" },
  ];

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
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
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

        <div className="mx-auto w-[min(70vw,270px)] pb-5">
          <ShareEventCard plan={plan} title={title} when={when} hostedBy={hostedBy} joinedLabel={joined} />
        </div>

        {(isLoading || contacts.length > 0) && (
          <div
            className="flex gap-4 overflow-x-auto px-5 pb-4"
            style={{ scrollbarWidth: "none" }}
            aria-label={t("share.recent", "Recent")}
          >
            {isLoading && contacts.length === 0 ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-300" />
            ) : (
              contacts.map((c) => {
                const sent = sentIds.has(c.user_id);
                const sending = sendingId === c.user_id;
                const avatar = getDisplayAvatarUrl(c.avatar_url);
                return (
                  <button
                    key={c.user_id}
                    type="button"
                    onClick={() => sendTo(c)}
                    className="flex w-16 shrink-0 flex-col items-center gap-1.5"
                  >
                    <span className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-lg font-semibold text-gray-500">
                      {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : (c.name?.charAt(0).toUpperCase() ?? "?")}
                      {(sent || sending) && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/45">
                          {sending ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Check className="h-6 w-6 text-white" />}
                        </span>
                      )}
                    </span>
                    <span className="w-full truncate text-center text-[11px] text-gray-700">{c.name?.split(" ")[0] ?? ""}</span>
                  </button>
                );
              })
            )}
          </div>
        )}

        <div className="mx-5 border-t border-gray-100" />

        <div className="flex justify-center gap-8 px-5 pt-4">
          {apps.map((a) => (
            <button key={a.key} type="button" onClick={a.onClick} className="flex w-16 flex-col items-center gap-1.5">
              <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: a.bg }}>
                {a.icon}
              </span>
              <span className="text-[11px] text-gray-700">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
