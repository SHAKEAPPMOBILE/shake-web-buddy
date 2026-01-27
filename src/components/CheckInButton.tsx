import { useState, useEffect } from "react";
import { MapPin, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCheckIn } from "@/hooks/useCheckIn";

interface CheckInButtonProps {
  activityType: string;
  city: string;
  venueName: string;
  className?: string;
}

export function CheckInButton({
  activityType,
  city,
  venueName,
  className = "",
}: CheckInButtonProps) {
  const { checkIn, isCheckingIn, checkIfAlreadyCheckedIn } = useCheckIn();
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      setIsChecking(true);
      const alreadyCheckedIn = await checkIfAlreadyCheckedIn(activityType, city);
      setHasCheckedIn(alreadyCheckedIn);
      setIsChecking(false);
    };
    checkStatus();
  }, [activityType, city, checkIfAlreadyCheckedIn]);

  const handleCheckIn = async () => {
    const success = await checkIn(activityType, city, venueName);
    if (success) {
      setHasCheckedIn(true);
    }
  };

  if (isChecking) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className={`gap-2 ${className}`}
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="hidden sm:inline">Loading...</span>
      </Button>
    );
  }

  if (hasCheckedIn) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className={`gap-2 bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400 ${className}`}
      >
        <Check className="w-4 h-4" />
        <span className="hidden sm:inline">Checked in!</span>
        <span className="sm:hidden">✓</span>
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCheckIn}
      disabled={isCheckingIn}
      className={`gap-2 hover:bg-primary/10 hover:border-primary/30 ${className}`}
    >
      {isCheckingIn ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <MapPin className="w-4 h-4" />
      )}
      <span className="hidden sm:inline">Check in (+5 pts)</span>
      <span className="sm:hidden">+5</span>
    </Button>
  );
}
