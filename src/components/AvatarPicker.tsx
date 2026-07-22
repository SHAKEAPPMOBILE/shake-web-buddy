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

// Radial layout constants
// Inner ring: first 8 avatars at radius 78px
// Outer ring: remaining 18 avatars at radius 145px
// Container: 340px square — fits on 390px mobile with px-6 (24px) padding on each side
const INNER_RING_COUNT = 8;
const INNER_RADIUS = 78;
const OUTER_RADIUS = 145;

function radialPos(i: number, count: number, radius: number) {
  const angle = (2 * Math.PI * i) / count;
  return {
    x: Math.round(radius * Math.sin(angle)),
    y: Math.round(-radius * Math.cos(angle)),
  };
}

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
  const selectedPreset = selectedAvatar
    ? localAvatarOptions.find((a) => a.id === selectedAvatar)?.src
    : undefined;

  const topPreviewUrl =
    selectedAvatar === "custom" && customAvatarPreview
      ? getDisplayAvatarUrl(customAvatarPreview) ?? customAvatarPreview
      : selectedPreset
        ? getDisplayAvatarUrl(selectedPreset) ?? selectedPreset
        : null;

  const isShowingSelected = Boolean(topPreviewUrl);

  const innerRing = localAvatarOptions.slice(0, INNER_RING_COUNT);
  const outerRing = localAvatarOptions.slice(INNER_RING_COUNT);

  return (
    // Outer wrapper provides scroll context if needed on very small screens
    <div className="w-full overflow-x-hidden">
      {/* Radial container — square, centered */}
      <div
        className="relative mx-auto"
        style={{ width: "340px", height: "340px", maxWidth: "100%" }}
      >
        {/* Inner ring — 8 avatars */}
        {innerRing.map((avatar, i) => {
          const { x, y } = radialPos(i, innerRing.length, INNER_RADIUS);
          const isSelected = selectedAvatar === avatar.id;
          return (
            <button
              key={avatar.id}
              type="button"
              onClick={() => onSelectAvatar(avatar.id)}
              aria-label={`Select avatar ${i + 1}`}
              className={cn(
                "absolute w-11 h-11 rounded-full border-2 transition-all duration-200 overflow-hidden",
                isSelected
                  ? "border-shake-green ring-2 ring-shake-green/20 scale-110 z-10"
                  : "border-border hover:border-primary/50 hover:scale-105 active:scale-95"
              )}
              style={{
                left: "50%",
                top: "50%",
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
              }}
            >
              <img
                src={getDisplayAvatarUrl(avatar.src) ?? avatar.src}
                alt=""
                className="w-full h-full object-cover"
              />
            </button>
          );
        })}

        {/* Outer ring — 18 avatars */}
        {outerRing.map((avatar, i) => {
          const { x, y } = radialPos(i, outerRing.length, OUTER_RADIUS);
          const isSelected = selectedAvatar === avatar.id;
          return (
            <button
              key={avatar.id}
              type="button"
              onClick={() => onSelectAvatar(avatar.id)}
              aria-label={`Select avatar ${INNER_RING_COUNT + i + 1}`}
              className={cn(
                "absolute w-10 h-10 rounded-full border-2 transition-all duration-200 overflow-hidden",
                isSelected
                  ? "border-shake-green ring-2 ring-shake-green/20 scale-110 z-10"
                  : "border-border hover:border-primary/50 hover:scale-105 active:scale-95"
              )}
              style={{
                left: "50%",
                top: "50%",
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
              }}
            >
              <img
                src={getDisplayAvatarUrl(avatar.src) ?? avatar.src}
                alt=""
                className="w-full h-full object-cover"
              />
            </button>
          );
        })}

        {/* Center — camera / upload button (larger than avatar options) */}
        <button
          type="button"
          onClick={onUploadClick ?? onCameraClick}
          aria-label="Upload a photo"
          title="Upload a photo"
          className={cn(
            "absolute w-16 h-16 rounded-full border-2 transition-all duration-200 overflow-hidden z-20",
            isShowingSelected
              ? "border-shake-green ring-4 ring-shake-green/20 shadow-lg scale-110"
              : "border-border bg-muted shadow-md hover:border-primary/50 hover:scale-105 active:scale-95"
          )}
          style={{
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          {topPreviewUrl ? (
            <img
              src={topPreviewUrl}
              alt="Selected avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full rounded-full flex items-center justify-center p-2">
              <img
                src={cameraIcon}
                alt="Upload photo"
                className="w-full h-full object-contain"
              />
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
