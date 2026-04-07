import { ButtonHTMLAttributes } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface MinimalBackButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  iconClassName?: string;
}

export function MinimalBackButton({
  className,
  iconClassName,
  type = "button",
  "aria-label": ariaLabel,
  ...props
}: MinimalBackButtonProps) {
  return (
    <button
      type={type}
      aria-label={ariaLabel ?? "Back"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-current/25 bg-transparent text-current transition-colors hover:border-current/45",
        className
      )}
      {...props}
    >
      <ChevronLeft className={cn("h-5 w-5", iconClassName)} />
    </button>
  );
}
