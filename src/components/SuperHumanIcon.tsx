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
      {/* Cape flowing behind */}
      <path
        d="M7 10C5 12 4 16 5 20C6 20 8 18 12 18C16 18 18 20 19 20C20 16 19 12 17 10"
        fill="currentColor"
        opacity="0.3"
      />
      {/* Body */}
      <path
        d="M12 13C14.2091 13 16 11.2091 16 9C16 6.79086 14.2091 5 12 5C9.79086 5 8 6.79086 8 9C8 11.2091 9.79086 13 12 13Z"
        fill="currentColor"
      />
      {/* Star burst behind head */}
      <path
        d="M12 2L13 4L15 3L14 5L16 6L14 6.5L15 8L13 7L12 9L11 7L9 8L10 6.5L8 6L10 5L9 3L11 4L12 2Z"
        fill="currentColor"
        opacity="0.6"
      />
      {/* Arms raised in power pose */}
      <path
        d="M6 8L4 5M18 8L20 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Legs */}
      <path
        d="M10 13V18M14 13V18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Lightning bolts */}
      <path
        d="M3 12L5 11L4 13L6 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 12L19 11L20 13L18 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
