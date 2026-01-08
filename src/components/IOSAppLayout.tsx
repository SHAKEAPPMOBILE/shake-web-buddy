import { useState, useCallback, useEffect } from "react";
import { IOSTabBar } from "./IOSTabBar";
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
import { usePrivateMessageNotifications } from "@/hooks/usePrivateMessageNotifications";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { triggerConfettiWaterfall } from "@/lib/confetti";
import { supabase } from "@/integrations/supabase/client";

export function IOSAppLayout() {
  const [activeTab, setActiveTab] = useState("home");
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [showClockAnimation, setShowClockAnimation] = useState(false);
  const [showPlansMap, setShowPlansMap] = useState(false);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState("");
  const [showHomeActivities, setShowHomeActivities] = useState(false);
  const [isHeroShaking, setIsHeroShaking] = useState(false);

  const { user, isLoading } = useAuth();
  const { selectedCity } = useCity();
  const navigate = useNavigate();
  const { joinActivity, getActivityJoinCount } = useActivityJoins(selectedCity);
  
  // Initialize push notifications for private messages
  usePrivateMessageNotifications();

  // Check if user needs to complete profile after Google OAuth
  // Only check if user is logged in - don't redirect logged out users
  useEffect(() => {
    // Don't do anything if still loading or user is not logged in
    if (isLoading || !user) return;

    let cancelled = false;

    const checkProfileCompletion = async () => {
      try {
        const [{ data: profile }, { data: profilePrivate }] = await Promise.all([
          supabase
            .from("profiles")
            .select("name")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("profiles_private")
            .select("date_of_birth")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        const needsProfile = !profile?.name || !profilePrivate?.date_of_birth;

        if (needsProfile) {
          // Redirect to auth page to complete profile
          navigate("/auth");
        }
      } catch (error) {
        console.log("Profile check failed:", error);
      }
    };

    // Small delay to ensure auth state is fully settled
    setTimeout(checkProfileCompletion, 100);

    return () => {
      cancelled = true;
    };
  }, [user, isLoading, navigate]);

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

  const handleTabBarShake = useCallback(() => {
    setIsHeroShaking(true);
    setTimeout(() => {
      setIsHeroShaking(false);
    }, 3000);
  }, []);

  const renderTab = () => {
    switch (activeTab) {
      case "home":
        return (
          <HomeTab 
            showActivities={showHomeActivities} 
            onSelectActivity={handleHomeActivitySelect}
            onCloseActivities={() => setShowHomeActivities(false)}
            isShaking={isHeroShaking}
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
              isShaking={isHeroShaking}
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
            isShaking={isHeroShaking}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main content area - fixed height, no scroll */}
      <main className="flex-1 pb-20 overflow-hidden safe-area-top">
        <div className="h-full">
          {renderTab()}
        </div>
      </main>

      <IOSTabBar activeTab={activeTab} onTabChange={handleTabChange} onShakeStart={handleTabBarShake} />

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
