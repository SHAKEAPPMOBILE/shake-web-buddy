import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Clock } from "lucide-react";
import { useEffect, useState } from "react";

interface ShakingClockAnimationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function ShakingClockAnimation({ open, onOpenChange, onComplete }: ShakingClockAnimationProps) {
  const [isShaking, setIsShaking] = useState(true);

  useEffect(() => {
    if (open) {
      setIsShaking(true);
      const timer = setTimeout(() => {
        setIsShaking(false);
        setTimeout(() => {
          onComplete();
        }, 500);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [open, onComplete]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm bg-card/95 backdrop-blur-xl border-border/50 flex flex-col items-center justify-center py-12">
        <div 
          className={`text-6xl mb-6 ${isShaking ? 'animate-shake' : ''}`}
          style={{
            animation: isShaking ? 'shake 0.5s ease-in-out infinite' : 'none'
          }}
        >
          <Clock className="w-20 h-20 text-shake-yellow" />
        </div>
        <h2 className="text-2xl font-display font-bold text-foreground text-center">
          Ding Ding! 🔔
        </h2>
        <p className="text-lg text-muted-foreground text-center mt-2">
          It's time to shake!
        </p>
        <p className="text-sm text-muted-foreground/70 text-center mt-4 max-w-xs">
          Your activity is recorded for 24 hours. You'll be notified when someone joins!
        </p>
      </DialogContent>
    </Dialog>
  );
}
