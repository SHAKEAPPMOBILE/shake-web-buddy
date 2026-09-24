import type { ReactNode } from "react";

/** Frosted-glass centered card — same look as the "You're in!" confirmation
 *  (blurred backdrop, translucent white card, shine on top). Callers render
 *  at most one at a time. */
export function ShakeGlassDialog({
  onClose,
  icon,
  children,
}: {
  onClose: () => void;
  /** Content of the round badge at the top (activity icon or emoji). */
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 pointer-events-auto">
      <div
        className="absolute inset-0 pointer-events-auto"
        style={{ background: "rgba(0, 0, 0, 0.3)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-sm pointer-events-auto px-6 py-8 flex flex-col gap-3 text-center"
        style={{
          background: "rgba(255, 255, 255, 0.55)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.4)",
          borderRadius: "24px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 pointer-events-none"
          style={{
            height: "40%",
            background: "linear-gradient(to bottom, rgba(255,255,255,0.25), rgba(255,255,255,0))",
            borderRadius: "24px 24px 0 0",
          }}
        />
        {icon && (
          <div className="relative w-20 h-20 mx-auto rounded-full flex items-center justify-center border-2 border-blue-400 shadow-lg bg-white/70 text-4xl overflow-hidden">
            {icon}
          </div>
        )}
        <div className="relative flex flex-col gap-3">{children}</div>
      </div>
    </div>
  );
}
