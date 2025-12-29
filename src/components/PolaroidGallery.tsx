import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCity } from "@/contexts/CityContext";
import { useActivityJoins } from "@/hooks/useActivityJoins";
import { ActivitySelectionDialog } from "./ActivitySelectionDialog";
import { GroupChatDialog } from "./GroupChatDialog";
import { ShakingClockAnimation } from "./ShakingClockAnimation";
import { PlansMapDialog } from "./PlansMapDialog";
import { triggerConfettiWaterfall } from "@/lib/confetti";
import { toast } from "sonner";
import polaroidFriends from "@/assets/polaroid-friends.png";
import polaroidActivities from "@/assets/polaroid-activities.png";
import polaroidDrinks from "@/assets/polaroid-drinks.jpg";

export function PolaroidGallery() {
  const [isShaking, setIsShaking] = useState(false);
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [showClockAnimation, setShowClockAnimation] = useState(false);
  const [showPlansMap, setShowPlansMap] = useState(false);
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

  const handlePlanCreated = (activityType: string) => {
    setSelectedActivity(activityType);
    setShowPlansMap(true);
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
      <section className="pt-12 md:pt-16 pb-16 md:pb-24 bg-background relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12">
            {/* First Polaroid - Activities - far left (smaller) */}
            <div 
              className="relative transform -rotate-6 hover:-rotate-3 transition-transform duration-300 animate-fade-up"
              style={{ animationDelay: "50ms" }}
            >
              <div className="bg-white p-3 pb-12 shadow-2xl rounded-sm">
                <div className="w-56 h-72 md:w-64 md:h-80 overflow-hidden">
                  <img 
                    src={polaroidActivities} 
                    alt="People enjoying activities together" 
                    className="w-full h-full object-cover object-center"
                  />
                </div>
              </div>
              {/* Tape effect */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-yellow-100/80 rotate-3 shadow-sm" />
            </div>

            {/* Second Polaroid - Let's Shake (polaroidFriends) */}
            <div 
              className="relative transform rotate-3 hover:rotate-1 transition-transform duration-300 animate-fade-up"
              style={{ animationDelay: "150ms" }}
            >
              <div className="bg-white p-3 pb-12 shadow-2xl rounded-sm">
                <div className="w-64 h-80 md:w-72 md:h-96 overflow-hidden">
                  <img 
                    src={polaroidFriends} 
                    alt="Friends having fun together" 
                    className="w-full h-full object-cover object-bottom"
                  />
                </div>
              </div>
              {/* Tape effect */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-yellow-100/80 -rotate-2 shadow-sm" />
            </div>

            {/* Third Polaroid - Drinks - far right (smaller) */}
            <div 
              className="relative transform rotate-6 hover:rotate-3 transition-transform duration-300 animate-fade-up"
              style={{ animationDelay: "250ms" }}
            >
              <div className="bg-white p-3 pb-12 shadow-2xl rounded-sm">
                <div className="w-56 h-72 md:w-64 md:h-80 overflow-hidden">
                  <img 
                    src={polaroidDrinks} 
                    alt="Friends enjoying drinks together" 
                    className="w-full h-full object-cover object-center"
                  />
                </div>
              </div>
              {/* Tape effect */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-yellow-100/80 -rotate-2 shadow-sm" />
            </div>
          </div>

          {/* CTA Buttons - Below polaroids */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12 md:mt-16 animate-fade-up" style={{ animationDelay: "300ms" }}>
            <Button variant="shake" size="xl" onClick={handleShake} className={isShaking ? "animate-shake" : ""}>
              <span className="text-shake-green text-xl">🤝</span>
              Let's Shake!
            </Button>
            <Button variant="outline" size="lg" onClick={() => setShowPlansMap(true)} className="gap-2">
              <MapPin className="w-5 h-5" />
              Explore Plans
            </Button>
          </div>
        </div>
      </section>

      <ActivitySelectionDialog open={showActivityDialog} onOpenChange={setShowActivityDialog} onSelectActivity={handleSelectActivity} onPlanCreated={handlePlanCreated} city={selectedCity} />
      <ShakingClockAnimation open={showClockAnimation} onOpenChange={setShowClockAnimation} onComplete={handleClockAnimationComplete} />
      <GroupChatDialog open={showChatDialog} onOpenChange={setShowChatDialog} activityType={selectedActivity} onBack={handleBackToActivities} attendeeCount={getActivityJoinCount(selectedActivity)} city={selectedCity} />
      <PlansMapDialog open={showPlansMap} onOpenChange={setShowPlansMap} city={selectedCity} />
    </>
  );
}
