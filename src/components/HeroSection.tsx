import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Zap, Users, Shield } from "lucide-react";
import { ActivitySelectionDialog } from "./ActivitySelectionDialog";
import { GroupChatDialog } from "./GroupChatDialog";
import { ShakingClockAnimation } from "./ShakingClockAnimation";
import { useActivityJoins } from "@/hooks/useActivityJoins";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// Default city - in a real app this would come from user selection
const DEFAULT_CITY = "New York";

export function HeroSection() {
  const [isShaking, setIsShaking] = useState(false);
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [showClockAnimation, setShowClockAnimation] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();
  const { joinActivity, getActivityJoinCount } = useActivityJoins(DEFAULT_CITY);

  const handleShake = () => {
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
    
    // Join the activity
    const result = await joinActivity(activity);
    if (result.success) {
      if (result.isNewJoin) {
        // Show the clock animation only for new joins
        setShowClockAnimation(true);
      } else {
        // Already joined today, go straight to chat
        setShowChatDialog(true);
      }
    }
  };

  const handleClockAnimationComplete = useCallback(() => {
    setShowClockAnimation(false);
    setShowChatDialog(true);
  }, []);

  const handleBackToActivities = () => {
    setShowChatDialog(false);
    setShowActivityDialog(true);
  };

  return (
    <>
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        {/* Background gradient effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-secondary/15 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card/50 border border-border/50 backdrop-blur-sm animate-fade-up">
              <span className="w-2 h-2 rounded-full bg-shake-green animate-pulse" />
              <span className="text-sm text-muted-foreground">
                Real connections, real experiences
              </span>
            </div>

            {/* Main heading */}
            <h1 
              className="text-5xl md:text-7xl lg:text-8xl font-display font-bold leading-tight animate-fade-up"
              style={{ animationDelay: "100ms" }}
            >
              meet new people.
              <br />
              <span className="text-gradient">SHAKE up your life.</span>
            </h1>

            {/* Subheading */}
            <p 
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-up"
              style={{ animationDelay: "200ms" }}
            >
              Join group activities like lunch, dinner, drinks and a hike. Connect with like-minded 
              people in your city and turn strangers into friends.
            </p>

            {/* Luma note */}
            <p className="text-xs text-muted-foreground/70 animate-fade-up" style={{ animationDelay: "250ms" }}>
              Previously we operated on Luma, now we have our own page
            </p>

            {/* Stats */}
            <div 
              className="grid grid-cols-3 gap-8 animate-fade-up"
              style={{ animationDelay: "280ms" }}
            >
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-display font-bold text-foreground">10K+</div>
                <div className="text-sm text-muted-foreground">Users</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-display font-bold text-foreground">500+</div>
                <div className="text-sm text-muted-foreground">Meetups Done</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-display font-bold text-foreground">50+</div>
                <div className="text-sm text-muted-foreground">Cities</div>
              </div>
            </div>

            {/* CTA Button */}
            <div 
              className="flex items-center justify-center animate-fade-up"
              style={{ animationDelay: "300ms" }}
            >
              <Button
                variant="shake"
                size="xl"
                onClick={handleShake}
                className={isShaking ? "animate-shake" : ""}
              >
                <span className="text-shake-green text-xl">🤝</span>
                Let's Shake!
              </Button>
            </div>
        </div>
      </div>

      {/* Floating elements */}
      <div className="absolute bottom-20 left-10 animate-float" style={{ animationDelay: "0s" }}>
        <div className="w-12 h-12 rounded-xl bg-shake-coral/20 backdrop-blur flex items-center justify-center">
          <Zap className="w-6 h-6 text-shake-coral" />
        </div>
      </div>
      <div className="absolute top-40 right-20 animate-float" style={{ animationDelay: "1s" }}>
        <div className="w-12 h-12 rounded-xl bg-shake-teal/20 backdrop-blur flex items-center justify-center">
          <Users className="w-6 h-6 text-shake-teal" />
        </div>
      </div>
      <div className="absolute bottom-40 right-10 animate-float" style={{ animationDelay: "2s" }}>
        <div className="w-12 h-12 rounded-xl bg-shake-purple/20 backdrop-blur flex items-center justify-center">
          <Shield className="w-6 h-6 text-shake-purple" />
        </div>
      </div>
      </section>

      <ActivitySelectionDialog
        open={showActivityDialog}
        onOpenChange={setShowActivityDialog}
        onSelectActivity={handleSelectActivity}
        city={DEFAULT_CITY}
      />

      <ShakingClockAnimation
        open={showClockAnimation}
        onOpenChange={setShowClockAnimation}
        onComplete={handleClockAnimationComplete}
      />

      <GroupChatDialog
        open={showChatDialog}
        onOpenChange={setShowChatDialog}
        activityType={selectedActivity}
        onBack={handleBackToActivities}
        attendeeCount={getActivityJoinCount(selectedActivity)}
        city={DEFAULT_CITY}
      />
    </>
  );
}
