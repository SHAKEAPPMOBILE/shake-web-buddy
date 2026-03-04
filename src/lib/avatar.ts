/**
 * Returns a URL suitable for displaying an avatar image.
 * - Absolute URLs (http/https) are returned as-is.
 * - Relative paths (e.g. /avatars/avatar-new-1.png) are resolved against the current origin
 *   so they load correctly regardless of base path or deployment.
 */
export function getDisplayAvatarUrl(avatarUrl: string | null | undefined): string | undefined {
  if (avatarUrl == null || avatarUrl.trim() === "") return undefined;
  const trimmed = avatarUrl.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (typeof window !== "undefined") {
    const base = window.location.origin;
    return trimmed.startsWith("/") ? `${base}${trimmed}` : `${base}/${trimmed}`;
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
