import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, X, MicOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { OceanWaveAudio } from "./OceanWaveAudio";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface VoiceRecorderProps {
  onAudioReady?: (blob: Blob, url: string) => void;
  onAudioClear?: () => void;
  disabled?: boolean;
  highlighted?: boolean;
  maxDuration?: number;
  resetTrigger?: number; // Increment this to reset the recorder after sending
}

const MAX_RECORDING_DURATION = 5; // 5 seconds max

type PermissionState = 'unknown' | 'prompt' | 'granted' | 'denied';

export function VoiceRecorder({ onAudioReady, onAudioClear, disabled, highlighted = false, maxDuration = MAX_RECORDING_DURATION, resetTrigger }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [liveWaveform, setLiveWaveform] = useState<number[]>([]);
  const [micPermission, setMicPermission] = useState<PermissionState>('unknown');
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { user } = useAuth();

  // Check microphone permission on mount
  useEffect(() => {
    const checkPermission = async () => {
      try {
        // Check if permissions API is available
        if (navigator.permissions && navigator.permissions.query) {
          const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          setMicPermission(result.state as PermissionState);
          
          // Listen for permission changes
          result.onchange = () => {
            setMicPermission(result.state as PermissionState);
          };
        } else {
          // Fallback for browsers without permissions API (like Safari)
          // We'll check when user tries to record
          setMicPermission('unknown');
        }
      } catch {
        // Permission API not supported or microphone permission not queryable
        setMicPermission('unknown');
      }
    };

    checkPermission();
  }, []);

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

  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      // Permission granted - stop the test stream
      stream.getTracks().forEach(track => track.stop());
      setMicPermission('granted');
      return true;
    } catch (error) {
      console.error("Microphone permission denied:", error);
      setMicPermission('denied');
      return false;
    }
  }, []);

  const handleMicButtonClick = useCallback(async () => {
    if (!user) {
      toast.error("Please sign in to send voice notes");
      return;
    }

    // If permission is unknown or prompt, show the dialog first
    if (micPermission === 'unknown' || micPermission === 'prompt') {
      setShowPermissionDialog(true);
      return;
    }

    // If denied, show helpful message
    if (micPermission === 'denied') {
      toast.error("Microphone access denied. Please enable it in your device settings.");
      return;
    }

    // Permission already granted, start recording
    startRecording();
  }, [user, micPermission]);

  const handlePermissionConfirm = useCallback(async () => {
    setShowPermissionDialog(false);
    const granted = await requestMicrophonePermission();
    if (granted) {
      // Small delay to ensure state is updated
      setTimeout(() => startRecording(), 100);
    }
  }, [requestMicrophonePermission]);

  const startRecording = async () => {
    if (!user) {
      toast.error("Please sign in to send voice notes");
      return;
    }

    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Your browser doesn't support audio recording");
        return;
      }

      // Request microphone access with iOS-friendly constraints
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      // Update permission state
      setMicPermission('granted');
      
      // Set up audio context for live visualization
      // Use webkitAudioContext for older iOS versions
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
      
      // Resume AudioContext if suspended (required on iOS after user gesture)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
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
        // Stop animation and cleanup first
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        
        // Stop stream tracks
        stream.getTracks().forEach((track) => track.stop());
        
        // Create audio blob only once
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        
        // Clear chunks to prevent duplicates
        chunksRef.current = [];
        
        // Set state and notify parent
        setAudioBlob(blob);
        setAudioUrl(url);
        onAudioReady?.(blob, url);
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
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          toast.error("Microphone access denied. Please enable it in your device settings.");
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          toast.error("No microphone found on this device");
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          toast.error("Microphone is in use by another app");
        } else if (error.name === 'OverconstrainedError') {
          toast.error("Microphone settings not supported");
        } else if (error.name === 'SecurityError') {
          toast.error("Microphone access requires a secure connection (HTTPS)");
        } else {
          toast.error("Could not access microphone. Check your settings.");
        }
      } else {
        toast.error("Could not access microphone");
      }
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

  // Show recorded audio preview with ocean wave animation
  if (audioBlob && audioUrl) {
    return (
      <div className="flex items-center gap-2 flex-1 bg-muted/50 rounded-lg px-3 py-2">
        <OceanWaveAudio audioUrl={audioUrl} isCompact className="flex-1" />
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
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleMicButtonClick}
        disabled={disabled}
        className={`shrink-0 ${
          micPermission === 'denied' 
            ? 'text-muted-foreground' 
            : highlighted 
              ? 'bg-shake-green text-white hover:bg-shake-green/90 shadow-lg shadow-shake-green/30' 
              : ''
        }`}
      >
        {micPermission === 'denied' ? (
          <MicOff className={`${highlighted ? 'w-5 h-5' : 'w-4 h-4'}`} />
        ) : (
          <Mic className={`${highlighted ? 'w-5 h-5' : 'w-4 h-4'}`} />
        )}
      </Button>

      {/* Microphone Permission Dialog */}
      <AlertDialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Mic className="w-5 h-5 text-shake-green" />
              Enable Microphone
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <p>
                SHAKE needs access to your microphone to send voice messages.
              </p>
              <p className="text-xs text-muted-foreground">
                Your voice recordings are only sent when you choose to share them.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handlePermissionConfirm}
              className="bg-shake-green hover:bg-shake-green/90"
            >
              Allow Microphone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
