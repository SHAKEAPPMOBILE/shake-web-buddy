import { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useReportContent, ReportableContentType } from "@/hooks/useReportContent";
import { useNavigate } from "react-router-dom";

interface ReportContentButtonProps {
  contentId: string;
  contentType: ReportableContentType;
  iconOnly?: boolean;
}

const REPORT_REASONS = [
  "Inappropriate or offensive",
  "Spam or misleading",
  "Harassment or bullying",
  "Hate speech",
  "Violence or dangerous content",
  "Other",
];

export const ReportContentButton = ({ contentId, contentType, iconOnly = false }: ReportContentButtonProps) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { reportContent, isReporting } = useReportContent();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    setSubmitted(true);
    await reportContent(contentId, contentType, reason);
    setOpen(false);
    setReason("");
    setSubmitted(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && !submitted) {
      // Cancelled or dismissed — navigate to Plans tab to prevent the
      // underlying card click from opening the activity chat
      navigate("/");
    }
    setOpen(next);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-destructive"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      >
        <Flag className="h-4 w-4" />
        {!iconOnly && <span className="ml-1">Report</span>}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report this content</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Help us keep Shake safe. Select a reason and our team will review it.
          </p>
          <Select onValueChange={setReason} value={reason}>
            <SelectTrigger>
              <SelectValue placeholder="Select a reason" />
            </SelectTrigger>
            <SelectContent>
              {REPORT_REASONS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button variant="destructive" disabled={!reason || isReporting} onClick={handleSubmit}>
              {isReporting ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

