import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";
import { getDisplayAvatarUrl } from "@/lib/avatar";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

interface ChatInviteDialogProps {
  /** Always rendered full-screen while the invite is pending — no open/close toggle needed beyond dismiss. */
  userName: string | null;
  avatarUrl: string | null;
  /** Dismiss without deciding (backdrop tap / swipe down) — goes back to the chat list, invite stays pending. */
  onDismiss: () => void;
  /** User tapped Accept. */
  onAccept: () => void;
  /** User confirmed the decline ("Yes" on the "Are you sure?" step). */
  onDecline: () => void;
}

export function ChatInviteDialog({
  userName,
  avatarUrl,
  onDismiss,
  onAccept,
  onDecline,
}: ChatInviteDialogProps) {
  const [confirmingDecline, setConfirmingDecline] = useState(false);
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  const swipeHandlers = useSwipeToClose({
    onClose: onDismiss,
    threshold: 80,
    enabled: isMobile,
  });

  const displayName = userName || "Shaker";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) {
          // Backdrop tap / escape: just go back, don't count as a decline.
          setConfirmingDecline(false);
          onDismiss();
        }
      }}
    >
      <DialogContent
        className="sm:max-w-sm bg-white border border-purple-200/60"
        {...(isMobile ? swipeHandlers : {})}
      >
        {isMobile && (
          <div className="flex justify-center py-2 shrink-0">
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>
        )}
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-display text-gray-900">
            {t("chatInvite.title", "User Profile")}
          </DialogTitle>
        </DialogHeader>

        {/* Avatar and Name */}
        <div className="flex flex-col items-center py-4">
          <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shadow-lg border-4 border-border shrink-0">
            {avatarUrl ? (
              <img
                src={getDisplayAvatarUrl(avatarUrl) ?? avatarUrl}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-3xl font-bold text-muted-foreground">{initial}</span>
            )}
          </div>
          <h3 className="mt-4 text-xl font-semibold text-gray-900">{displayName}</h3>
        </div>

        {/* Invite / confirm section — replaces "Recent Activity" in the regular profile card */}
        <div className="border-t border-gray-200 pt-4">
          {!confirmingDecline ? (
            <>
              <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center justify-center gap-2 text-center">
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>{t("chatInvite.invitingYouToChat", "{{name}} is inviting you to chat", { name: displayName })}</span>
              </h4>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setConfirmingDecline(true)}
                >
                  {t("chatInvite.decline", "Decline")}
                </Button>
                <Button type="button" variant="success" className="flex-1" onClick={onAccept}>
                  {t("chatInvite.accept", "Accept")}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-center text-gray-700 mb-4">
                {t("chatInvite.confirmDecline", "Are you sure?")}
              </p>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setConfirmingDecline(false)}
                >
                  {t("chatInvite.hum", "Hum")}
                </Button>
                <Button type="button" variant="destructive" className="flex-1" onClick={onDecline}>
                  {t("chatInvite.yes", "Yes")}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
