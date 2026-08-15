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

/**
 * Delegated tap haptic for buttons/icons — call once from a useEffect to wire
 * up a capture-phase `pointerdown` listener on `document` for the lifetime of
 * a screen, instead of adding a haptic call to every individual onClick.
 * Fires on pointerdown (not click) to match native buttons, which trigger
 * their haptic on touch-down rather than waiting for touch-up.
 *
 * Usage:
 *   useEffect(() => attachActionHaptics(), []);
 */
export function attachActionHaptics(): () => void {
  const handler = (e: PointerEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, [role="button"]')) {
      typingHaptic();
    }
  };
  document.addEventListener("pointerdown", handler, true);
  return () => document.removeEventListener("pointerdown", handler, true);
}
