import { useState } from "react";
import { User, Video } from "lucide-react";
import { useStatusVideo } from "@/hooks/useStatusVideo";
import { StatusVideoViewer } from "./StatusVideoViewer";
import { cn } from "@/lib/utils";

interface ProfileAvatarWithStatusProps {
  userId: string;
  avatarUrl: string | null;
  userName?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  showStatusBadge?: boolean;
  onClick?: () => void;
  className?: string;
}

const sizeClasses = {
  sm: "w-10 h-10",
  md: "w-12 h-12",
  lg: "w-16 h-16",
  xl: "w-24 h-24",
};

const ringClasses = {
  sm: "ring-2 ring-offset-1",
  md: "ring-2 ring-offset-2",
  lg: "ring-[3px] ring-offset-2",
  xl: "ring-4 ring-offset-2",
};

const iconSizes = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
  xl: "w-12 h-12",
};

export function ProfileAvatarWithStatus({
  userId,
  avatarUrl,
  userName,
  size = "md",
  showStatusBadge = true,
  onClick,
  className,
}: ProfileAvatarWithStatusProps) {
  const { statusVideo, hasActiveStatus } = useStatusVideo(userId);
  const [showStatusViewer, setShowStatusViewer] = useState(false);

  const handleClick = () => {
    if (hasActiveStatus && statusVideo) {
      setShowStatusViewer(true);
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={cn(
          "relative rounded-full overflow-visible bg-muted border-2 border-border flex items-center justify-center transition-all",
          sizeClasses[size],
          hasActiveStatus && [
            ringClasses[size],
            "ring-shake-green ring-offset-background",
          ],
          onClick || hasActiveStatus ? "cursor-pointer hover:opacity-90" : "cursor-default",
          className
        )}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={userName || "User"}
            className="w-full h-full object-cover rounded-full"
          />
        ) : (
          <User className={cn("text-muted-foreground", iconSizes[size])} />
        )}

        {/* Status video indicator */}
        {showStatusBadge && hasActiveStatus && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-shake-green flex items-center justify-center border-2 border-background">
            <Video className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </button>

      {/* Status viewer */}
      {statusVideo && (
        <StatusVideoViewer
          open={showStatusViewer}
          onOpenChange={setShowStatusViewer}
          videoUrl={statusVideo.video_url}
          userName={userName || undefined}
        />
      )}
    </>
  );
}
