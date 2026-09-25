/** Push-notification preview for a chat message row (any chat table). */
export function messagePreview(text: string | null | undefined, messageType?: string | null): string {
  switch (messageType) {
    case "location": return "📍 Shared a location";
    case "gif": return "Sent a GIF";
    case "image": return "📷 Sent a photo";
    case "video": return "🎥 Sent a video";
  }
  const trimmed = (text ?? "").trim();
  return trimmed.length > 50 ? trimmed.slice(0, 50) + "…" : trimmed;
}
