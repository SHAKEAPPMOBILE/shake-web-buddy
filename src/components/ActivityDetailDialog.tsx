import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, DollarSign, AlertCircle, Calendar, MapPin } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";
import { LoadingSpinner } from "./LoadingSpinner";
import { useActivityPayment } from "@/hooks/useActivityPayment";
import { getPlanEmojis } from "@/lib/activityDetection";
import { useEmojiSearchVersion } from "@/hooks/useEmojiSearchVersion";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { format } from "date-fns";
import { PriceTierPicker } from "./PriceTierPicker";

interface ActivityDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: {
    id: string;
    user_id: string;
    activity_type: string;
    city: string;
    note?: string | null;
    price_amount?: string | null;
    price_tiers?: { label: string; amount: number }[] | null;
    scheduled_for?: string;
    creator_name?: string;
    creator_avatar?: string;
    participant_count?: number;
  };
  onCreatorClick?: () => void;
}

/** A detail row: a white tile that floats above the sheet with the same soft shadow as the Shakers pill on Home, its icon in colour. */
function DetailRow({ color, icon, label, children }: { color: string; icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white border border-black/5 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.18),0_2px_4px_rgba(0,0,0,0.06)]"
        style={{ color }}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        {children}
      </div>
    </div>
  );
}

export function ActivityDetailDialog({
  open,
  onOpenChange,
  activity,
  onCreatorClick,
}: ActivityDetailDialogProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  // Only emojis that belong to this event (its activity, or what its title says); nothing generic.
  useEmojiSearchVersion();
  const planEmojis = getPlanEmojis(activity.activity_type, activity.note);
  const { redirectToPayment, isLoading: paymentLoading } = useActivityPayment();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  const hasTiers = Boolean(activity.price_tiers && activity.price_tiers.length > 0);

  const swipeHandlers = useSwipeToClose({
    onClose: () => onOpenChange(false),
    threshold: 80,
    enabled: isMobile,
  });


  const handlePayToJoin = async () => {
    if (hasTiers && !selectedTier) {
      setPaymentError(t("common.selectPriceOption", "Please select a price option first."));
      return;
    }
    setIsProcessing(true);
    setPaymentError(null);
    const success = await redirectToPayment(activity.id, selectedTier || undefined);
    if (!success) {
      setIsProcessing(false);
      setPaymentError(t("common.creatorPaymentNotSetup", "The activity creator hasn't set up payments yet. Please contact them directly or try again later."));
    }
    // If successful, user will be redirected to Stripe
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50 p-0 overflow-hidden [&>button.dialog-close]:text-black [&>button.dialog-close]:bg-black/20 [&>button.dialog-close]:hover:bg-black/30"
        {...(isMobile ? swipeHandlers : {})}
      >
        {isMobile && (
          <div className="flex justify-center py-2 shrink-0">
            <div className="w-10 h-1.5 rounded-full bg-white/80 shadow-[0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.9)]" />
          </div>
        )}

        {/* Hero Section - Background with Rainbow */}
        <div className="relative z-10 p-6 text-foreground bg-card shadow-[0_10px_24px_-12px_rgba(0,0,0,0.3)]">
          <div className="flex items-start gap-4">
            {/* Creator Avatar or Activity Emoji */}
            <div className="relative">
              <Avatar className="w-16 h-16 border-2 border-border shadow-lg">
                <AvatarImage
                  src={activity.creator_avatar || undefined}
                  alt={activity.creator_name}
                />
                <AvatarFallback className="bg-muted text-muted-foreground text-xl font-semibold">
                  {activity.creator_name?.charAt(0)?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="flex-1">
              <h2 className="text-xl font-bold flex items-center gap-2">
                {activity.note || t("plans.untitledPlan", "Untitled Plan")}
                {planEmojis.length > 0 && <span className="text-lg">{planEmojis.join(" ")}</span>}
              </h2>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreatorClick?.();
                }}
                className="text-sm text-muted-foreground hover:text-foreground underline transition-colors"
              >
                {t("common.by")} {activity.creator_name || "Anonymous"}
              </button>
            </div>
          </div>
        </div>

        {/* Details Section */}
        <div className="p-6 space-y-4">
          <DetailRow color="#F43F5E" icon={<MapPin className="w-5 h-5" />} label={t("common.location")}>
            <p className="font-medium">{activity.city}</p>
          </DetailRow>

          {activity.scheduled_for && (
            <DetailRow color="#0EA5E9" icon={<Calendar className="w-5 h-5" />} label={t("common.date", "Date")}>
              <p className="font-medium">{format(new Date(activity.scheduled_for), "EEEE, MMMM d, yyyy")}</p>
            </DetailRow>
          )}

          <DetailRow color="#F97316" icon={<Users className="w-5 h-5" />} label={t("common.participants")}>
            <p className="font-medium">
              {(activity.participant_count || 0) + 1} {t("common.going")}
            </p>
          </DetailRow>

          {activity.price_amount && !hasTiers && (
            <DetailRow color="#22C55E" icon={<DollarSign className="w-5 h-5" />} label={t("common.entryFee")}>
              <p className="font-medium text-green-600">{activity.price_amount}</p>
            </DetailRow>
          )}

          {/* Price tiers */}
          {hasTiers && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t("common.choosePriceOption", "Choose a price option")}</p>
              <PriceTierPicker
                tiers={activity.price_tiers!}
                selected={selectedTier}
                onSelect={(label) => {
                  setSelectedTier(label);
                  setPaymentError(null);
                }}
              />
            </div>
          )}

          {/* Payment Error */}
          {paymentError && (
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{paymentError}</p>
            </div>
          )}

          {/* Pay to Join Button - Blue */}
          {(activity.price_amount || hasTiers) && (
            <button
              onClick={handlePayToJoin}
              disabled={isProcessing || paymentLoading || (hasTiers && !selectedTier)}
              className="w-full py-3.5 rounded-2xl text-white font-semibold transition-all active:scale-[0.99] hover:opacity-95 disabled:opacity-50 mt-4 bg-gradient-to-b from-blue-400 to-blue-600 shadow-[0_8px_16px_-6px_rgba(37,99,235,0.6),inset_0_1px_0_rgba(255,255,255,0.4)]"
            >
              {isProcessing || paymentLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" />
                  {t("common.processing")}...
                </span>
              ) : hasTiers ? (
                selectedTier
                  ? `${t("common.payToJoin")} - $${activity.price_tiers!.find((tr) => tr.label === selectedTier)?.amount}`
                  : t("common.payToJoin")
              ) : (
                <>
                  {t("common.payToJoin")} - {activity.price_amount}
                </>
              )}
            </button>
          )}

          <p className="text-xs text-center text-muted-foreground">
            {t("common.paymentGateInfo", "After payment, you'll have access to the group chat and can coordinate with other participants.")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
