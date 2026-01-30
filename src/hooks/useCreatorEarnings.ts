import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ActivityEarning {
  activityId: string;
  activityType: string;
  priceAmount: string;
  participants: number;
  grossAmount: number;
  netAmount: number; // After 15% platform fee
  currency: string;
}

interface CreatorEarningsState {
  activities: ActivityEarning[];
  totalGross: number;
  totalNet: number;
  currency: string;
  isLoading: boolean;
}

// Parse price string like "$10 USD" or "€15 EUR" into amount and currency
function parsePriceString(priceString: string): { amount: number; currency: string } {
  // Remove currency symbols and extract number
  const match = priceString.match(/([€$£¥R])?(\d+(?:\.\d+)?)\s*(\w+)?/);
  if (match) {
    const amount = parseFloat(match[2]);
    let currency = match[3] || "USD";
    
    // Map symbols to currency codes if no code present
    if (!match[3]) {
      const symbolMap: Record<string, string> = {
        "$": "USD",
        "€": "EUR",
        "£": "GBP",
        "¥": "JPY",
        "R": "BRL"
      };
      if (match[1] && symbolMap[match[1]]) {
        currency = symbolMap[match[1]];
      }
    }
    
    return { amount, currency };
  }
  return { amount: 0, currency: "USD" };
}

export function useCreatorEarnings() {
  const { user } = useAuth();
  const [state, setState] = useState<CreatorEarningsState>({
    activities: [],
    totalGross: 0,
    totalNet: 0,
    currency: "USD",
    isLoading: true,
  });

  const fetchEarnings = useCallback(async () => {
    if (!user) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Fetch all paid activities created by this user
      const { data: activities, error: activitiesError } = await supabase
        .from("user_activities")
        .select("id, activity_type, price_amount")
        .eq("user_id", user.id)
        .not("price_amount", "is", null)
        .eq("is_active", true);

      if (activitiesError) throw activitiesError;

      if (!activities || activities.length === 0) {
        setState({
          activities: [],
          totalGross: 0,
          totalNet: 0,
          currency: "USD",
          isLoading: false,
        });
        return;
      }

      // Fetch participant counts for each activity
      const activityIds = activities.map(a => a.id);
      const { data: joins, error: joinsError } = await supabase
        .from("activity_joins")
        .select("activity_id")
        .in("activity_id", activityIds);

      if (joinsError) throw joinsError;

      // Count participants per activity
      const participantCounts: Record<string, number> = {};
      (joins || []).forEach(join => {
        if (join.activity_id) {
          participantCounts[join.activity_id] = (participantCounts[join.activity_id] || 0) + 1;
        }
      });

      // Calculate earnings for each activity
      let totalGross = 0;
      let totalNet = 0;
      let primaryCurrency = "USD";

      const activityEarnings: ActivityEarning[] = activities.map(activity => {
        const participants = participantCounts[activity.id] || 0;
        const { amount, currency } = parsePriceString(activity.price_amount || "");
        
        const gross = amount * participants;
        const net = gross * 0.85; // 85% after 15% platform fee

        totalGross += gross;
        totalNet += net;
        
        // Use the first activity's currency as primary
        if (primaryCurrency === "USD" && currency !== "USD") {
          primaryCurrency = currency;
        }

        return {
          activityId: activity.id,
          activityType: activity.activity_type,
          priceAmount: activity.price_amount || "",
          participants,
          grossAmount: gross,
          netAmount: net,
          currency,
        };
      });

      setState({
        activities: activityEarnings,
        totalGross,
        totalNet,
        currency: primaryCurrency,
        isLoading: false,
      });
    } catch (error) {
      console.error("Error fetching creator earnings:", error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [user]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  return {
    ...state,
    refetch: fetchEarnings,
  };
}
