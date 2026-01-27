import { useUserPoints } from "@/hooks/useUserPoints";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Sparkles, TrendingUp, UserPlus } from "lucide-react";
import shakeCoin from "@/assets/shake-coin-transparent.png";

interface PointsDashboardProps {
  userId: string | undefined;
}

export function PointsDashboard({ userId }: PointsDashboardProps) {
  const { points, isLoading } = useUserPoints(userId);

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-shake-yellow/10 to-shake-green/5 rounded-2xl p-6 border border-shake-yellow/20">
        <Skeleton className="h-8 w-24 mb-2" />
        <Skeleton className="h-12 w-32" />
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-shake-yellow/10 to-shake-green/5 rounded-2xl p-6 border border-shake-yellow/20">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <img src={shakeCoin} alt="Points" className="w-8 h-8" />
        <h3 className="text-lg font-display font-bold">My Points</h3>
      </div>

      {/* Points display */}
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-4xl font-bold text-shake-yellow">
          {points.toLocaleString()}
        </span>
        <span className="text-muted-foreground">points</span>
      </div>

      {/* How to earn section */}
      <div className="bg-card/50 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Sparkles className="w-4 h-4 text-shake-yellow" />
          <span>How to earn points</span>
        </div>
        
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 text-shake-green shrink-0" />
            <span>
              <strong className="text-foreground">Check in at venues</strong> — Earn +5 points when you check in at the venues of your activities
            </span>
          </div>
          <div className="flex items-start gap-2">
            <TrendingUp className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              <strong className="text-foreground">Create popular activities</strong> — Earn +5 points for every 5 attendees on activities you create (10 attendees = +10 points, etc.)
            </span>
          </div>
          <div className="flex items-start gap-2">
            <UserPlus className="w-4 h-4 mt-0.5 text-purple-500 shrink-0" />
            <span>
              <strong className="text-foreground">Invite friends</strong> — Earn +5 points when someone signs up using your referral link
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
