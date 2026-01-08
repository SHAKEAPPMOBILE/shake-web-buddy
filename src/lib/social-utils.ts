/**
 * Converts a social media handle or URL to a full URL
 */
export function normalizeInstagramUrl(input: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  
  // Already a full URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  
  // Remove @ prefix if present
  const handle = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  return `https://instagram.com/${handle}`;
}

export function normalizeTwitterUrl(input: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  
  // Already a full URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  
  // Remove @ prefix if present
  const handle = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  return `https://x.com/${handle}`;
}
