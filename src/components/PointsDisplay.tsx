import { useUserPoints } from "@/hooks/useUserPoints";
import { Skeleton } from "@/components/ui/skeleton";
import shakeCoin from "@/assets/shake-coin-transparent.png";

interface PointsDisplayProps {
  userId: string | undefined;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function PointsDisplay({ 
  userId, 
  size = "md",
  showLabel = true 
}: PointsDisplayProps) {
  const { points, isLoading } = useUserPoints(userId);

  const sizeClasses = {
    sm: {
      container: "px-2 py-1",
      coin: "w-4 h-4",
      text: "text-sm",
    },
    md: {
      container: "px-3 py-1.5",
      coin: "w-5 h-5",
      text: "text-base",
    },
    lg: {
      container: "px-4 py-2",
      coin: "w-6 h-6",
      text: "text-lg",
    },
  };

  const classes = sizeClasses[size];

  if (isLoading) {
    return <Skeleton className={`h-8 w-20 rounded-full`} />;
  }

  return (
    <div 
      className={`flex items-center gap-1.5 bg-shake-yellow/10 rounded-full ${classes.container}`}
    >
      <img 
        src={shakeCoin} 
        alt="Points" 
        className={`${classes.coin} object-contain`}
      />
      <span className={`font-semibold text-shake-yellow ${classes.text}`}>
        {points.toLocaleString()}
      </span>
      {showLabel && (
        <span className={`text-muted-foreground ${classes.text}`}>
          pts
        </span>
      )}
    </div>
  );
}
