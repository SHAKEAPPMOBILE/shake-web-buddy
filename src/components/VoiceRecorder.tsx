import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { AudioWaveform } from "./AudioWaveform";

interface VoiceRecorderProps {
  onAudioReady?: (blob: Blob, url: string) => void;
  onAudioClear?: () => void;
  disabled?: boolean;
  highlighted?: boolean;
  maxDuration?: number;
  resetTrigger?: number; // Increment this to reset the recorder after sending
}

const MAX_RECORDING_DURATION = 5; // 5 seconds max

export function VoiceRecorder({ onAudioReady, onAudioClear, disabled, highlighted = false, maxDuration = MAX_RECORDING_DURATION, resetTrigger }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [liveWaveform, setLiveWaveform] = useState<number[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { user } = useAuth();

  // Reset internal state when resetTrigger changes (after sending)
  useEffect(() => {
    if (resetTrigger !== undefined && resetTrigger > 0) {
      setAudioBlob(null);
      setAudioUrl(null);
      setRecordingDuration(0);
      setLiveWaveform([]);
    }
  }, [resetTrigger]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const startRecording = async () => {
    if (!user) {
      toast.error("Please sign in to send voice notes");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Set up audio context for live visualization
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 64;
      source.connect(analyserRef.current);
      
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
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        onAudioReady?.(blob, url);
        stream.getTracks().forEach((track) => track.stop());
        
        // Stop animation
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      setLiveWaveform([]);

      // Start duration timer with auto-stop at max duration
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          const newDuration = prev + 1;
          if (newDuration >= maxDuration) {
            // Auto-stop when max duration reached
            setTimeout(() => stopRecording(), 0);
          }
          return newDuration;
        });
      }, 1000);

      // Start live waveform visualization
      const updateWaveform = () => {
        if (!analyserRef.current) return;
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Take a sample of the frequency data
        const samples = 12;
        const step = Math.floor(dataArray.length / samples);
        const waveformSample: number[] = [];
        
        for (let i = 0; i < samples; i++) {
          waveformSample.push(dataArray[i * step] / 255);
        }
        
        setLiveWaveform(waveformSample);
        animationRef.current = requestAnimationFrame(updateWaveform);
      };
      
      updateWaveform();
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
    setRecordingDuration(0);
    setLiveWaveform([]);
    onAudioClear?.();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Show recorded audio preview with waveform (no send button - parent handles sending)
  if (audioBlob && audioUrl) {
    return (
      <div className="flex items-center gap-2 flex-1 bg-muted/50 rounded-lg px-3 py-2">
        <AudioWaveform audioUrl={audioUrl} isCompact className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          onClick={cancelRecording}
          className="h-8 w-8 shrink-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  // Show recording in progress with live waveform
  if (isRecording) {
    return (
      <div className="flex items-center gap-2 flex-1 bg-destructive/10 rounded-lg px-3 py-2">
        <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
        <span className="text-sm font-medium text-destructive">
          {formatDuration(recordingDuration)}
        </span>
        
        {/* Live waveform */}
        <div className="flex items-center gap-[2px] h-6 flex-1">
          {liveWaveform.map((value, index) => (
            <div
              key={index}
              className="w-[3px] rounded-full bg-destructive transition-all duration-75"
              style={{
                height: `${Math.max(value * 100, 15)}%`,
              }}
            />
          ))}
          {liveWaveform.length === 0 && (
            Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="w-[3px] h-2 rounded-full bg-destructive/50"
              />
            ))
          )}
        </div>
        
        <Button
          variant="destructive"
          size="icon"
          onClick={stopRecording}
          className="h-8 w-8 shrink-0"
        >
          <Square className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={startRecording}
      disabled={disabled}
      className={`shrink-0 ${highlighted ? 'bg-shake-green text-white hover:bg-shake-green/90 shadow-lg shadow-shake-green/30' : ''}`}
    >
      <Mic className={`${highlighted ? 'w-5 h-5' : 'w-4 h-4'}`} />
    </Button>
  );
}
