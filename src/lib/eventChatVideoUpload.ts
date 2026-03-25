import { supabase } from "@/integrations/supabase/client";

export const EVENT_CHAT_VIDEO_BUCKET = "event-chat-videos";
export const EVENT_CHAT_VIDEO_MAX_SECONDS = 60;

export function getVideoDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "metadata";
    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
    };
    video.onloadedmetadata = () => {
      const d = video.duration;
      cleanup();
      if (!Number.isFinite(d) || d <= 0) {
        reject(new Error("Could not read video duration"));
        return;
      }
      resolve(d);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("Could not load video"));
    };
    video.src = objectUrl;
  });
}

export function formatVideoDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/**
 * Uploads to `event-chat-videos/{userId}/{eventId}/{timestamp}.mp4` (multipart FormData, XHR progress).
 */
export async function uploadEventChatVideoWithProgress(
  file: File,
  userId: string,
  eventId: string,
  accessToken: string,
  onProgress: (ratio: number) => void
): Promise<string> {
  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const anon =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !anon) throw new Error("Supabase is not configured");

  const objectName = `${Date.now()}.mp4`;
  const relativePath = `${userId}/${eventId}/${objectName}`;
  const pathSegments = [EVENT_CHAT_VIDEO_BUCKET, userId, eventId, objectName];
  const encodedObjectPath = pathSegments.map((s) => encodeURIComponent(s)).join("/");
  const uploadUrl = `${base}/storage/v1/object/${encodedObjectPath}`;

  const formData = new FormData();
  formData.append("cacheControl", "3600");
  formData.append("", file, file.name || "video.mp4");

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("apikey", anon);
    xhr.setRequestHeader("x-upsert", "false");

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && evt.total > 0) {
        onProgress(Math.min(0.99, evt.loaded / evt.total));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve();
        return;
      }
      try {
        const err = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        reject(new Error(err.message || err.error || `Upload failed (${xhr.status})`));
      } catch {
        reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(formData);
  });

  const { data } = supabase.storage.from(EVENT_CHAT_VIDEO_BUCKET).getPublicUrl(relativePath);
  return data.publicUrl;
}
