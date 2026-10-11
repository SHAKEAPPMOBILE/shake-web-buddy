import { useCallback, useSyncExternalStore } from "react";

// "Floating text" — short chat messages drift around the screen instead of sitting in a list.
// Some people find that annoying, so it can be switched off from a chat's ⋮ menu. One setting for
// every chat, remembered on this device.
const KEY = "shake_chat_floating_text";
const listeners = new Set<() => void>();

function read(): boolean {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}

let current = read();

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
};

function write(next: boolean) {
  current = next;
  try { localStorage.setItem(KEY, next ? "on" : "off"); } catch { /* storage unavailable: setting lasts until the app closes */ }
  listeners.forEach((l) => l());
}

/** [floatingTextOn, setFloatingTextOn] — shared by every chat screen. */
export function useChatFloating(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, () => current, () => true);
  const set = useCallback((next: boolean) => write(next), []);
  return [on, set];
}
