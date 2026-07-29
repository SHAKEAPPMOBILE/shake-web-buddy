import { Haptics, ImpactStyle } from "@capacitor/haptics";

/**
 * Fires a light "keyboard-style" tap on native iOS/Android (Taptic Engine /
 * vibration motor). No-ops silently on web or if the plugin isn't available
 * — never let a haptics failure interrupt typing.
 */
export function typingHaptic() {
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

/** Keydown handler: fires typingHaptic() for actual character/edit keys, skipping pure modifiers. */
const MODIFIER_KEYS = new Set([
  "Shift", "Control", "Alt", "Meta", "CapsLock", "Tab",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "Escape", "Home", "End", "PageUp", "PageDown",
]);

export function onTypingKeyDown(e: React.KeyboardEvent) {
  if (MODIFIER_KEYS.has(e.key) || e.ctrlKey || e.metaKey || e.altKey) return;
  typingHaptic();
}
