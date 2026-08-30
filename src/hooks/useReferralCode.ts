import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useReferralCode(userId: string | undefined) {
  const { data: referralCode, isLoading } = useQuery({
    queryKey: ["referral-code", userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("referral_code")
        .eq("user_id", userId)
        .maybeSingle();
      
      if (error) {
        console.error("Error fetching referral code:", error);
        return null;
      }
      
      return data?.referral_code || null;
    },
    enabled: !!userId,
  });

  return { referralCode, isLoading };
}

// Helper to build the referral link.
// Must point at www (the actual app, which has the ReferralTracker route
// that reads /<code> and stores it) — the bare "shakeapp.today" domain
// routes to the separate marketing site, which has no route for an
// arbitrary code and 404s.
export function getReferralLink(referralCode: string | null): string {
  if (!referralCode) return "https://www.shakeapp.today";
  return `https://www.shakeapp.today/${referralCode}`;
}
