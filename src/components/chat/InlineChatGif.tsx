import type { SyntheticEvent } from "react";

export type InlineChatGifVariant = "dark" | "light";

const variantClasses: Record<InlineChatGifVariant, string> = {
  dark: "bg-black/20 ring-1 ring-white/10",
  light: "bg-white/90 ring-1 ring-black/10",
};

export function InlineChatGif({
  src,
  variant = "dark",
  onLoad,
  className,
}: {
  src: string;
  variant?: InlineChatGifVariant;
  onLoad?: (e: SyntheticEvent<HTMLImageElement>) => void;
  className?: string;
}) {
  return (
    <div className={`inline-block max-w-[260px] shrink-0 ${className ?? ""}`}>
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className={`block h-auto max-h-none w-full max-w-[260px] rounded-2xl object-contain ${variantClasses[variant]}`}
        onLoad={onLoad}
      />
    </div>
  );
}
