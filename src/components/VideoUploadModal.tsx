import { useState, useRef, useEffect, useCallback } from "react";
import { X, Upload, Trash2, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/lib/app-toast";
import { useAuth } from "@/contexts/AuthContext";

export interface VideoUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  maxDurationSeconds: number;
  existingVideoUrl?: string | null;
  onDeleteExisting?: () => Promise<boolean>;
  /** Return true on success. Use onProgress for upload ratio 0–1. */
  onUploadFile: (file: File, onProgress: (ratio: number) => void) => Promise<boolean>;
  onSuccess?: () => void;
  requirePremium?: boolean;
  primaryButtonLabel: string;
  deleteButtonLabel?: string;
  uploadSuccessToast?: string;
  uploadErrorToast?: string;
  deleteSuccessToast?: string;
  deleteErrorToast?: string;
  fileMaxSizeMb?: number;
  /** When true, floating preview send uses chat purple (#7c5cfc); otherwise matches primary (e.g. shake-green for status). */
  floatingSendUsesChatPurple?: boolean;
}

export function VideoUploadModal({
  open,
  onOpenChange,
  title,
  maxDurationSeconds,
  existingVideoUrl,
  onDeleteExisting,
  onUploadFile,
  onSuccess,
  requirePremium = false,
  primaryButtonLabel,
  deleteButtonLabel = "Delete",
  uploadSuccessToast = "Video uploaded!",
  uploadErrorToast = "Failed to upload video",
  deleteSuccessToast = "Video deleted",
  deleteErrorToast = "Failed to delete video",
  fileMaxSizeMb = 50,
  floatingSendUsesChatPurple = false,
}: VideoUploadModalProps) {
  const { isPremium } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadRatio, setUploadRatio] = useState(0);
  const [validating, setValidating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadInFlightRef = useRef(false);

  const resetSelection = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleClose = useCallback(() => {
    if (uploading) return;
    resetSelection();
    setUploadRatio(0);
    onOpenChange(false);
  }, [uploading, resetSelection, onOpenChange]);

  const validateVideoDuration = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        if (video.duration > maxDurationSeconds) {
          toast.error(
            `Video must be ${maxDurationSeconds} seconds or less. Your video is ${Math.round(video.duration)} seconds.`
          );
          resolve(false);
        } else {
          resolve(true);
        }
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        toast.error("Could not read video file");
        resolve(false);
      };

      video.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file");
      return;
    }

    if (file.size > fileMaxSizeMb * 1024 * 1024) {
      toast.error(`Video file is too large. Maximum size is ${fileMaxSizeMb}MB.`);
      return;
    }

    setValidating(true);
    const isValid = await validateVideoDuration(file);
    setValidating(false);

    if (isValid) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } else if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = useCallback(async () => {
    if (!selectedFile || uploadInFlightRef.current) return;
    uploadInFlightRef.current = true;

    setUploading(true);
    setUploadRatio(0);
    let ok = false;
    try {
      ok = await onUploadFile(selectedFile, setUploadRatio);
    } catch {
      ok = false;
    } finally {
      uploadInFlightRef.current = false;
      setUploading(false);
      setUploadRatio(0);
    }

    if (ok) {
      toast.success(uploadSuccessToast);
      onSuccess?.();
      resetSelection();
      onOpenChange(false);
    } else {
      toast.error(uploadErrorToast);
    }
  }, [
    selectedFile,
    onUploadFile,
    onSuccess,
    resetSelection,
    onOpenChange,
    uploadSuccessToast,
    uploadErrorToast,
  ]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !uploading) {
        handleClose();
        return;
      }
      if (
        e.key === "Enter" &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !uploading &&
        previewUrl &&
        selectedFile &&
        !existingVideoUrl
      ) {
        const t = e.target as HTMLElement | null;
        if (t?.closest("input, textarea, [contenteditable=true]")) return;
        e.preventDefault();
        void handleUpload();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    open,
    uploading,
    handleClose,
    previewUrl,
    selectedFile,
    existingVideoUrl,
    handleUpload,
  ]);

  const handleDelete = async () => {
    if (!onDeleteExisting) return;
    const success = await onDeleteExisting();
    if (success) {
      toast.success(deleteSuccessToast);
      onSuccess?.();
      handleClose();
    } else {
      toast.error(deleteErrorToast);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  if (!open) return null;

  if (requirePremium && !isPremium) {
    toast.error("Uploading a status video is a Super-Human feature. Upgrade to share status videos.");
    onOpenChange(false);
    return null;
  }

  const showEmptyPicker = !existingVideoUrl && !previewUrl && !validating;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`absolute inset-0 bg-black/80 backdrop-blur-[2px] ${uploading ? "pointer-events-none" : "cursor-pointer"}`}
        onClick={uploading ? undefined : handleClose}
        aria-hidden
      />

      <div
        className="relative z-10 w-full max-w-md rounded-2xl bg-black border border-white/10 shadow-2xl flex flex-col max-h-[min(90dvh,820px)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 shrink-0">
          <span className="w-10" aria-hidden />
          <h2 className="text-white font-medium text-center flex-1 truncate">{title}</h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={uploading}
            className="shrink-0 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="p-4 flex flex-col flex-1 min-h-0">
          <div className="relative w-full max-w-md mx-auto aspect-[9/16] bg-black rounded-lg overflow-hidden flex items-center justify-center shrink-0">
            {existingVideoUrl ? (
              <video
                src={existingVideoUrl}
                className="w-full h-full object-cover"
                controls
                autoPlay
                loop
              />
            ) : previewUrl ? (
              <>
                <video
                  src={previewUrl}
                  className="w-full h-full object-cover"
                  controls
                  autoPlay
                  loop
                />
                <button
                  type="button"
                  disabled={uploading}
                  aria-label={primaryButtonLabel}
                  title={primaryButtonLabel}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleUpload();
                  }}
                  className={`absolute bottom-[12px] right-[12px] z-20 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:brightness-110 active:scale-95 disabled:pointer-events-none disabled:opacity-40 ${
                    floatingSendUsesChatPurple
                      ? "bg-[#7c5cfc] hover:bg-[#8b6dfc]"
                      : "bg-shake-green hover:bg-shake-green/90"
                  }`}
                >
                  <ArrowUp className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                </button>
              </>
            ) : validating ? (
              <div className="flex flex-col items-center gap-4 text-white/70">
                <div className="w-12 h-12 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <p>Validating video...</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={triggerFileSelect}
                className="flex flex-col items-center gap-4 p-8 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
                  <span className="text-5xl">😎</span>
                </div>
                <div className="text-center">
                  <p className="text-white font-medium">Upload Video</p>
                  <p className="text-white/60 text-sm mt-1">Max {maxDurationSeconds} seconds</p>
                </div>
              </button>
            )}
          </div>

          {uploading && (
            <div className="mt-3 px-1">
              <Progress
                value={Math.min(100, Math.max(0, Math.round(uploadRatio * 100)))}
                className="h-2 bg-white/10 [&>div]:bg-shake-green"
              />
            </div>
          )}

          <div className="mt-4 flex justify-center gap-4 flex-wrap shrink-0">
            {existingVideoUrl ? (
              <Button
                onClick={() => void handleDelete()}
                variant="destructive"
                className="flex items-center gap-2"
                disabled={uploading}
              >
                <Trash2 className="w-4 h-4" />
                {deleteButtonLabel}
              </Button>
            ) : previewUrl ? (
              <>
                <Button
                  onClick={() => {
                    resetSelection();
                  }}
                  variant="outline"
                  className="text-white border-white"
                  disabled={uploading}
                >
                  Choose Another
                </Button>
                <Button
                  onClick={() => void handleUpload()}
                  disabled={uploading}
                  className="bg-shake-green hover:bg-shake-green/90"
                >
                  {uploading ? "Uploading..." : primaryButtonLabel}
                </Button>
              </>
            ) : !validating ? (
              <button
                type="button"
                onClick={triggerFileSelect}
                className="w-16 h-16 rounded-full bg-white flex items-center justify-center"
              >
                <Upload className="w-8 h-8 text-primary" />
              </button>
            ) : null}
          </div>

          {showEmptyPicker && (
            <p className="mt-3 text-center text-white/70 text-sm">
              Tap to select a video (max {maxDurationSeconds} seconds)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
