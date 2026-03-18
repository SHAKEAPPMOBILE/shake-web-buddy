import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type ReportableContentType = "post" | "comment" | "message" | "status_video";

export const useReportContent = () => {
  const [isReporting, setIsReporting] = useState(false);
  const { toast } = useToast();

  const reportContent = async (
    contentId: string,
    contentType: ReportableContentType,
    reason?: string
  ) => {
    setIsReporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("reported_content")
        .insert({
          reporter_id: user.id,
          content_id: contentId,
          content_type: contentType,
          reason: reason ?? null,
        });

      if (error) throw error;

      toast({
        title: "Content reported",
        description: "Thank you. Our team will review this shortly.",
      });
    } catch {
      toast({
        title: "Failed to report",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsReporting(false);
    }
  };

  return { reportContent, isReporting };
};

