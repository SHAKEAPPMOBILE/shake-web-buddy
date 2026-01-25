import { X } from "lucide-react";

interface StatusVideoViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string;
  userName?: string;
}

export function StatusVideoViewer({
  open,
  onOpenChange,
  videoUrl,
  userName,
}: StatusVideoViewerProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black"
      onClick={() => onOpenChange(false)}
    >
      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(false);
        }}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Username */}
      {userName && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <h2 className="text-white font-medium">{userName}'s Status</h2>
        </div>
      )}

      {/* Video */}
      <div className="relative w-full max-w-md aspect-[9/16] bg-black rounded-lg overflow-hidden">
        <video
          src={videoUrl}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
          controls
          onClick={(e) => e.stopPropagation()}
          onEnded={() => onOpenChange(false)}
        />
      </div>
    </div>
  );
}
