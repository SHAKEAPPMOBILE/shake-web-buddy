/**
 * Returns true if the avatar URL is considered valid (user has set an avatar).
 * Treats as valid: preset paths (/avatars/avatar-new-*), shakeapp.today, and any absolute or root-relative URL.
 */
export function hasValidAvatarUrl(avatarUrl: string | null | undefined): boolean {
  if (avatarUrl == null || avatarUrl.trim() === "") return false;
  const u = avatarUrl.trim();
  return (
    u.includes("/avatars/avatar-new-") ||
    u.includes("shakeapp.today") ||
    u.startsWith("http://") ||
    u.startsWith("https://") ||
    u.startsWith("data:") ||
    u.startsWith("blob:") ||
    u.startsWith("/")
  );
}

/**
 * Returns a URL suitable for displaying an avatar image.
 * - Absolute URLs (http/https) and already-usable data:/blob: URLs (e.g. a
 *   freshly-picked file's FileReader preview, before it's uploaded) are
 *   returned as-is. Treating a data: URL as a relative path here used to
 *   prepend the site origin to the raw base64 payload, producing a
 *   multi-megabyte "URL" the browser then tried to GET — a guaranteed
 *   414 Request-URI Too Long.
 * - Relative paths (e.g. /avatars/avatar-new-1.png) are resolved against the current origin
 *   so they load correctly regardless of base path or deployment.
 */
export function getDisplayAvatarUrl(avatarUrl: string | null | undefined): string | undefined {
  if (avatarUrl == null || avatarUrl.trim() === "") return undefined;
  const trimmed = avatarUrl.trim();
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }
  if (typeof window !== "undefined") {
    const base = window.location.origin;
    return trimmed.startsWith("/") ? `${base}${trimmed}` : `${base}/${trimmed}`;
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
