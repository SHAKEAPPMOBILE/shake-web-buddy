import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, X, Loader2, Check, Sparkles } from "lucide-react";
import { useCheckIn } from "@/hooks/useCheckIn";
import { useState } from "react";
import shakeCoin from "@/assets/shake-coin-transparent.png";

interface ProximityCheckInPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venueName: string;
  city: string;
  activityType: string;
  distance: number;
}

export function ProximityCheckInPopup({
  open,
  onOpenChange,
  venueName,
  city,
  activityType,
  distance,
}: ProximityCheckInPopupProps) {
  const { checkIn, isCheckingIn, checkIfAlreadyCheckedIn } = useCheckIn();
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);

  // Check if already checked in when opening
  const handleOpenChange = async (isOpen: boolean) => {
    if (isOpen) {
      const already = await checkIfAlreadyCheckedIn(activityType, city);
      setAlreadyCheckedIn(already);
    }
    onOpenChange(isOpen);
  };

  const handleCheckIn = async () => {
    const success = await checkIn(activityType, city, venueName);
    if (success) {
      setHasCheckedIn(true);
      // Auto-close after success
      setTimeout(() => {
        onOpenChange(false);
        setHasCheckedIn(false);
      }, 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-shake-yellow/20 to-shake-green/10 border-shake-yellow/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-center justify-center">
            <MapPin className="w-5 h-5 text-shake-green" />
            You're at {venueName}!
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-6 space-y-4">
          {/* Animated venue icon */}
          <div className="w-24 h-24 rounded-full bg-white shadow-lg flex items-center justify-center animate-bounce-subtle">
            <MapPin className="w-12 h-12 text-shake-green" />
          </div>

          {/* Distance indicator */}
          <p className="text-sm text-muted-foreground">
            You're {distance}m away from the venue
          </p>

          {hasCheckedIn ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-shake-green/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-shake-green" />
              </div>
              <p className="text-lg font-semibold text-shake-green">Checked in! 🎉</p>
              <div className="flex items-center gap-2">
                <img src={shakeCoin} alt="Points" className="w-6 h-6" />
                <span className="text-xl font-bold text-shake-yellow">+5 points</span>
              </div>
            </div>
          ) : alreadyCheckedIn ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-shake-green/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-shake-green" />
              </div>
              <p className="text-lg font-semibold text-foreground">Already checked in today!</p>
              <p className="text-sm text-muted-foreground">Come back tomorrow for more points</p>
            </div>
          ) : (
            <>
              {/* Points incentive */}
              <div className="flex items-center gap-2 px-4 py-2 bg-shake-yellow/20 rounded-full">
                <Sparkles className="w-4 h-4 text-shake-yellow" />
                <span className="text-sm font-medium">Check in to earn</span>
                <img src={shakeCoin} alt="Points" className="w-5 h-5" />
                <span className="font-bold text-shake-yellow">+5 points</span>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 w-full max-w-xs">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                >
                  <X className="w-4 h-4 mr-2" />
                  Later
                </Button>
                <Button
                  onClick={handleCheckIn}
                  disabled={isCheckingIn}
                  className="flex-1 bg-shake-green hover:bg-shake-green/90 text-white"
                >
                  {isCheckingIn ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <MapPin className="w-4 h-4 mr-2" />
                  )}
                  Check In
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
