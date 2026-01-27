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

// Helper to build the referral link
export function getReferralLink(referralCode: string | null): string {
  if (!referralCode) return "https://shakeapp.today";
  return `https://shakeapp.today/${referralCode}`;
}
