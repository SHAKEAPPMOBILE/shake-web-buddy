import { supabase } from "@/integrations/supabase/client";

export const CHAT_MEDIA_BUCKET = "chat-media";
export const CHAT_MEDIA_MAX_SIZE_MB = 50;

/**
 * Uploads a video or image file to the chat-media storage bucket.
 * Path: {userId}/{timestamp}_{sanitizedFilename}
 * Returns the public URL on success.
 */
export async function uploadChatMedia(file: File, userId: string): Promise<string> {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${timestamp}_${safeName}`;

  const { data, error } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

/**
 * Returns "video" or "image" based on the file's MIME type.
 */
export function getMediaMessageType(file: File): "video" | "image" {
  return file.type.startsWith("video/") ? "video" : "image";
}
