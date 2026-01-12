import { cn } from "@/lib/utils";

type LoadingSpinnerProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-3xl",
};

export function LoadingSpinner({ className, size = "md" }: LoadingSpinnerProps) {
  return (
    <span
      className={cn("inline-block animate-spin", sizeClasses[size], className)}
      role="status"
      aria-label="Loading"
    >
      😊
    </span>
  );
}
