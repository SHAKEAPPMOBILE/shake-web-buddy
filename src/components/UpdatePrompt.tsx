import { openAppStore } from "@/lib/appStoreLinks";

interface UpdatePromptProps {
  visible: boolean;
}

export function UpdatePrompt({ visible }: UpdatePromptProps) {
  if (!visible) return null;

  const handleUpdate = () => {
    void openAppStore();
  };

  return (
    // Full-screen overlay — non-dismissable (no backdrop click handler)
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
    >
      <div
        className="w-full max-w-lg px-6 pt-7 pb-10 flex flex-col items-center gap-5"
        style={{
          background: "#0d0d1a",
          borderTop: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "28px 28px 0 0",
        }}
      >
        {/* Handle bar */}
        <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />

        {/* Icon */}
        <span className="text-5xl">🚀</span>

        {/* Heading */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-white text-xl font-bold">New version available!</h2>
          <p className="text-white/60 text-sm leading-relaxed">
            A new version of SHAKE is available.{"\n"}Update now for the best experience.
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={handleUpdate}
          className="w-full py-4 rounded-full font-semibold text-white text-base"
          style={{ background: "linear-gradient(to right, #2563EB, #7c3aed)" }}
        >
          Update Now
        </button>
      </div>
    </div>
  );
}
