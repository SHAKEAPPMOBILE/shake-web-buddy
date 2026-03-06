import { Check } from "lucide-react";
import cameraIcon from "@/assets/camera-icon.png";
import { cn } from "@/lib/utils";
import { getDisplayAvatarUrl } from "@/lib/avatar";

// Local asset avatars using stable public paths (won't change between builds)
const localAvatarOptions = [
  { id: "avatar-1", src: "/avatars/avatar-new-1.png" },
  { id: "avatar-2", src: "/avatars/avatar-new-2.png" },
  { id: "avatar-3", src: "/avatars/avatar-new-3.png" },
  { id: "avatar-4", src: "/avatars/avatar-new-4.png" },
  { id: "avatar-5", src: "/avatars/avatar-new-5.png" },
  { id: "avatar-6", src: "/avatars/avatar-new-6.png" },
  { id: "avatar-7", src: "/avatars/avatar-new-7.png" },
  { id: "avatar-8", src: "/avatars/avatar-new-8.png" },
  { id: "avatar-9", src: "/avatars/avatar-new-9.png" },
  { id: "avatar-11", src: "/avatars/avatar-new-11.png" },
  { id: "avatar-12", src: "/avatars/avatar-new-12.png" },
  { id: "avatar-13", src: "/avatars/avatar-new-13.png" },
  { id: "avatar-14", src: "/avatars/avatar-new-14.png" },
  { id: "avatar-16", src: "/avatars/avatar-new-16.png" },
  { id: "avatar-17", src: "/avatars/avatar-new-17.png" },
  { id: "avatar-18", src: "/avatars/avatar-new-18.png" },
  { id: "avatar-20", src: "/avatars/avatar-new-20.png" },
  { id: "avatar-21", src: "/avatars/avatar-new-21.png" },
  { id: "avatar-22", src: "/avatars/avatar-new-22.png" },
  { id: "avatar-23", src: "/avatars/avatar-new-23.png" },
  { id: "avatar-24", src: "/avatars/avatar-new-24.png" },
  { id: "avatar-25", src: "/avatars/avatar-new-25.png" },
  { id: "avatar-26", src: "/avatars/avatar-new-26.png" },
  { id: "avatar-27", src: "/avatars/avatar-new-27.png" },
  { id: "avatar-28", src: "/avatars/avatar-new-28.png" },
  { id: "avatar-30", src: "/avatars/avatar-new-30.png" },
];

// Export avatar options (local only)
export const avatarOptions = [...localAvatarOptions];

interface AvatarPickerProps {
  selectedAvatar: string | null;
  onSelectAvatar: (avatarId: string) => void;
  onUploadClick?: () => void;
  onCameraClick?: () => void;
  customAvatarPreview?: string | null;
}

export function AvatarPicker({
  selectedAvatar,
  onSelectAvatar,
  onUploadClick,
  onCameraClick,
  customAvatarPreview,
}: AvatarPickerProps) {
  return (
    <div className="space-y-4">
      {/* Camera/Upload button */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onUploadClick}
          className={cn(
            "relative w-16 h-16 rounded-full border-2 transition-all duration-200 overflow-hidden hover:scale-110 active:scale-95",
            customAvatarPreview && selectedAvatar === "custom"
              ? "border-shake-green ring-2 ring-shake-green/20 scale-110"
              : "border-border hover:border-primary/50"
          )}
          title="Upload a photo"
        >
          {customAvatarPreview ? (
            <>
              <img src={getDisplayAvatarUrl(customAvatarPreview) ?? customAvatarPreview} alt="Custom avatar" className="w-full h-full object-cover" />
              {selectedAvatar === "custom" && (
                <div className="absolute inset-0 bg-shake-green/20 flex items-center justify-center animate-scale-in">
                  <Check className="w-5 h-5 text-shake-green" />
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full bg-muted rounded-full flex items-center justify-center p-2">
              <img src={cameraIcon} alt="Upload photo" className="w-full h-full object-contain" />
            </div>
          )}
        </button>
      </div>

      {/* Local avatars grid */}
      <div className="grid grid-cols-6 gap-2 max-w-sm mx-auto">
        {localAvatarOptions.map((avatar) => (
          <button
            key={avatar.id}
            type="button"
            onClick={() => onSelectAvatar(avatar.id)}
            className={cn(
              "relative w-12 h-12 rounded-full border-2 transition-all duration-200 overflow-hidden flex-shrink-0 hover:scale-110 active:scale-95",
              selectedAvatar === avatar.id
                ? "border-shake-green ring-2 ring-shake-green/20 scale-110"
                : "border-border hover:border-primary/50"
            )}
          >
            <img src={getDisplayAvatarUrl(avatar.src) ?? avatar.src} alt="Avatar option" className="w-full h-full object-cover" />
            {selectedAvatar === avatar.id && (
              <div className="absolute inset-0 bg-shake-green/20 flex items-center justify-center animate-scale-in">
                <Check className="w-4 h-4 text-shake-green" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
