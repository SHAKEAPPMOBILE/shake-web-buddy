import { useRef, useEffect, useState } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OceanWaveAudioProps {
  audioUrl: string;
  isCompact?: boolean;
  className?: string;
}

export function OceanWaveAudio({ audioUrl, isCompact = false, className }: OceanWaveAudioProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

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

    const handleCanPlay = () => {
      // Audio is ready to play
    };

    const handleError = (e: ErrorEvent) => {
      console.error("Audio error:", e);
      setIsPlaying(false);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("error", handleError as EventListener);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("error", handleError as EventListener);
    };
  }, [audioUrl]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        await audio.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error("Playback error:", error);
      setIsPlaying(false);
    }
  };

  const formatTime = (time: number) => {
    if (!isFinite(time) || isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const waveCount = isCompact ? 8 : 12;

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
        {/* Ocean wave visualization */}
        <div className="flex items-end justify-center gap-[3px] h-8 flex-1 overflow-hidden">
          {Array.from({ length: waveCount }).map((_, index) => {
            const waveProgress = (index / waveCount) * 100;
            const isActive = waveProgress <= progress;
            
            // Create smooth wave pattern with varying heights
            const baseDelay = index * 0.15;
            const wavePhase = (index % 4) / 4;
            
            return (
              <div
                key={index}
                className={cn(
                  "w-1 rounded-full transition-all duration-300",
                  isActive ? "bg-primary" : "bg-muted-foreground/30"
                )}
                style={{
                  height: isPlaying 
                    ? undefined 
                    : `${20 + Math.sin(wavePhase * Math.PI * 2) * 30 + 20}%`,
                  animation: isPlaying 
                    ? `oceanWave 1.2s ease-in-out infinite` 
                    : 'none',
                  animationDelay: `${baseDelay}s`,
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

      <style>{`
        @keyframes oceanWave {
          0%, 100% {
            height: 20%;
          }
          25% {
            height: 60%;
          }
          50% {
            height: 80%;
          }
          75% {
            height: 40%;
          }
        }
      `}</style>
    </div>
  );
}
