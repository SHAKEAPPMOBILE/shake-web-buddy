import { useId } from "react";

type Name = "location" | "calendar" | "people" | "money";

// Each icon has its own two-colour gradient (no purple).
const GRADIENTS: Record<Name, [string, string]> = {
  location: ["#FF4D6D", "#FF9A3C"],
  calendar: ["#22D3EE", "#2563EB"],
  people: ["#FF8A3D", "#FFC83D"],
  money: ["#10B981", "#A3E635"],
};

/**
 * Thin-line, geometric icons with a gradient stroke and a filled accent, for the join sheet's detail rows.
 * Drawn on a 24px grid so they stay crisp at any size.
 */
export function FutureIcon({ name, className }: { name: Name; className?: string }) {
  const id = useId().replace(/:/g, "");
  const [from, to] = GRADIENTS[name];
  const stroke = `url(#${id})`;
  const common = { stroke, strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      {name === "location" && (
        <>
          <path d="M12 20.5s6.2-5.1 6.2-10.1a6.2 6.2 0 0 0-12.4 0c0 5 6.2 10.1 6.2 10.1Z" {...common} />
          <circle cx="12" cy="10.2" r="2.3" fill={stroke} />
          <ellipse cx="12" cy="21.4" rx="5.2" ry="1.2" {...common} strokeWidth={1.2} opacity={0.4} />
        </>
      )}
      {name === "calendar" && (
        <>
          <rect x="3.5" y="5" width="17" height="15" rx="4.5" {...common} />
          <path d="M8 3v3.4M16 3v3.4M3.5 10h17" {...common} />
          <circle cx="8.3" cy="13.6" r="1.1" fill={stroke} />
          <circle cx="12" cy="13.6" r="1.1" fill={stroke} />
          <circle cx="15.7" cy="13.6" r="1.1" fill={stroke} opacity={0.45} />
          <circle cx="8.3" cy="16.9" r="1.1" fill={stroke} opacity={0.45} />
          <circle cx="12" cy="16.9" r="1.1" fill={stroke} />
        </>
      )}
      {name === "people" && (
        <>
          <circle cx="9" cy="8.6" r="3.1" {...common} />
          <path d="M3.4 19.4c.6-3.2 3-4.8 5.6-4.8s5 1.6 5.6 4.8" {...common} />
          <circle cx="17" cy="7.6" r="2.3" fill={stroke} opacity={0.35} stroke="none" />
          <path d="M15.6 14.4c2.5-.2 4.5 1.1 5.2 4" {...common} opacity={0.6} />
        </>
      )}
      {name === "money" && (
        <>
          <path d="M12 2.8 19.9 7.4v9.2L12 21.2 4.1 16.6V7.4L12 2.8Z" {...common} />
          <path d="M14.4 9.6c-.4-.9-1.3-1.4-2.4-1.4-1.4 0-2.4.7-2.4 1.8 0 2.4 4.9 1.1 4.9 3.5 0 1-1 1.8-2.5 1.8-1.2 0-2.2-.5-2.6-1.5M12 6.9v1.3M12 15.1v1.3" {...common} />
        </>
      )}
    </svg>
  );
}
