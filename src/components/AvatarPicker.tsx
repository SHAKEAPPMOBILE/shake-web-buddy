import avatar1 from "@/assets/avatar-1.png";
import avatar2 from "@/assets/avatar-2.png";
import avatar3 from "@/assets/avatar-3.png";
import avatar4 from "@/assets/avatar-4.png";
import { Camera, Check, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export const avatarOptions = [
  { id: "avatar-1", src: avatar1 },
  { id: "avatar-2", src: avatar2 },
  { id: "avatar-3", src: avatar3 },
  { id: "avatar-4", src: avatar4 },
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
              ? "border-primary ring-2 ring-primary/20"
              : "border-border hover:border-primary/50"
          )}
          title="Upload from library"
        >
          {customAvatarPreview ? (
            <>
              <img src={customAvatarPreview} alt="Custom avatar" className="w-full h-full object-cover" />
              {selectedAvatar === "custom" && (
                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                  <Check className="w-5 h-5 text-primary" />
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
                ? "border-primary ring-2 ring-primary/20"
                : "border-border hover:border-primary/50"
            )}
          >
            <img src={avatar.src} alt="Avatar option" className="w-full h-full object-cover" />
            {selectedAvatar === avatar.id && (
              <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-primary" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
