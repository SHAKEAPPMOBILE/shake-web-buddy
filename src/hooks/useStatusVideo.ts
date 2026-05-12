import { useState, useEffect, useCallback } from "react";
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

  const fetchStatusVideo = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

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
  }, [userId]);

  useEffect(() => {
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
  }, [userId, fetchStatusVideo]);

  const hasActiveStatus = !!statusVideo && new Date(statusVideo.expires_at) > new Date();

  return { statusVideo, hasActiveStatus, loading, refetch: fetchStatusVideo };
}

export async function uploadStatusVideo(
  userId: string,
  videoFile: Blob | File
): Promise<string | null> {
  // Determine file extension from type or filename
  let extension = "mp4";
  if (videoFile instanceof File) {
    const nameParts = videoFile.name.split(".");
    if (nameParts.length > 1) extension = nameParts[nameParts.length - 1].toLowerCase();
  } else if (videoFile.type) {
    const typeParts = videoFile.type.split("/");
    if (typeParts.length > 1) extension = typeParts[1].split(";")[0];
  }

  const fileName = `${userId}/${Date.now()}.${extension}`;

  // Delete any existing status videos for this user
  await supabase.from("status_videos").delete().eq("user_id", userId);

  // Upload video to storage
  const { error: uploadError } = await supabase.storage
    .from("status-videos")
    .upload(fileName, videoFile, {
      contentType: videoFile.type || "video/mp4",
      upsert: true,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return null;
  }

  // Get public URL
  const { data: urlData } = supabase.storage.from("status-videos").getPublicUrl(fileName);

  // Insert into status_videos table
  const { error: insertError } = await supabase.from("status_videos").insert({
    user_id: userId,
    video_url: urlData.publicUrl,
  });

  if (insertError) {
    console.error("Insert error:", insertError);
    return null;
  }

  // Set this video as the user's avatar so it appears on their profile
  const { error: avatarError } = await supabase
    .from("profiles")
    .update({ avatar_url: urlData.publicUrl })
    .eq("user_id", userId);

  if (avatarError) {
    console.error("Failed to update avatar to status video:", avatarError);
  }

  return urlData.publicUrl;
}

export async function deleteStatusVideo(userId: string): Promise<boolean> {
  console.log("[deleteStatusVideo] Starting deletion for user:", userId);

  // 1. Fetch existing DB records to get storage paths before deleting
  const { data: existingVideos, error: fetchError } = await supabase
    .from("status_videos")
    .select("video_url")
    .eq("user_id", userId);

  console.log(
    "[deleteStatusVideo] Found existing videos:",
    existingVideos?.length ?? 0,
    fetchError ? `(fetch error: ${fetchError.message})` : ""
  );

  // 2. Delete the DB records
  const { error: dbError } = await supabase
    .from("status_videos")
    .delete()
    .eq("user_id", userId);

  if (dbError) {
    console.error("[deleteStatusVideo] DB delete failed:", dbError);
    return false;
  }
  console.log("[deleteStatusVideo] DB records deleted");

  // 3. Delete files from Supabase Storage
  if (existingVideos && existingVideos.length > 0) {
    const filePaths = existingVideos
      .map((v) => {
        try {
          // Parse path from public URL:
          // https://xxx.supabase.co/storage/v1/object/public/status-videos/<path>
          const url = new URL(v.video_url);
          const marker = "/public/status-videos/";
          const idx = url.pathname.indexOf(marker);
          if (idx !== -1) {
            // Strip any query params from the path segment
            return url.pathname.slice(idx + marker.length).split("?")[0];
          }
        } catch {
          // Fallback: string search
          const marker = "/status-videos/";
          const idx = v.video_url.indexOf(marker);
          if (idx !== -1) {
            return v.video_url.slice(idx + marker.length).split("?")[0];
          }
        }
        return null;
      })
      .filter(Boolean) as string[];

    console.log("[deleteStatusVideo] Storage paths to remove:", filePaths);

    if (filePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("status-videos")
        .remove(filePaths);
      if (storageError) {
        console.warn("[deleteStatusVideo] Storage removal error (non-fatal):", storageError);
      } else {
        console.log("[deleteStatusVideo] Storage files removed");
      }
    }
  }

  // 4. Clear avatar_url ONLY if it currently points to one of the deleted status video URLs.
  //    This avoids wiping a real profile photo the user uploaded separately.
  const statusVideoUrls = new Set((existingVideos || []).map((v) => v.video_url));
  if (statusVideoUrls.size > 0) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("user_id", userId)
      .maybeSingle();

    if (profile?.avatar_url && statusVideoUrls.has(profile.avatar_url)) {
      const { error: avatarError } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("user_id", userId);
      if (avatarError) {
        console.warn("[deleteStatusVideo] Avatar clear error (non-fatal):", avatarError);
      } else {
        console.log("[deleteStatusVideo] Avatar URL cleared (was pointing to status video)");
      }
    } else {
      console.log("[deleteStatusVideo] Avatar URL is a real profile photo — leaving unchanged");
    }
  }

  console.log("[deleteStatusVideo] Done ✓");
  return true;
}
