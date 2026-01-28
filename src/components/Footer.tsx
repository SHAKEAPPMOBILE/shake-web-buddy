import { useState } from "react";
import { Instagram, Linkedin, Mail } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCity } from "@/contexts/CityContext";
import { useActivityJoins } from "@/hooks/useActivityJoins";
import { ActivitySelectionDialog } from "./ActivitySelectionDialog";
import { GroupChatDialog } from "./GroupChatDialog";
import { ShakingClockAnimation } from "./ShakingClockAnimation";
import { triggerConfettiWaterfall } from "@/lib/confetti";
import { toast } from "sonner";
import logoShake from "@/assets/logo_shake_original_color.png";

export function Footer() {
  const [isShaking, setIsShaking] = useState(false);
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [showClockAnimation, setShowClockAnimation] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState("");
  const { user } = useAuth();
  const { selectedCity } = useCity();
  const navigate = useNavigate();
  const { joinActivity, getActivityJoinCount } = useActivityJoins(selectedCity);

  const handleShake = () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setIsShaking(true);
    setTimeout(() => {
      setIsShaking(false);
      setShowActivityDialog(true);
    }, 600);
  };

  const handleSelectActivity = async (activity: string) => {
    if (!user) {
      toast.error("Please sign in to join an activity");
      setShowActivityDialog(false);
      navigate("/auth");
      return;
    }
    setSelectedActivity(activity);
    setShowActivityDialog(false);

    const result = await joinActivity(activity);
    if (result.success) {
      if (result.isNewJoin) {
        triggerConfettiWaterfall();
        setShowClockAnimation(true);
      } else {
        setShowChatDialog(true);
      }
    }
  };

  const handlePlanCreated = () => {
    // Plan created - no map navigation
  };

  const handleClockAnimationComplete = () => {
    setShowClockAnimation(false);
    setShowChatDialog(true);
  };

  const handleBackToActivities = () => {
    setShowChatDialog(false);
    setShowActivityDialog(true);
  };

  return (
    <>
      <footer className="py-16 border-t border-border bg-background">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center gap-8 mb-12">
            {/* Brand */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2">
                <img src={logoShake} alt="Shake" className="h-12 object-contain" />
              </div>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Connect with real people through real experiences. Make every moment count.
              </p>
              <div className="flex items-center gap-4">
                <a 
                  href="https://www.instagram.com/shakeapp.inc/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <Instagram className="w-5 h-5" />
                </a>
                <a 
                  href="https://www.linkedin.com/company/shakeapplicatoin/?viewAsMember=true" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <Linkedin className="w-5 h-5" />
                </a>
              </div>
            </div>

            {/* Links */}
            <div className="flex flex-wrap items-center justify-center gap-6">
              <Link 
                to="/community-guidelines" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Community Guidelines
              </Link>
              <Link 
                to="/privacy-policy" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Privacy Policy
              </Link>
              <Link 
                to="/terms-of-service" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Terms of Service
              </Link>
              <a 
                href="mailto:contact@shakeapp.today" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <Mail className="w-4 h-4" />
                Contact Us
              </a>
            </div>
          </div>

          <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} SHAKEapp Inc. All rights reserved.
            </p>
            
            {/* CTA Button */}
            <div className="flex items-center gap-3">
              <Button variant="shake" size="sm" onClick={handleShake} className={isShaking ? "animate-shake" : ""}>
                <span className="text-shake-green">🤝</span>
                Let's Shake!
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              Made with ❤️ for social butterflies
            </p>
          </div>
        </div>
      </footer>

      <ActivitySelectionDialog open={showActivityDialog} onOpenChange={setShowActivityDialog} onSelectActivity={handleSelectActivity} onPlanCreated={handlePlanCreated} city={selectedCity} />
      <ShakingClockAnimation open={showClockAnimation} onOpenChange={setShowClockAnimation} onComplete={handleClockAnimationComplete} />
      <GroupChatDialog open={showChatDialog} onOpenChange={setShowChatDialog} activityType={selectedActivity} onBack={handleBackToActivities} attendeeCount={getActivityJoinCount(selectedActivity)} city={selectedCity} />
      
    </>
  );
}
