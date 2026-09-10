import { useAuth } from "@/contexts/AuthContext";
import { useWelcomeBonus } from "@/hooks/useWelcomeBonus";
import { PointsCelebration } from "@/components/PointsCelebration";

/**
 * Mounted once near the app root. Owns the single useWelcomeBonus instance
 * that auto-claims the signup bonus, so exactly one component ever sees
 * justClaimedPoints go non-null — avoids duplicate celebrations/pushes if
 * multiple screens (Profile, PointsDashboard) each held their own instance.
 */
export function WelcomeBonusWatcher() {
  const { user } = useAuth();
  const { justClaimedPoints, userName } = useWelcomeBonus(user?.id);

  if (justClaimedPoints === null) return null;

  return <PointsCelebration points={justClaimedPoints} userName={userName} />;
}
