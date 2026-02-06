import { useState } from "react";
import { Flag, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

type ReportReason = "spam" | "harassment" | "inappropriate_content" | "fake_profile" | "underage" | "other";

interface ReportUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportedUserId: string;
  reportedUserName: string | null;
}

export function ReportUserDialog({
  open,
  onOpenChange,
  reportedUserId,
  reportedUserName,
}: ReportUserDialogProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  const REPORT_REASONS: { value: ReportReason; label: string; description: string }[] = [
    { value: "spam", label: t("report.spam"), description: t("report.spamDesc") },
    { value: "harassment", label: t("report.harassment"), description: t("report.harassmentDesc") },
    { value: "inappropriate_content", label: t("report.inappropriateContent"), description: t("report.inappropriateContentDesc") },
    { value: "other", label: t("report.other"), description: t("report.otherDesc") },
  ];

  const swipeHandlers = useSwipeToClose({
    onClose: () => handleClose(false),
    threshold: 80,
    enabled: isMobile,
  });

  const handleSubmit = async () => {
    if (!reason) {
      toast.error(t("report.selectReason"));
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        toast.error(t("report.mustBeLoggedIn"));
        return;
      }

      const { error } = await supabase.from("user_reports").insert({
        reporter_id: user.id,
        reported_user_id: reportedUserId,
        reason: reason,
        description: description.trim() || null,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error(t("report.alreadyReported"));
        } else {
          console.error("Error submitting report:", error);
          toast.error(t("report.submitFailed"));
        }
        return;
      }

      // Send email notification to admin (fire and forget - don't block on this)
      supabase.functions.invoke("send-report-notification", {
        body: {
          reportedUserId,
          reportedUserName,
          reason,
          description: description.trim() || null,
        },
      }).catch((emailError) => {
        console.error("Failed to send report notification email:", emailError);
        // Don't show error to user - report was still saved
      });

      toast.success(t("report.submitSuccess"));
      setReason(null);
      setDescription("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting report:", error);
      toast.error(t("report.submitFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setReason(null);
      setDescription("");
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="sm:max-w-md bg-card h-[100dvh] sm:h-auto sm:max-h-[90vh] flex flex-col p-0 gap-0"
        {...(isMobile ? swipeHandlers : {})}
      >
        {/* Swipe indicator for mobile */}
        {isMobile && (
          <div className="flex justify-center py-3 shrink-0 safe-area-top">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
        )}

        {/* Fixed header */}
        <div className="shrink-0 px-6 pt-4 pb-2">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Flag className="w-5 h-5" />
              {t("report.title")}
            </DialogTitle>
            <DialogDescription>
              {t("report.description", { name: reportedUserName || "this user" })}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4 space-y-4">
            {/* Warning notice */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                {t("report.warning")}
              </p>
            </div>

            {/* Reason selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t("report.reasonLabel")}</Label>
              <RadioGroup
                value={reason || ""}
                onValueChange={(value) => setReason(value as ReportReason)}
                className="space-y-2"
              >
                {REPORT_REASONS.map((item) => (
                  <div
                    key={item.value}
                    className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                      reason === item.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setReason(item.value)}
                  >
                    <RadioGroupItem value={item.value} id={item.value} className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor={item.value} className="font-medium cursor-pointer">
                        {item.label}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Additional details */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">
                {t("report.additionalDetails")}
              </Label>
              <Textarea
                id="description"
                placeholder={t("report.placeholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={500}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {description.length}/500
              </p>
            </div>
          </div>
        </ScrollArea>

        {/* Fixed footer with buttons */}
        <div className="shrink-0 px-6 py-4 border-t border-border safe-area-bottom">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
              className="flex-1"
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleSubmit}
              className="flex-1"
              disabled={isSubmitting || !reason}
            >
              {isSubmitting ? t("report.submitting") : t("report.submit")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
