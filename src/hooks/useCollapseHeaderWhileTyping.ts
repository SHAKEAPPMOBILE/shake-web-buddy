import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";

/**
 * Chats with a tall header curtain leave no room for the typing box once the keyboard opens: the
 * header keeps its height, the keyboard takes the bottom half, and the box ends up underneath it.
 * Put the returned handlers on the message input: the header tucks into its slim bar while the
 * person types, and goes back to the size it had when they finish.
 */
export function useCollapseHeaderWhileTyping<S extends string>(
  snap: S,
  setSnap: Dispatch<SetStateAction<S>>,
  collapsed: S,
) {
  const restoreTo = useRef<S | null>(null);

  const onFocus = useCallback(() => {
    if (snap === collapsed) return;
    restoreTo.current = snap;
    setSnap(collapsed);
  }, [snap, collapsed, setSnap]);

  const onBlur = useCallback(() => {
    const back = restoreTo.current;
    restoreTo.current = null;
    // Only restore if they haven't moved the header themselves in the meantime.
    if (back) setSnap((current) => (current === collapsed ? back : current));
  }, [collapsed, setSnap]);

  return { onFocus, onBlur };
}
