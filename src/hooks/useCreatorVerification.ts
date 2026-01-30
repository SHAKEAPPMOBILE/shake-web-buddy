import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface CreatorVerification {
  id: string;
  user_id: string;
  document_url: string;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  auto_approved_at: string | null;
}

export function useCreatorVerification() {
  const { user } = useAuth();
  const [verification, setVerification] = useState<CreatorVerification | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const fetchVerification = useCallback(async () => {
    if (!user) {
      setVerification(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("creator_verifications")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      
      setVerification(data as CreatorVerification | null);
    } catch (error) {
      console.error("Error fetching verification:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchVerification();
  }, [fetchVerification]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`verification-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "creator_verifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setVerification(null);
          } else {
            setVerification(payload.new as CreatorVerification);
            
            // Show toast if status changed to approved
            if (payload.new && (payload.new as CreatorVerification).status === "approved") {
              toast.success("Your ID verification has been approved! You can now create paid activities.");
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const uploadVerification = useCallback(async (file: File): Promise<boolean> => {
    if (!user) {
      toast.error("Please sign in to verify your identity");
      return false;
    }

    setIsUploading(true);

    try {
      // Create a unique file name
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("id-verifications")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get the URL (note: this is a private bucket, so we store the path)
      const documentUrl = fileName;

      // Check if verification already exists
      if (verification) {
        // Update existing
        const { error: updateError } = await supabase
          .from("creator_verifications")
          .update({
            document_url: documentUrl,
            status: "pending",
            submitted_at: new Date().toISOString(),
            reviewed_at: null,
            rejection_reason: null,
            auto_approved_at: null,
          })
          .eq("user_id", user.id);

        if (updateError) throw updateError;
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from("creator_verifications")
          .insert({
            user_id: user.id,
            document_url: documentUrl,
          });

        if (insertError) throw insertError;
      }

      // Schedule auto-approval via edge function
      await supabase.functions.invoke("schedule-verification-approval", {
        body: { userId: user.id },
      });

      toast.success("ID submitted for verification. You'll be verified within 1 hour!");
      await fetchVerification();
      return true;
    } catch (error) {
      console.error("Error uploading verification:", error);
      toast.error("Failed to upload ID. Please try again.");
      return false;
    } finally {
      setIsUploading(false);
    }
  }, [user, verification, fetchVerification]);

  const isVerified = verification?.status === "approved";
  const isPending = verification?.status === "pending";
  const isRejected = verification?.status === "rejected";

  return {
    verification,
    isLoading,
    isUploading,
    isVerified,
    isPending,
    isRejected,
    uploadVerification,
    refetch: fetchVerification,
  };
}
