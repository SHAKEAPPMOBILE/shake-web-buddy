import avatar1 from "@/assets/avatar-1.png";
import avatar2 from "@/assets/avatar-2.png";
import avatar3 from "@/assets/avatar-3.png";
import avatar4 from "@/assets/avatar-4.png";
import polaroidFriends from "@/assets/polaroid-friends.png";
import polaroidActivities from "@/assets/polaroid-activities.png";
import hikerIllustration from "@/assets/hiker-illustration.png";
import barManAndCook from "@/assets/bar-man-and-cook.png";
import { Camera, Check, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export const avatarOptions = [
  { id: "avatar-1", src: avatar1 },
  { id: "avatar-2", src: avatar2 },
  { id: "avatar-3", src: avatar3 },
  { id: "avatar-4", src: avatar4 },
  { id: "avatar-5", src: polaroidFriends },
  { id: "avatar-6", src: polaroidActivities },
  { id: "avatar-7", src: hikerIllustration },
  { id: "avatar-8", src: barManAndCook },
];

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
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground text-center">Choose an avatar or upload your own</p>
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {/* Take photo option */}
        <button
          type="button"
          onClick={onCameraClick}
          className={cn(
            "relative w-14 h-14 rounded-full border-2 transition-all overflow-hidden",
            "border-border hover:border-primary/50"
          )}
          title="Take a photo"
        >
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <Camera className="w-5 h-5 text-muted-foreground" />
          </div>
        </button>

        {/* Upload from library option */}
        <button
          type="button"
          onClick={onUploadClick}
          className={cn(
            "relative w-14 h-14 rounded-full border-2 transition-all overflow-hidden",
            customAvatarPreview && selectedAvatar === "custom"
              ? "border-shake-green ring-2 ring-shake-green/20"
              : "border-border hover:border-primary/50"
          )}
          title="Upload from library"
        >
          {customAvatarPreview ? (
            <>
              <img src={customAvatarPreview} alt="Custom avatar" className="w-full h-full object-cover" />
              {selectedAvatar === "custom" && (
                <div className="absolute inset-0 bg-shake-green/20 flex items-center justify-center">
                  <Check className="w-5 h-5 text-shake-green" />
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <Upload className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
        </button>

        {/* Preset avatars */}
        {avatarOptions.map((avatar) => (
          <button
            key={avatar.id}
            type="button"
            onClick={() => onSelectAvatar(avatar.id)}
            className={cn(
              "relative w-14 h-14 rounded-full border-2 transition-all overflow-hidden",
              selectedAvatar === avatar.id
                ? "border-shake-green ring-2 ring-shake-green/20"
                : "border-border hover:border-primary/50"
            )}
          >
            <img src={avatar.src} alt="Avatar option" className="w-full h-full object-cover" />
            {selectedAvatar === avatar.id && (
              <div className="absolute inset-0 bg-shake-green/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-shake-green" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
