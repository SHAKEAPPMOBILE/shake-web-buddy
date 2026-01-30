import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Users, DollarSign, AlertCircle, Calendar } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";
import { LoadingSpinner } from "./LoadingSpinner";
import { useActivityPayment } from "@/hooks/useActivityPayment";
import { ALL_ACTIVITY_TYPES } from "@/data/activityTypes";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { format } from "date-fns";

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
    scheduled_for?: string;
    creator_name?: string;
    creator_avatar?: string;
    participant_count?: number;
  };
  onCreatorClick?: () => void;
}

export function ActivityDetailDialog({
  open,
  onOpenChange,
  activity,
  onCreatorClick,
}: ActivityDetailDialogProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { redirectToPayment, isLoading: paymentLoading } = useActivityPayment();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const swipeHandlers = useSwipeToClose({
    onClose: () => onOpenChange(false),
    threshold: 80,
    enabled: isMobile,
  });

  const getActivityEmoji = (type: string) => {
    const activityType = ALL_ACTIVITY_TYPES.find((a) => a.id === type);
    return activityType?.emoji || "📍";
  };

  const handlePayToJoin = async () => {
    setIsProcessing(true);
    setPaymentError(null);
    const success = await redirectToPayment(activity.id);
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
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
        )}

        {/* Hero Section - Background with Rainbow */}
        <div className="p-6 text-foreground bg-card">
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
              <span className="absolute -bottom-1 -right-1 text-2xl">
                {getActivityEmoji(activity.activity_type)}
              </span>
            </div>

            <div className="flex-1">
              <h2 className="text-xl font-bold flex items-center gap-2">
                {activity.note || t("plans.untitledPlan", "Untitled Plan")}
                <span className="text-lg">🌈</span>
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
          {/* Location */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <MapPin className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("common.location")}</p>
              <p className="font-medium">{activity.city}</p>
            </div>
          </div>

          {/* Date */}
          {activity.scheduled_for && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Calendar className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("common.date", "Date")}</p>
                <p className="font-medium">{format(new Date(activity.scheduled_for), "EEEE, MMMM d, yyyy")}</p>
              </div>
            </div>
          )}

          {/* Participants */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("common.participants")}</p>
              <p className="font-medium">
                {(activity.participant_count || 0) + 1} {t("common.going")}
              </p>
            </div>
          </div>

          {/* Price */}
          {activity.price_amount && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("common.entryFee")}</p>
                <p className="font-medium text-green-600">{activity.price_amount}</p>
              </div>
            </div>
          )}

          {/* Payment Error */}
          {paymentError && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{paymentError}</p>
            </div>
          )}

          {/* Pay to Join Button - Blue */}
          {activity.price_amount && (
            <button
              onClick={handlePayToJoin}
              disabled={isProcessing || paymentLoading}
              className="w-full py-3 rounded-xl text-white font-medium transition-all hover:opacity-90 disabled:opacity-50 mt-4 bg-blue-500 hover:bg-blue-600"
            >
              {isProcessing || paymentLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" />
                  {t("common.processing")}...
                </span>
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
