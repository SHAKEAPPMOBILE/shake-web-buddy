import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Zap, Shield } from "lucide-react";
import { ActivitySelectionDialog } from "./ActivitySelectionDialog";
import { GroupChatDialog } from "./GroupChatDialog";
import { ShakingClockAnimation } from "./ShakingClockAnimation";
import { useActivityJoins } from "@/hooks/useActivityJoins";
import { useAuth } from "@/contexts/AuthContext";
import { useCity } from "@/contexts/CityContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { triggerConfettiWaterfall } from "@/lib/confetti";
import avatar1 from "@/assets/avatar-1.png";
import avatar2 from "@/assets/avatar-2.png";
import { GlobalParticipantsSection } from "./GlobalParticipantsSection";

export function HeroSection() {
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
    
    // Join the activity
    const result = await joinActivity(activity);
    if (result.success) {
      if (result.isNewJoin) {
        // Show the clock animation and confetti for new joins
        triggerConfettiWaterfall();
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
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-28 md:pt-36">
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
                Real connections, real life.
              </span>
            </div>

            {/* Main heading */}
            <h1 
              className="text-5xl md:text-7xl lg:text-8xl font-display font-bold leading-tight animate-fade-up"
              style={{ animationDelay: "100ms" }}
            >
              Meet new people.
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

            {/* Global participants count */}
            <div 
              className="flex justify-center animate-fade-up"
              style={{ animationDelay: "250ms" }}
            >
              <GlobalParticipantsSection />
            </div>

            {/* Stats */}
            <div 
              className="flex justify-center animate-fade-up mt-8"
              style={{ animationDelay: "280ms" }}
            >
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

            {/* Luma note - positioned between Let's Shake and How It Works */}
            <p 
              className="text-sm text-muted-foreground/70 animate-fade-up mt-16 md:mt-24"
              style={{ animationDelay: "350ms" }}
            >
              Previously, we operated on Luma, now here.
            </p>
        </div>
      </div>

      {/* Floating elements */}
      <div className="absolute bottom-20 left-10 animate-float" style={{ animationDelay: "0s" }}>
        <div className="w-12 h-12 rounded-xl bg-shake-coral/20 backdrop-blur flex items-center justify-center">
          <Zap className="w-6 h-6 text-shake-coral" />
        </div>
      </div>
      <div className="absolute top-40 right-20 animate-float" style={{ animationDelay: "1s" }}>
        <img src={avatar1} alt="" className="w-14 h-14 rounded-full border-2 border-background shadow-lg" />
      </div>
      <div className="absolute top-60 right-32 animate-float" style={{ animationDelay: "1.5s" }}>
        <img src={avatar2} alt="" className="w-12 h-12 rounded-full border-2 border-background shadow-lg" />
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
        city={selectedCity}
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
        city={selectedCity}
      />
    </>
  );
}
