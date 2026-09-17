import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";
import { ALL_ACTIVITY_TYPES } from "@/data/activityTypes";
import { useTranslation } from "react-i18next";

interface PlanDescriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: {
    activity_type: string;
    title: string;
    description: string;
    creator_name?: string;
    creator_avatar?: string;
  };
  /** Tapping the avatar or "by {name}" opens the creator's profile — same
   * callback ActivityDetailDialog uses for its own header, so both dialogs
   * behave identically here. */
  onCreatorClick?: () => void;
}

/**
 * Same header treatment as ActivityDetailDialog (avatar + activity emoji +
 * title + tappable "by {name}") but for the plan's free-text description
 * instead of the join/payment details — that's ActivityDetailDialog's job
 * when a plan is paid. Kept as a separate component rather than adding a
 * "description mode" to ActivityDetailDialog, since the body content and
 * the join-payment logic have nothing in common.
 */
export function PlanDescriptionDialog({ open, onOpenChange, activity, onCreatorClick }: PlanDescriptionDialogProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const swipeHandlers = useSwipeToClose({
    onClose: () => onOpenChange(false),
    threshold: 80,
    enabled: isMobile,
  });

  // No badge for an unrecognized/generic type ("general", quick posts, etc.)
  // — falling back to a random 📍 pin misleadingly suggested a location tie-in
  // that isn't there.
  const getActivityEmoji = (type: string) => {
    const activityType = ALL_ACTIVITY_TYPES.find((a) => a.id === type);
    return activityType?.emoji || null;
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

        <div className="p-6 text-foreground bg-card">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCreatorClick?.();
              }}
              className="relative shrink-0"
            >
              <Avatar className="w-16 h-16 border-2 border-border shadow-lg">
                <AvatarImage src={activity.creator_avatar || undefined} alt={activity.creator_name} />
                <AvatarFallback className="bg-muted text-muted-foreground text-xl font-semibold">
                  {activity.creator_name?.charAt(0)?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              {getActivityEmoji(activity.activity_type) && (
                <span className="absolute -bottom-1 -right-1 text-2xl">
                  {getActivityEmoji(activity.activity_type)}
                </span>
              )}
            </button>

            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold">{activity.title}</h2>
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

        <div className="p-6 pt-0 max-h-[50vh] overflow-y-auto">
          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {activity.description}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
