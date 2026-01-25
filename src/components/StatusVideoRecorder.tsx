import { useState, useRef } from "react";
import { X, Upload, Trash2, FileVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadStatusVideo, deleteStatusVideo } from "@/hooks/useStatusVideo";
import { toast } from "sonner";

interface StatusVideoRecorderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  existingVideoUrl?: string | null;
  onVideoUploaded: () => void;
}

const MAX_DURATION_SECONDS = 10;

export function StatusVideoRecorder({
  open,
  onOpenChange,
  userId,
  existingVideoUrl,
  onVideoUploaded,
}: StatusVideoRecorderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [validating, setValidating] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateVideoDuration = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        if (video.duration > MAX_DURATION_SECONDS) {
          toast.error(`Video must be ${MAX_DURATION_SECONDS} seconds or less. Your video is ${Math.round(video.duration)} seconds.`);
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

    // Check if it's a video file
    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file");
      return;
    }

    // Check file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Video file is too large. Maximum size is 50MB.");
      return;
    }

    setValidating(true);
    const isValid = await validateVideoDuration(file);
    setValidating(false);

    if (isValid) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    const result = await uploadStatusVideo(userId, selectedFile);
    setUploading(false);

    if (result) {
      toast.success("Status video uploaded!");
      onVideoUploaded();
      handleClose();
    } else {
      toast.error("Failed to upload status video");
    }
  };

  const handleDelete = async () => {
    const success = await deleteStatusVideo(userId);
    if (success) {
      toast.success("Status video deleted");
      onVideoUploaded();
      handleClose();
    } else {
      toast.error("Failed to delete status video");
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    onOpenChange(false);
  };

  const handleRetry = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Title */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <h2 className="text-white font-medium">Status Video</h2>
      </div>

      {/* Video preview */}
      <div className="relative w-full max-w-md aspect-[9/16] bg-black rounded-lg overflow-hidden flex items-center justify-center">
        {existingVideoUrl ? (
          <video
            src={existingVideoUrl}
            className="w-full h-full object-cover"
            controls
            autoPlay
            loop
          />
        ) : previewUrl ? (
          <video
            src={previewUrl}
            className="w-full h-full object-cover"
            controls
            autoPlay
            loop
          />
        ) : validating ? (
          <div className="flex flex-col items-center gap-4 text-white/70">
            <div className="w-12 h-12 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <p>Validating video...</p>
          </div>
        ) : (
          <button
            onClick={triggerFileSelect}
            className="flex flex-col items-center gap-4 p-8 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
              <FileVideo className="w-10 h-10 text-white" />
            </div>
            <div className="text-center">
              <p className="text-white font-medium">Upload Video</p>
              <p className="text-white/60 text-sm mt-1">Max {MAX_DURATION_SECONDS} seconds</p>
            </div>
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4 px-4">
        {existingVideoUrl ? (
          <Button
            onClick={handleDelete}
            variant="destructive"
            className="flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete Status
          </Button>
        ) : previewUrl ? (
          <>
            <Button onClick={handleRetry} variant="outline" className="text-white border-white">
              Choose Another
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="bg-shake-green hover:bg-shake-green/90"
            >
              {uploading ? "Uploading..." : "Share Status"}
            </Button>
          </>
        ) : !validating && (
          <button
            onClick={triggerFileSelect}
            className="w-16 h-16 rounded-full bg-white flex items-center justify-center"
          >
            <Upload className="w-8 h-8 text-primary" />
          </button>
        )}
      </div>

      {/* Helper text */}
      {!existingVideoUrl && !previewUrl && !validating && (
        <p className="absolute bottom-28 text-white/70 text-sm">
          Tap to select a video (max {MAX_DURATION_SECONDS} seconds)
        </p>
      )}
    </div>
  );
}
