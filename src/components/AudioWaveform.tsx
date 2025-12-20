import { useRef, useEffect, useState } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AudioWaveformProps {
  audioUrl: string;
  isCompact?: boolean;
  className?: string;
}

export function AudioWaveform({ audioUrl, isCompact = false, className }: AudioWaveformProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>([]);

  // Generate static waveform visualization from audio
  useEffect(() => {
    const generateWaveform = async () => {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const rawData = audioBuffer.getChannelData(0);
        const samples = isCompact ? 20 : 40;
        const blockSize = Math.floor(rawData.length / samples);
        const filteredData: number[] = [];
        
        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(rawData[i * blockSize + j]);
          }
          filteredData.push(sum / blockSize);
        }
        
        // Normalize
        const maxVal = Math.max(...filteredData);
        const normalizedData = filteredData.map(v => v / maxVal);
        setWaveformData(normalizedData);
        
        audioContext.close();
      } catch (error) {
        console.error("Error generating waveform:", error);
        // Generate random fallback waveform
        const samples = isCompact ? 20 : 40;
        setWaveformData(Array.from({ length: samples }, () => 0.2 + Math.random() * 0.8));
      }
    };

    generateWaveform();
  }, [audioUrl, isCompact]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePlayback}
        className="h-8 w-8 shrink-0 rounded-full bg-primary/20 hover:bg-primary/30"
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 text-primary" />
        ) : (
          <Play className="w-4 h-4 text-primary ml-0.5" />
        )}
      </Button>

      <div className="flex-1 flex items-center gap-2">
        {/* Waveform visualization */}
        <div className="flex items-center gap-[2px] h-6 flex-1">
          {waveformData.map((value, index) => {
            const barProgress = (index / waveformData.length) * 100;
            const isActive = barProgress <= progress;
            
            return (
              <div
                key={index}
                className={cn(
                  "w-[3px] rounded-full transition-all duration-150",
                  isActive ? "bg-primary" : "bg-muted-foreground/30"
                )}
                style={{
                  height: `${Math.max(value * 100, 15)}%`,
                }}
              />
            );
          })}
        </div>

        {!isCompact && (
          <span className="text-xs text-muted-foreground min-w-[45px] text-right">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        )}
      </div>
    </div>
  );
}