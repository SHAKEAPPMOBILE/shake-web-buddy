import { VideoUploadModal } from "./VideoUploadModal";
import { uploadStatusVideo } from "@/hooks/useStatusVideo";

interface StatusVideoRecorderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  existingVideoUrl?: string | null;
  onVideoUploaded: () => void;
  /** Hook-bound delete that clears state immediately and force-refetches. */
  onDeleteVideo: () => Promise<boolean>;
}

export function StatusVideoRecorder({
  open,
  onOpenChange,
  userId,
  existingVideoUrl,
  onVideoUploaded,
  onDeleteVideo,
}: StatusVideoRecorderProps) {
  return (
    <VideoUploadModal
      open={open}
      onOpenChange={onOpenChange}
      title="Status Video"
      maxDurationSeconds={10}
      existingVideoUrl={existingVideoUrl}
      onDeleteExisting={onDeleteVideo}
      onUploadFile={async (file, onProgress) => {
        onProgress(0);
        const result = await uploadStatusVideo(userId, file);
        onProgress(1);
        return !!result;
      }}
      onSuccess={onVideoUploaded}
      primaryButtonLabel="Share Status"
      deleteButtonLabel="Delete Status"
      uploadSuccessToast="Status video uploaded!"
      uploadErrorToast="Failed to upload status video"
      deleteSuccessToast="Status video deleted"
      deleteErrorToast="Failed to delete status video"
    />
  );
}
