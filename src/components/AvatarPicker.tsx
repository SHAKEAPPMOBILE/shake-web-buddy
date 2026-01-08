import avatarNew1 from "@/assets/avatar-new-1.png";
import avatarNew2 from "@/assets/avatar-new-2.png";
import avatarNew3 from "@/assets/avatar-new-3.png";
import avatarNew4 from "@/assets/avatar-new-4.png";
import avatarNew5 from "@/assets/avatar-new-5.png";
import avatarNew6 from "@/assets/avatar-new-6.png";
import avatarNew7 from "@/assets/avatar-new-7.png";
import avatarNew8 from "@/assets/avatar-new-8.png";
import avatarNew9 from "@/assets/avatar-new-9.png";
import avatarNew11 from "@/assets/avatar-new-11.png";
import avatarNew12 from "@/assets/avatar-new-12.png";
import avatarNew13 from "@/assets/avatar-new-13.png";
import avatarNew14 from "@/assets/avatar-new-14.png";
import avatarNew15 from "@/assets/avatar-new-15.png";
import avatarNew16 from "@/assets/avatar-new-16.png";
import avatarNew17 from "@/assets/avatar-new-17.png";
import avatarNew18 from "@/assets/avatar-new-18.png";
import avatarNew20 from "@/assets/avatar-new-20.png";
import avatarNew21 from "@/assets/avatar-new-21.png";
import avatarNew22 from "@/assets/avatar-new-22.png";
import avatarNew23 from "@/assets/avatar-new-23.png";
import avatarNew24 from "@/assets/avatar-new-24.png";
import avatarNew25 from "@/assets/avatar-new-25.png";
import avatarNew26 from "@/assets/avatar-new-26.png";
import avatarNew27 from "@/assets/avatar-new-27.png";
import avatarNew28 from "@/assets/avatar-new-28.png";
import avatarNew30 from "@/assets/avatar-new-30.png";
import { Check } from "lucide-react";
import cameraIcon from "@/assets/camera-icon.png";
import { cn } from "@/lib/utils";

export const avatarOptions = [
  { id: "avatar-1", src: avatarNew1 },
  { id: "avatar-2", src: avatarNew2 },
  { id: "avatar-3", src: avatarNew3 },
  { id: "avatar-4", src: avatarNew4 },
  { id: "avatar-5", src: avatarNew5 },
  { id: "avatar-6", src: avatarNew6 },
  { id: "avatar-7", src: avatarNew7 },
  { id: "avatar-8", src: avatarNew8 },
  { id: "avatar-9", src: avatarNew9 },
  { id: "avatar-11", src: avatarNew11 },
  { id: "avatar-12", src: avatarNew12 },
  { id: "avatar-13", src: avatarNew13 },
  { id: "avatar-14", src: avatarNew14 },
  { id: "avatar-15", src: avatarNew15 },
  { id: "avatar-16", src: avatarNew16 },
  { id: "avatar-17", src: avatarNew17 },
  { id: "avatar-18", src: avatarNew18 },
  { id: "avatar-20", src: avatarNew20 },
  { id: "avatar-21", src: avatarNew21 },
  { id: "avatar-22", src: avatarNew22 },
  { id: "avatar-23", src: avatarNew23 },
  { id: "avatar-24", src: avatarNew24 },
  { id: "avatar-25", src: avatarNew25 },
  { id: "avatar-26", src: avatarNew26 },
  { id: "avatar-27", src: avatarNew27 },
  { id: "avatar-28", src: avatarNew28 },
  { id: "avatar-30", src: avatarNew30 },
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
    <div className="grid grid-cols-6 gap-2 max-w-sm mx-auto">
      {/* Camera/Upload button as first item in grid */}
      <button
        type="button"
        onClick={onUploadClick}
        className={cn(
          "relative w-12 h-12 rounded-full border-2 transition-all duration-200 overflow-hidden hover:scale-110 active:scale-95",
          customAvatarPreview && selectedAvatar === "custom"
            ? "border-shake-green ring-2 ring-shake-green/20 scale-110"
            : "border-border hover:border-primary/50"
        )}
        title="Upload a photo"
      >
        {customAvatarPreview ? (
          <>
            <img src={customAvatarPreview} alt="Custom avatar" className="w-full h-full object-cover" />
            {selectedAvatar === "custom" && (
              <div className="absolute inset-0 bg-shake-green/20 flex items-center justify-center animate-scale-in">
                <Check className="w-4 h-4 text-shake-green" />
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-muted rounded-full flex items-center justify-center p-1">
            <img src={cameraIcon} alt="Upload photo" className="w-full h-full object-contain" />
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
            "relative w-12 h-12 rounded-full border-2 transition-all duration-200 overflow-hidden flex-shrink-0 hover:scale-110 active:scale-95",
            selectedAvatar === avatar.id
              ? "border-shake-green ring-2 ring-shake-green/20 scale-110"
              : "border-border hover:border-primary/50"
          )}
        >
          <img src={avatar.src} alt="Avatar option" className="w-full h-full object-cover" />
          {selectedAvatar === avatar.id && (
            <div className="absolute inset-0 bg-shake-green/20 flex items-center justify-center animate-scale-in">
              <Check className="w-4 h-4 text-shake-green" />
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
