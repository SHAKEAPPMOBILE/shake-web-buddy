import { VideoUploadModal } from "./VideoUploadModal";
import { uploadStatusVideo, deleteStatusVideo } from "@/hooks/useStatusVideo";

interface StatusVideoRecorderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  existingVideoUrl?: string | null;
  onVideoUploaded: () => void;
}

export function StatusVideoRecorder({
  open,
  onOpenChange,
  userId,
  existingVideoUrl,
  onVideoUploaded,
}: StatusVideoRecorderProps) {
  return (
    <VideoUploadModal
      open={open}
      onOpenChange={onOpenChange}
      title="Status Video"
      maxDurationSeconds={10}
      requirePremium
      existingVideoUrl={existingVideoUrl}
      onDeleteExisting={() => deleteStatusVideo(userId)}
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
