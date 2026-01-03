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
  const [showHomeActivities, setShowHomeActivities] = useState(false);

  const { user } = useAuth();
  const { selectedCity } = useCity();
  const navigate = useNavigate();
  const { joinActivity, getActivityJoinCount } = useActivityJoins(selectedCity);

  const handleShakeClick = () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    // Switch to home tab and show activities
    setActiveTab("home");
    setShowHomeActivities(true);
  };

  const handleTabChange = (tab: string) => {
    if (tab === "shake") {
      handleShakeClick();
      return;
    }
    setShowHomeActivities(false);
    setActiveTab(tab);
  };

  const handleSelectActivity = async (activity: string) => {
    if (!user) {
      toast.error("Please sign in to join an activity");
      setShowActivityDialog(false);
      navigate("/auth");
      return;
    }
    
    // Close any open dialogs first
    setShowActivityDialog(false);
    setShowChatDialog(false);
    
    // Set the selected activity
    setSelectedActivity(activity);

    const result = await joinActivity(activity);
    if (result.success) {
      if (result.isNewJoin) {
        triggerConfettiWaterfall();
        setShowClockAnimation(true);
      } else {
        // Use the activity parameter directly to ensure correct activity is shown
        // The state will be updated by setSelectedActivity above
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
    setShowHomeActivities(false);
  };

  const handleHomeActivitySelect = async (activity: string) => {
    if (!user) {
      toast.error("Please sign in to join an activity");
      navigate("/auth");
      return;
    }
    setShowHomeActivities(false);
    await handleSelectActivity(activity);
  };

  const handleSignOut = useCallback(() => {
    setActiveTab("home");
  }, []);

  const renderTab = () => {
    switch (activeTab) {
      case "home":
        return (
          <HomeTab 
            showActivities={showHomeActivities} 
            onSelectActivity={handleHomeActivitySelect}
            onCloseActivities={() => setShowHomeActivities(false)}
          />
        );
      case "plans":
        return <PlansTab />;
      case "chat":
        return <ChatTab />;
      case "profile":
        // If user is not logged in, show home tab instead
        if (!user) {
          return (
            <HomeTab 
              showActivities={showHomeActivities} 
              onSelectActivity={handleHomeActivitySelect}
              onCloseActivities={() => setShowHomeActivities(false)}
            />
          );
        }
        return <ProfileTab onSignOut={handleSignOut} />;
      default:
        return (
          <HomeTab 
            showActivities={showHomeActivities} 
            onSelectActivity={handleHomeActivitySelect}
            onCloseActivities={() => setShowHomeActivities(false)}
          />
        );
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
