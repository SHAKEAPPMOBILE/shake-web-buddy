import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface StatusVideo {
  id: string;
  user_id: string;
  video_url: string;
  created_at: string;
  expires_at: string;
}

export function useStatusVideo(userId: string | undefined) {
  const [statusVideo, setStatusVideo] = useState<StatusVideo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchStatusVideo = async () => {
      const { data, error } = await supabase
        .from("status_videos")
        .select("*")
        .eq("user_id", userId)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setStatusVideo(data as StatusVideo);
      } else {
        setStatusVideo(null);
      }
      setLoading(false);
    };

    fetchStatusVideo();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`status_video_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "status_videos",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchStatusVideo();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const hasActiveStatus = !!statusVideo && new Date(statusVideo.expires_at) > new Date();

  return { statusVideo, hasActiveStatus, loading };
}

export async function uploadStatusVideo(
  userId: string,
  videoBlob: Blob
): Promise<string | null> {
  const fileName = `${userId}/${Date.now()}.webm`;

  // Delete any existing status videos for this user
  await supabase
    .from("status_videos")
    .delete()
    .eq("user_id", userId);

  // Upload video to storage
  const { error: uploadError } = await supabase.storage
    .from("status-videos")
    .upload(fileName, videoBlob, {
      contentType: "video/webm",
      upsert: true,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return null;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("status-videos")
    .getPublicUrl(fileName);

  // Insert into status_videos table
  const { error: insertError } = await supabase
    .from("status_videos")
    .insert({
      user_id: userId,
      video_url: urlData.publicUrl,
    });

  if (insertError) {
    console.error("Insert error:", insertError);
    return null;
  }

  return urlData.publicUrl;
}

export async function deleteStatusVideo(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from("status_videos")
    .delete()
    .eq("user_id", userId);

  return !error;
}
