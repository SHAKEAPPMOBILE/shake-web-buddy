import { useState, useRef, useCallback, useEffect } from "react";
import { X, Video, Square, Trash2 } from "lucide-react";
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

export function StatusVideoRecorder({
  open,
  onOpenChange,
  userId,
  existingVideoUrl,
  onVideoUploaded,
}: StatusVideoRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast.error("Could not access camera");
    }
  }, []);

  useEffect(() => {
    if (open && !existingVideoUrl) {
      startCamera();
    }
    return () => {
      stopStream();
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [open, existingVideoUrl, startCamera, stopStream]);

  const startRecording = useCallback(() => {
    if (!stream) return;

    chunksRef.current = [];
    setCountdown(10);

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: "video/webm",
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setRecordedBlob(blob);
      setRecordedUrl(URL.createObjectURL(blob));
      stopStream();
    };

    mediaRecorder.start();
    mediaRecorderRef.current = mediaRecorder;
    setIsRecording(true);

    // Auto-stop after 10 seconds
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          stopRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stream, stopStream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    }
  }, [isRecording]);

  const handleUpload = async () => {
    if (!recordedBlob) return;

    setUploading(true);
    const result = await uploadStatusVideo(userId, recordedBlob);
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
    stopStream();
    setRecordedBlob(null);
    setRecordedUrl(null);
    setIsRecording(false);
    onOpenChange(false);
  };

  const handleRetry = () => {
    setRecordedBlob(null);
    setRecordedUrl(null);
    startCamera();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black">
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
      <div className="relative w-full max-w-md aspect-[9/16] bg-black rounded-lg overflow-hidden">
        {existingVideoUrl ? (
          <video
            src={existingVideoUrl}
            className="w-full h-full object-cover"
            controls
            autoPlay
            loop
          />
        ) : recordedUrl ? (
          <video
            src={recordedUrl}
            className="w-full h-full object-cover"
            controls
            autoPlay
            loop
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover mirror"
            style={{ transform: "scaleX(-1)" }}
          />
        )}

        {/* Recording countdown */}
        {isRecording && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            {countdown}s
          </div>
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
        ) : recordedUrl ? (
          <>
            <Button onClick={handleRetry} variant="outline" className="text-white border-white">
              Retry
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="bg-shake-green hover:bg-shake-green/90"
            >
              {uploading ? "Uploading..." : "Share Status"}
            </Button>
          </>
        ) : !isRecording ? (
          <button
            onClick={startRecording}
            className="w-16 h-16 rounded-full bg-white flex items-center justify-center"
          >
            <Video className="w-8 h-8 text-red-500" />
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center"
          >
            <Square className="w-6 h-6 text-white fill-white" />
          </button>
        )}
      </div>

      {/* Helper text */}
      {!existingVideoUrl && !recordedUrl && !isRecording && (
        <p className="absolute bottom-28 text-white/70 text-sm">
          Tap to record (max 10 seconds)
        </p>
      )}
    </div>
  );
}
