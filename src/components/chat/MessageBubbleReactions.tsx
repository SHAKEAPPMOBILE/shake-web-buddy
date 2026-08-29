import type { RefObject, PointerEvent, ReactNode } from "react";
import {
  EVENT_CHAT_QUICK_REACTIONS,
  type ReactionChip,
} from "@/lib/eventChatReactions";

export type MessageBubbleReactionsVariant = "dark" | "light";

const pickerDark =
  "border-white/15 bg-[#1a1a24]/98 backdrop-blur-sm shadow-lg";
const pickerLight =
  "border-neutral-200 bg-white/95 backdrop-blur-sm shadow-lg";

const pickerBtnDark = "hover:bg-white/15";
const pickerBtnLight = "hover:bg-black/10";

const chipMineDark =
  "border-[#a78bfa]/70 bg-[#7c5cfc]/25 text-white ring-1 ring-[#c4b5fd]/50";
const chipMineLight =
  "border-blue-600/70 bg-blue-500/20 text-black ring-1 ring-blue-400/50";
const chipOtherDark = "border-white/15 bg-white/5 text-white/85 hover:bg-white/10";
const chipOtherLight = "border-neutral-200 bg-neutral-100 text-neutral-800 hover:bg-neutral-200/80";

type Props = {
  variant: MessageBubbleReactionsVariant;
  isOwn: boolean;
  messageId: string;
  enabled: boolean;
  reactionBarMessageId: string | null;
  mobileReactionBarRef: RefObject<HTMLDivElement | null>;
  reactionChips: ReactionChip[];
  onToggleReaction: (messageId: string, emoji: string) => void;
  onInteraction?: () => void;
  onPointerDown: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
  onPointerCancel: (e: PointerEvent) => void;
  onPointerLeave: (e: PointerEvent) => void;
  /** Optional tap handler on the whole bubble — e.g. floating-bubble pin toggle. */
  onClick?: () => void;
  /** e.g. name + time row — included in long-press / hover target */
  header?: ReactNode;
  children: ReactNode;
};

export function MessageBubbleReactions({
  variant,
  isOwn,
  messageId,
  enabled,
  reactionBarMessageId,
  mobileReactionBarRef,
  reactionChips,
  onToggleReaction,
  onInteraction,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  onClick,
  header,
  children,
}: Props) {
  const picker = variant === "dark" ? pickerDark : pickerLight;
  const pickerBtn = variant === "dark" ? pickerBtnDark : pickerBtnLight;
  const chipMine = variant === "dark" ? chipMineDark : chipMineLight;
  const chipOther = variant === "dark" ? chipOtherDark : chipOtherLight;

  const bump = () => onInteraction?.();

  return (
    <div
      className={`group/msg relative isolate z-0 min-w-0 w-full max-w-full ${isOwn ? "text-right" : "text-left"}`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {header}
      <div className={`flex flex-col gap-1.5 ${isOwn ? "items-end" : "items-start"} ${header ? "mt-0.5" : ""}`}>
        <div className={`relative w-full max-w-full ${isOwn ? "flex justify-end" : "flex justify-start"}`}>
          {enabled ? (
            <div
              className={`pointer-events-none absolute z-[100] bottom-full mb-2 hidden max-w-[min(100vw-2rem,360px)] gap-0.5 rounded-full border px-1.5 py-1 md:flex md:opacity-0 md:transition-opacity md:duration-150 ${picker} ${
                isOwn ? "right-0" : "left-0"
              } group-hover/msg:pointer-events-auto group-hover/msg:opacity-100`}
            >
              {EVENT_CHAT_QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`pointer-events-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg leading-none active:scale-95 ${pickerBtn}`}
                  aria-label={`React ${emoji}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    bump();
                    void onToggleReaction(messageId, emoji);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}

          {enabled && reactionBarMessageId === messageId ? (
            <div
              ref={mobileReactionBarRef}
              className={`absolute z-[100] bottom-full mb-2 flex max-w-[min(100vw-2rem,360px)] gap-0.5 rounded-full border px-1.5 py-1 md:hidden ${picker} ${
                isOwn ? "right-0" : "left-0"
              }`}
            >
              {EVENT_CHAT_QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg leading-none active:scale-95 ${pickerBtn}`}
                  aria-label={`React ${emoji}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    bump();
                    void onToggleReaction(messageId, emoji);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}

          {children}
        </div>

        {enabled && reactionChips.length > 0 ? (
          <div className={`flex w-full flex-wrap gap-1 ${isOwn ? "justify-end" : "justify-start"}`}>
            {reactionChips.map(({ emoji, count, mine }) => (
              <button
                key={emoji}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  bump();
                  void onToggleReaction(messageId, emoji);
                }}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                  mine ? chipMine : chipOther
                }`}
                aria-label={
                  mine ? `Remove your ${emoji} reaction (${count})` : `Add ${emoji} reaction (${count})`
                }
              >
                <span aria-hidden>{emoji}</span>
                <span className={variant === "dark" ? (mine ? "text-white/90" : "text-white/55") : mine ? "text-black/90" : "text-black/55"}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
