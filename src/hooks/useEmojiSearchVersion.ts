import { useSyncExternalStore } from "react";
import { getEmojiSearchVersion, subscribeEmojiSearch } from "@/lib/emojiSearch";

/** Re-renders the caller when another language chunk finishes loading, so an emoji that couldn't be
 *  found a moment ago ("Tischtennis" before German arrived) gets found. Call it in any component that
 *  shows getPlanEmoji / detectActivityFromText results. */
export function useEmojiSearchVersion(): number {
  return useSyncExternalStore(subscribeEmojiSearch, getEmojiSearchVersion, getEmojiSearchVersion);
}
