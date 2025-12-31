import { useState, useCallback } from "react";
import { IOSTabBar } from "./IOSTabBar";
import { IOSHeader } from "./IOSHeader";
import { HomeTab } from "./ios/HomeTab";
import { PlansTab } from "./ios/PlansTab";
import { ChatTab } from "./ios/ChatTab";
import { ProfileTab } from "./ios/ProfileTab";
import { ActivitySelectionDialog } from "./ActivitySelectionDialog";
import { GroupChatDialog } from "./GroupChatDialog";
import { ShakingClockAnimation } from "./ShakingClockAnimation";
import { PlansMapDialog } from "./PlansMapDialog";
import { PremiumDialog } from "./PremiumDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useCity } from "@/contexts/CityContext";
import { useActivityJoins } from "@/hooks/useActivityJoins";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { triggerConfettiWaterfall } from "@/lib/confetti";

export function IOSAppLayout() {
  const [activeTab, setActiveTab] = useState("home");
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [showClockAnimation, setShowClockAnimation] = useState(false);
  const [showPlansMap, setShowPlansMap] = useState(false);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState("");

  const { user } = useAuth();
  const { selectedCity } = useCity();
  const navigate = useNavigate();
  const { joinActivity, getActivityJoinCount } = useActivityJoins(selectedCity);

  const handleShakeClick = () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setShowActivityDialog(true);
  };

  const handleTabChange = (tab: string) => {
    if (tab === "shake") {
      handleShakeClick();
      return;
    }
    setActiveTab(tab);
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

  const handlePlanCreated = useCallback((activityType: string) => {
    setSelectedActivity(activityType);
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

  const handleHomeActivitySelect = async (activity: string) => {
    if (!user) {
      toast.error("Please sign in to join an activity");
      navigate("/auth");
      return;
    }
    await handleSelectActivity(activity);
  };

  const renderTab = () => {
    switch (activeTab) {
      case "home":
        return <HomeTab onShakeClick={handleShakeClick} onSelectActivity={handleHomeActivitySelect} />;
      case "plans":
        return <PlansTab />;
      case "chat":
        return <ChatTab />;
      case "profile":
        return <ProfileTab />;
      default:
        return <HomeTab onShakeClick={handleShakeClick} onSelectActivity={handleHomeActivitySelect} />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <IOSHeader onUpgradeClick={() => setShowPremiumDialog(true)} />
      
      {/* Main content area - fixed height, no scroll */}
      <main className="flex-1 pt-14 pb-20 overflow-hidden">
        <div className="h-full">
          {renderTab()}
        </div>
      </main>

      <IOSTabBar activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Dialogs */}
      <ActivitySelectionDialog
        open={showActivityDialog}
        onOpenChange={setShowActivityDialog}
        onSelectActivity={handleSelectActivity}
        onPlanCreated={handlePlanCreated}
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

      <PlansMapDialog
        open={showPlansMap}
        onOpenChange={setShowPlansMap}
        city={selectedCity}
      />

      <PremiumDialog
        open={showPremiumDialog}
        onOpenChange={setShowPremiumDialog}
      />
    </div>
  );
}
