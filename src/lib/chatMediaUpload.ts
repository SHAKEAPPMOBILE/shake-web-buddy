import { supabase } from "@/integrations/supabase/client";
import { moderateMediaFile } from "@/lib/contentModeration";

export const CHAT_MEDIA_BUCKET = "chat-media";
export const CHAT_MEDIA_MAX_SIZE_MB = 50;

/** Thrown when a file is blocked by content moderation — .reason is safe to show the user directly. */
export class ContentBlockedError extends Error {
  reason: string;
  constructor(reason: string) {
    super(reason);
    this.name = "ContentBlockedError";
    this.reason = reason;
  }
}

/**
 * Uploads a video or image file to the chat-media storage bucket.
 * Path: {userId}/{timestamp}_{sanitizedFilename}
 * Returns the public URL on success.
 *
 * Runs sexual/violent content moderation first — sent members' chats can
 * reach anyone in the conversation, so a blocked file is never stored at all.
 */
export async function uploadChatMedia(file: File, userId: string): Promise<string> {
  const moderation = await moderateMediaFile(file);
  if (!moderation.allowed) {
    throw new ContentBlockedError(moderation.reason || "This file isn't allowed.");
  }

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
