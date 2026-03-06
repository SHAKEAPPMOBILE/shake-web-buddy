import { useUserPoints } from "@/hooks/useUserPoints";
import { useWelcomeBonus } from "@/hooks/useWelcomeBonus";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MapPin, Sparkles, TrendingUp, UserPlus, Users, Gift, CheckCircle2, AlertCircle } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getDisplayAvatarUrl } from "@/lib/avatar";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/hooks/use-toast";
import shakeCoin from "@/assets/shake-coin-transparent.png";
import { useTranslation } from "react-i18next";

interface PointsDashboardProps {
  userId: string | undefined;
}

interface ReferralWithProfile {
  id: string;
  referred_user_id: string;
  points_awarded: number;
  created_at: string;
  profile: {
    name: string | null;
    avatar_url: string | null;
  } | null;
}

export function PointsDashboard({ userId }: PointsDashboardProps) {
  const { t } = useTranslation();
  const { points, isLoading, refetch: refetchPoints } = useUserPoints(userId);
  const { isComplete, isClaimed, isLoading: bonusLoading, missingFields, claimBonus } = useWelcomeBonus(userId);

  const handleClaimBonus = async () => {
    const success = await claimBonus();
    if (success) {
      refetchPoints();
      toast({
        title: t('points.bonusClaimedTitle', '🎉 Welcome Bonus Claimed!'),
        description: t('points.bonusClaimedDesc', 'You earned +10 points for completing your profile!'),
        duration: 3000,
      });
    }
  };

  const { data: referrals = [], isLoading: referralsLoading } = useQuery({
    queryKey: ["referrals", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("referrals")
        .select("id, referred_user_id, points_awarded, created_at")
        .eq("referrer_user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching referrals:", error);
        return [];
      }

      // Fetch profiles for referred users
      const referredUserIds = data.map((r) => r.referred_user_id);
      if (referredUserIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url")
        .in("user_id", referredUserIds);

      // Map profiles to referrals
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
      
      return data.map((referral) => ({
        ...referral,
        profile: profileMap.get(referral.referred_user_id) || null,
      })) as ReferralWithProfile[];
    },
    enabled: !!userId,
  });

  const totalReferralPoints = referrals.reduce((sum, r) => sum + r.points_awarded, 0);

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-shake-yellow/10 to-shake-green/5 rounded-2xl p-6 border border-shake-yellow/20">
        <Skeleton className="h-8 w-24 mb-2" />
        <Skeleton className="h-12 w-32" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Points Card */}
      <div className="bg-gradient-to-br from-shake-yellow/10 to-shake-green/5 rounded-2xl p-6 border border-shake-yellow/20">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <img src={shakeCoin} alt="Points" className="w-8 h-8" />
          <h3 className="text-lg font-display font-bold">{t('points.title', 'My Points')}</h3>
        </div>

        {/* Points display */}
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-4xl font-bold text-shake-yellow">
            {points.toLocaleString()}
          </span>
          <span className="text-muted-foreground">{t('profile.points', 'points')}</span>
        </div>

        {/* Welcome Bonus Section */}
        <div className={`rounded-xl p-4 border ${isClaimed ? 'bg-shake-green/10 border-shake-green/30' : isComplete ? 'bg-shake-yellow/10 border-shake-yellow/30' : 'bg-muted/50 border-border'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isClaimed ? (
                <CheckCircle2 className="w-5 h-5 text-shake-green" />
              ) : isComplete ? (
                <Gift className="w-5 h-5 text-shake-yellow" />
              ) : (
                <AlertCircle className="w-5 h-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium text-sm">{t('points.welcomeBonus', 'Welcome Bonus')}</p>
                <p className="text-xs text-muted-foreground">
                  {isClaimed 
                    ? t('points.claimed', 'Claimed! +10 points')
                    : isComplete 
                      ? t('points.readyToClaim', 'Ready to claim!')
                      : t('points.completeProfile', 'Complete your profile ({{count}} fields missing)', { count: missingFields.length })}
                </p>
              </div>
            </div>
            {!isClaimed && isComplete && (
              <Button 
                size="sm" 
                onClick={handleClaimBonus}
                className="bg-shake-yellow hover:bg-shake-yellow/90 text-black"
              >
                {t('points.claimButton', 'Claim +10')}
              </Button>
            )}
          </div>
          {!isClaimed && !isComplete && missingFields.length > 0 && (
            <div className="mt-2 text-xs text-muted-foreground">
              {t('points.missing', 'Missing')}: {missingFields.join(", ")}
            </div>
          )}
        </div>

        {/* How to earn section */}
        <div className="bg-card/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Sparkles className="w-4 h-4 text-shake-yellow" />
            <span>{t('points.howToEarn', 'How to earn points')}</span>
          </div>
          
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Gift className="w-4 h-4 mt-0.5 text-shake-yellow shrink-0" />
              <span>
                <strong className="text-foreground">{t('points.completeProfileDesc', 'Complete your profile')}</strong> — {t('points.completeProfilePoints', 'Earn +10 points when you fill out all profile fields')}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 mt-0.5 text-shake-green shrink-0" />
              <span>
                <strong className="text-foreground">{t('points.checkInVenues', 'Check in at venues')}</strong> — {t('points.checkInPoints', 'Earn +5 points when you check in at the venues of your activities')}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <span>
                <strong className="text-foreground">{t('points.createActivities', 'Create popular activities')}</strong> — {t('points.createActivitiesPoints', 'Earn +5 points for every 5 attendees on activities you create (10 attendees = +10 points, etc.)')}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <UserPlus className="w-4 h-4 mt-0.5 text-purple-500 shrink-0" />
              <span>
                <strong className="text-foreground">{t('points.inviteFriends', 'Invite friends')}</strong> — {t('points.inviteFriendsPoints', 'Earn +5 points when someone signs up using your referral link')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Referrals Section */}
      <div className="bg-card rounded-2xl p-4 border border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-500" />
            <h4 className="font-medium">{t('points.referrals', 'Referrals')}</h4>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">{referrals.length} {t('points.friends', 'friends')}</span>
            {totalReferralPoints > 0 && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-shake-yellow font-medium">+{totalReferralPoints} pts</span>
              </>
            )}
          </div>
        </div>

        {referralsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : referrals.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <UserPlus className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t('points.noReferrals', 'No referrals yet')}</p>
            <p className="text-xs mt-1">{t('points.shareToEarn', 'Share your link to earn +5 points per signup!')}</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {referrals.map((referral) => (
              <div key={referral.id} className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  {referral.profile?.avatar_url ? (
                    <AvatarImage src={getDisplayAvatarUrl(referral.profile.avatar_url)} alt={referral.profile.name || "User"} />
                  ) : null}
                  <AvatarFallback className="bg-muted text-muted-foreground text-sm">
                    {referral.profile?.name?.charAt(0)?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {referral.profile?.name || "Anonymous"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(referral.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="text-sm font-medium text-shake-yellow">
                  +{referral.points_awarded}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
