import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Zap, Shield, MapPin } from "lucide-react";
import { ActivitySelectionDialog } from "./ActivitySelectionDialog";
import { GroupChatDialog } from "./GroupChatDialog";
import { ShakingClockAnimation } from "./ShakingClockAnimation";
import { PlansMapDialog } from "./PlansMapDialog";
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
  const [showPlansMap, setShowPlansMap] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState("");
  const [phoneInitialShake, setPhoneInitialShake] = useState(true);
  const [phoneHovered, setPhoneHovered] = useState(false);
  const {
    user
  } = useAuth();
  const {
    selectedCity
  } = useCity();
  const navigate = useNavigate();
  const {
    joinActivity,
    getActivityJoinCount
  } = useActivityJoins(selectedCity);

  // Rotating text for "Meet new..." phrases
  const meetPhrases = useMemo(() => ["Meet new people.", "Meet new friends.", "Meet a new buddy.", "Meet a partner.", "Meet a new love."], []);
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const phraseIntervalRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    phraseIntervalRef.current = setInterval(() => {
      setCurrentPhraseIndex(prev => (prev + 1) % meetPhrases.length);
    }, 2500);
    return () => {
      if (phraseIntervalRef.current) {
        clearInterval(phraseIntervalRef.current);
      }
    };
  }, [meetPhrases.length]);
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

  // Called when a plan is created via ActivitySelectionDialog
  const handlePlanCreated = useCallback((activityType: string) => {
    setSelectedActivity(activityType);
    // Open the plans map to show the new plan
    setShowPlansMap(true);
  }, []);
  const handleClockAnimationComplete = useCallback(() => {
    setShowClockAnimation(false);
    setShowChatDialog(true);
  }, []);
  const handleBackToActivities = () => {
    setShowChatDialog(false);
    setShowActivityDialog(true);
  };

  // Stop initial phone shake after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setPhoneInitialShake(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);
  const isPhoneShaking = phoneInitialShake || phoneHovered;
  return <>
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
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-bold leading-tight animate-fade-up" style={{
            animationDelay: "100ms"
          }}>
              <span className="transition-opacity duration-500">{meetPhrases[currentPhraseIndex]}</span>
              <br />
              <span className="text-gradient">SHAKE up your life.</span>
            </h1>

            {/* Shaking Phone Illustration */}
            <div className="relative flex items-center justify-center animate-fade-up py-8 md:py-12" style={{
            animationDelay: "150ms"
          }}>
              <div className="relative cursor-pointer" onClick={handleShake} onMouseEnter={() => setPhoneHovered(true)} onMouseLeave={() => setPhoneHovered(false)}>
                {/* Motion lines - left side */}
                <div className={`absolute -left-10 md:-left-14 top-1/2 -translate-y-1/2 flex flex-col gap-3 transition-opacity duration-300 ${isPhoneShaking ? 'opacity-100' : 'opacity-30'}`}>
                  <div className={`w-8 h-1 bg-primary/70 rounded-full ${isPhoneShaking ? 'animate-pulse' : ''}`} style={{
                  animationDelay: "0ms"
                }} />
                  <div className={`w-12 h-1 bg-shake-coral/60 rounded-full ${isPhoneShaking ? 'animate-pulse' : ''}`} style={{
                  animationDelay: "100ms"
                }} />
                  <div className={`w-6 h-1 bg-accent/60 rounded-full ${isPhoneShaking ? 'animate-pulse' : ''}`} style={{
                  animationDelay: "200ms"
                }} />
                </div>
                
                {/* Motion lines - right side */}
                <div className={`absolute -right-10 md:-right-14 top-1/2 -translate-y-1/2 flex flex-col gap-3 transition-opacity duration-300 ${isPhoneShaking ? 'opacity-100' : 'opacity-30'}`}>
                  <div className={`w-6 h-1 bg-accent/60 rounded-full ${isPhoneShaking ? 'animate-pulse' : ''}`} style={{
                  animationDelay: "50ms"
                }} />
                  <div className={`w-12 h-1 bg-shake-coral/60 rounded-full ${isPhoneShaking ? 'animate-pulse' : ''}`} style={{
                  animationDelay: "150ms"
                }} />
                  <div className={`w-8 h-1 bg-primary/70 rounded-full ${isPhoneShaking ? 'animate-pulse' : ''}`} style={{
                  animationDelay: "250ms"
                }} />
                </div>

                {/* Phone body */}
                <div className={`relative w-20 h-36 md:w-24 md:h-44 bg-gradient-to-b from-card to-card/80 rounded-3xl border-2 border-border shadow-2xl transition-transform ${isPhoneShaking ? 'animate-shake' : ''}`}>
                  {/* Phone screen with Let's Shake circle */}
                  <div className="absolute inset-2 bg-gradient-to-br from-primary/30 via-accent/20 to-shake-coral/30 rounded-2xl flex flex-col items-center justify-center gap-1">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-shake-green/30 border-2 border-shake-green/50 flex items-center justify-center">
                      <span className="text-xl md:text-2xl">🤝</span>
                    </div>
                    <span className="text-[8px] md:text-[10px] font-semibold text-foreground/80">Let's Shake</span>
                  </div>
                  {/* Phone notch */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-1.5 bg-border rounded-full" />
                </div>

                {/* Explore Plans Icon - Bottom right of phone */}
                <div className="flex flex-col items-center gap-1 md:gap-2 absolute -right-12 md:-right-16 -bottom-6 md:-bottom-8">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-card/80 border border-border/50 backdrop-blur flex items-center justify-center shadow-lg hover:scale-105 transition-transform cursor-pointer" onClick={e => {
                  e.stopPropagation();
                  setShowPlansMap(true);
                }}>
                    <MapPin className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                  </div>
                  <span className="text-[10px] md:text-xs text-muted-foreground font-medium">Explore Plans</span>
                </div>
              </div>
            </div>

            {/* Subheading */}
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-up pt-4" style={{
            animationDelay: "200ms"
          }}>
              Join group activities like lunch, dinner, drinks and more. Connect with like-minded 
              people in your city and turn strangers into friends.
            </p>

            {/* Global participants count */}
            <div className="flex justify-center animate-fade-up" style={{
            animationDelay: "250ms"
          }}>
              <GlobalParticipantsSection />
            </div>

            {/* Stats */}
            <div className="flex justify-center animate-fade-up mt-8" style={{
            animationDelay: "280ms"
          }}>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-display font-bold text-foreground">50+</div>
                <div className="text-sm text-muted-foreground">Cities</div>
              </div>
            </div>


            {/* Luma note - positioned between Let's Shake and How It Works */}
            <p className="text-sm text-muted-foreground/70 animate-fade-up mt-16 md:mt-24" style={{
            animationDelay: "350ms"
          }}>
              Previously, we operated on Luma, now here.
            </p>
        </div>
      </div>

      {/* Floating elements */}
      <div className="absolute bottom-20 left-10 animate-float" style={{
        animationDelay: "0s"
      }}>
        <div className="w-12 h-12 rounded-xl bg-shake-coral/20 backdrop-blur flex items-center justify-center">
          <Zap className="w-6 h-6 text-shake-coral" />
        </div>
      </div>
      <div className="absolute top-40 right-20 animate-float" style={{
        animationDelay: "1s"
      }}>
        <img src={avatar1} alt="" className="w-14 h-14 rounded-full border-2 border-background shadow-lg" />
      </div>
      <div className="absolute top-60 right-32 animate-float" style={{
        animationDelay: "1.5s"
      }}>
        <img src={avatar2} alt="" className="w-12 h-12 rounded-full border-2 border-background shadow-lg" />
      </div>
      <div className="absolute bottom-40 right-10 animate-float" style={{
        animationDelay: "2s"
      }}>
        <div className="w-12 h-12 rounded-xl bg-shake-purple/20 backdrop-blur flex items-center justify-center">
          <Shield className="w-6 h-6 text-shake-purple" />
        </div>
      </div>
      </section>

      <ActivitySelectionDialog open={showActivityDialog} onOpenChange={setShowActivityDialog} onSelectActivity={handleSelectActivity} onPlanCreated={handlePlanCreated} city={selectedCity} />

      <ShakingClockAnimation open={showClockAnimation} onOpenChange={setShowClockAnimation} onComplete={handleClockAnimationComplete} />

      <GroupChatDialog open={showChatDialog} onOpenChange={setShowChatDialog} activityType={selectedActivity} onBack={handleBackToActivities} attendeeCount={getActivityJoinCount(selectedActivity)} city={selectedCity} />

      <PlansMapDialog open={showPlansMap} onOpenChange={setShowPlansMap} city={selectedCity} />
    </>;
}