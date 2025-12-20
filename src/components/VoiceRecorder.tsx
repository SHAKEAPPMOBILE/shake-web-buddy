import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2, Play, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface VoiceRecorderProps {
  onVoiceNoteSent: (audioUrl: string) => void;
  disabled?: boolean;
  city: string;
  activityType: string;
}

export function VoiceRecorder({ onVoiceNoteSent, disabled, city, activityType }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { user } = useAuth();

  const startRecording = async () => {
    if (!user) {
      toast.error("Please sign in to send voice notes");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Could not access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
  };

  const sendVoiceNote = async () => {
    if (!audioBlob || !user) return;

    setIsUploading(true);

    try {
      const fileName = `${user.id}/${Date.now()}.webm`;
      
      const { error: uploadError } = await supabase.storage
        .from("voice-notes")
        .upload(fileName, audioBlob, {
          contentType: "audio/webm",
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from("voice-notes")
        .getPublicUrl(fileName);

      // Send message with audio URL
      const { error: messageError } = await supabase
        .from("activity_messages")
        .insert({
          user_id: user.id,
          activity_type: activityType,
          city: city,
          message: "🎤 Voice note",
          audio_url: urlData.publicUrl,
        });

      if (messageError) {
        throw messageError;
      }

      onVoiceNoteSent(urlData.publicUrl);
      setAudioBlob(null);
      setAudioUrl(null);
      toast.success("Voice note sent!");
    } catch (error) {
      console.error("Error sending voice note:", error);
      toast.error("Failed to send voice note");
    } finally {
      setIsUploading(false);
    }
  };

  if (audioBlob && audioUrl) {
    return (
      <div className="flex items-center gap-2">
        <audio src={audioUrl} controls className="h-8 max-w-[140px]" />
        <Button
          variant="ghost"
          size="icon"
          onClick={cancelRecording}
          disabled={isUploading}
          className="h-8 w-8"
        >
          <X className="w-4 h-4" />
        </Button>
        <Button
          variant="shake"
          size="icon"
          onClick={sendVoiceNote}
          disabled={isUploading}
          className="h-8 w-8"
        >
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant={isRecording ? "destructive" : "ghost"}
      size="icon"
      onClick={isRecording ? stopRecording : startRecording}
      disabled={disabled}
      className="shrink-0"
    >
      {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </Button>
  );
}
