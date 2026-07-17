import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { AvatarPicker, avatarOptions } from "@/components/AvatarPicker";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/app-toast";
import { getDisplayAvatarUrl, hasValidAvatarUrl } from "@/lib/avatar";

interface MandatoryPhotoScreenProps {
  userId: string;
  onComplete: (savedAvatarUrl?: string) => void | Promise<void>;
}

export function MandatoryPhotoScreen({ userId, onComplete }: MandatoryPhotoScreenProps) {
  const { t } = useTranslation();
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [customAvatarPreview, setCustomAvatarPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasSelection = selectedAvatar != null && (selectedAvatar !== "custom" || !!customAvatarPreview);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    e.target.value = "";

    if (!file.type.startsWith("image/")) {
      toast.error(t('profile.selectImageFile'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('profile.imageTooLarge'));
      return;
    }

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${userId}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setCustomAvatarPreview(newUrl);
      setSelectedAvatar("custom");
    } catch (err) {
      console.error("Avatar upload error:", err);
      toast.error(t('mandatoryPhoto.uploadFailed'));
    }
  };

  const handleContinue = async () => {
    if (!hasSelection || !userId) return;

    setIsSaving(true);
    try {
      let avatarUrl: string;

      if (selectedAvatar === "custom" && customAvatarPreview) {
        avatarUrl = customAvatarPreview;
      } else {
        const preset = avatarOptions.find((a) => a.id === selectedAvatar);
        if (!preset) {
          toast.error(t('mandatoryPhoto.selectPhoto'));
          return;
        }
        avatarUrl = preset.src;
      }

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", userId)
        .maybeSingle();

      const fallbackName = existingProfile?.name?.trim()
        || String(
          currentUser?.user_metadata?.name
          ?? currentUser?.user_metadata?.full_name
          ?? currentUser?.email?.split("@")[0]
          ?? ""
        ).trim()
        || null;

      const { data, error } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: userId,
            avatar_url: avatarUrl,
            name: fallbackName,
          },
          { onConflict: "user_id" }
        )
        .select("user_id, name, avatar_url")
        .single();

      if (error) throw error;
      if (!hasValidAvatarUrl(data?.avatar_url) || !data?.name?.trim()) {
        throw new Error("Avatar save could not be verified");
      }

      toast.success(t('mandatoryPhoto.photoSaved'));
      await onComplete(data.avatar_url);
    } catch (err) {
      console.error("Error saving avatar:", err);
      toast.error(t('mandatoryPhoto.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center safe-area-top safe-area-bottom px-6">
      <h1 className="text-xl font-display font-bold text-foreground text-center mb-2">
        Add your photo to continue
      </h1>
      <p className="text-sm text-muted-foreground text-center mb-6">
        Choose an avatar or upload a photo. You need a profile photo to use the app.
      </p>

      <div className="w-full max-w-sm">
        <AvatarPicker
          selectedAvatar={selectedAvatar}
          onSelectAvatar={(id) => setSelectedAvatar(id)}
          onUploadClick={handleUploadClick}
          customAvatarPreview={customAvatarPreview ? (getDisplayAvatarUrl(customAvatarPreview) ?? customAvatarPreview) : null}
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <Button
        onClick={handleContinue}
        disabled={!hasSelection || isSaving}
        className="w-full max-w-sm mt-8 h-12 text-base font-medium"
      >
        {isSaving ? "Saving…" : "Continue"}
      </Button>
    </div>
  );
}
