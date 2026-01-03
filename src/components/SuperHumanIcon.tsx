import { cn } from "@/lib/utils";

interface SuperHumanIconProps {
  className?: string;
  size?: number;
}

export function SuperHumanIcon({ className, size = 24 }: SuperHumanIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-shake-yellow", className)}
    >
      {/* Face circle */}
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="currentColor"
        opacity="0.2"
      />
      {/* Big yellow glasses frame - left lens */}
      <ellipse
        cx="8"
        cy="11"
        rx="4"
        ry="3.5"
        fill="currentColor"
      />
      {/* Big yellow glasses frame - right lens */}
      <ellipse
        cx="16"
        cy="11"
        rx="4"
        ry="3.5"
        fill="currentColor"
      />
      {/* Glasses bridge */}
      <path
        d="M11.5 11C11.5 10.5 12 10 12.5 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Left lens inner (dark) */}
      <ellipse
        cx="8"
        cy="11"
        rx="2.5"
        ry="2"
        fill="hsl(var(--background))"
        opacity="0.8"
      />
      {/* Right lens inner (dark) */}
      <ellipse
        cx="16"
        cy="11"
        rx="2.5"
        ry="2"
        fill="hsl(var(--background))"
        opacity="0.8"
      />
      {/* Left lens shine - top */}
      <ellipse
        cx="6.5"
        cy="10"
        rx="1.2"
        ry="0.6"
        fill="white"
        opacity="0.7"
      />
      {/* Left lens shine - small dot */}
      <circle
        cx="9"
        cy="12"
        r="0.4"
        fill="white"
        opacity="0.5"
      />
      {/* Right lens shine - top */}
      <ellipse
        cx="14.5"
        cy="10"
        rx="1.2"
        ry="0.6"
        fill="white"
        opacity="0.7"
      />
      {/* Right lens shine - small dot */}
      <circle
        cx="17"
        cy="12"
        r="0.4"
        fill="white"
        opacity="0.5"
      />
      {/* Smile */}
      <path
        d="M9 16C9.5 17.5 14.5 17.5 15 16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
