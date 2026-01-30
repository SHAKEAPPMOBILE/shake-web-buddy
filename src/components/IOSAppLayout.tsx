import { useState, useCallback, useEffect, useMemo } from "react";
import { IOSTabBar } from "./IOSTabBar";
import { HomeTab } from "./ios/HomeTab";
import { PlansTab } from "./ios/PlansTab";
import { ChatTab } from "./ios/ChatTab";
import { ProfileTab } from "./ios/ProfileTab";
import { ActivitySelectionDialog } from "./ActivitySelectionDialog";
import { ActivityConfirmationDialog } from "./ActivityConfirmationDialog";
import { ActivityJoinedConfirmation } from "./ActivityJoinedConfirmation";
import { ShakingClockAnimation } from "./ShakingClockAnimation";

import { PremiumDialog } from "./PremiumDialog";
import { ProximityCheckInPopup } from "./ProximityCheckInPopup";
import { useAuth } from "@/contexts/AuthContext";
import { useCity } from "@/contexts/CityContext";
import { useActivityJoins } from "@/hooks/useActivityJoins";
import { usePrivateMessageNotifications } from "@/hooks/usePrivateMessageNotifications";
import { useProximityCheckIn } from "@/hooks/useProximityCheckIn";
import { usePaymentSuccessHandler } from "@/hooks/usePaymentSuccessHandler";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { triggerConfettiWaterfall } from "@/lib/confetti";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getOrderedActivities, getNextOccurrenceDate } from "@/data/activityTypes";

export function IOSAppLayout() {
  const [activeTab, setActiveTab] = useState("home");
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [showClockAnimation, setShowClockAnimation] = useState(false);
  const [showJoinedConfirmation, setShowJoinedConfirmation] = useState(false);
  
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState("");
  const [showHomeActivities, setShowHomeActivities] = useState(false);
  const [isHeroShaking, setIsHeroShaking] = useState(false);
  const [isInFullPageChat, setIsInFullPageChat] = useState(false);
  
  // State for navigating to chat tab with a specific activity
  const [pendingChatActivity, setPendingChatActivity] = useState<{ activityType: string; city: string } | null>(null);

  // Confirmation state for the HomeTab carousel (the big circle swipe carousel)
  const [showHomeConfirmation, setShowHomeConfirmation] = useState(false);
  const [pendingHomeActivity, setPendingHomeActivity] = useState<{ id: string; label: string; emoji: string } | null>(null);
  
  // Track the city used for the current activity/chat (for cross-city joins)
  const [activityCity, setActivityCity] = useState<string>("");
  const [showProximityPopup, setShowProximityPopup] = useState(false);
  
  // State for pending paid activity to open after verification
  const [pendingPaidActivityId, setPendingPaidActivityId] = useState<string | null>(null);

  const { user, isLoading } = useAuth();
  const { selectedCity } = useCity();
  const navigate = useNavigate();
  const { joinActivity, getActivityJoinCount, activeJoins, hasUserJoined } = useActivityJoins(selectedCity);
  
  // Handle payment success from Stripe redirect
  const { isVerifying, wasSuccessful, verifiedActivityId, resetPaymentState } = usePaymentSuccessHandler();
  
  // When payment is verified, navigate to plans tab to open the activity chat
  useEffect(() => {
    if (wasSuccessful && verifiedActivityId) {
      // Switch to plans tab and set the pending activity to open
      setPendingPaidActivityId(verifiedActivityId);
      setActiveTab("plans");
      resetPaymentState();
    }
  }, [wasSuccessful, verifiedActivityId, resetPaymentState]);
  
  // Get active activity types the user has joined that are SCHEDULED FOR TODAY (for proximity detection)
  const userActiveActivityTypes = useMemo(() => {
    if (!user) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return activeJoins
      .filter(join => {
        if (join.user_id !== user.id) return false;
        
        // Check if this activity type is scheduled for today
        const nextOccurrence = getNextOccurrenceDate(join.activity_type);
        const occurrenceDay = new Date(nextOccurrence);
        occurrenceDay.setHours(0, 0, 0, 0);
        
        return occurrenceDay.getTime() === today.getTime();
      })
      .map(join => join.activity_type);
  }, [activeJoins, user]);
  
  // Proximity check-in hook
  const {
    isNearVenue,
    venueName,
    activityType: proximityActivityType,
    distance,
    dismissProximity,
  } = useProximityCheckIn(selectedCity, userActiveActivityTypes);
  
  // Show proximity popup when near a venue
  useEffect(() => {
    if (isNearVenue && venueName && !showProximityPopup) {
      setShowProximityPopup(true);
    }
  }, [isNearVenue, venueName, showProximityPopup]);
  
  // Initialize push notifications for private messages
  usePrivateMessageNotifications();

  // Check if user needs to complete profile after Google OAuth
  // Only check if user is logged in - don't redirect logged out users
  useEffect(() => {
    // Don't do anything if still loading or user is not logged in
    if (isLoading || !user) return;

    let cancelled = false;
    let retryCount = 0;
    const maxRetries = 3;

    const checkProfileCompletion = async () => {
      try {
        // First verify we have a valid session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.log("No valid session during profile check, skipping");
          return;
        }

        const [{ data: profile, error: profileError }, { data: profilePrivate, error: privateError }] = await Promise.all([
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

        // If we got errors or null results, it might be a timing issue - retry
        if ((profileError || privateError || (!profile && !profilePrivate)) && retryCount < maxRetries) {
          retryCount++;
          console.log(`Profile check retry ${retryCount}/${maxRetries}`);
          setTimeout(checkProfileCompletion, 500 * retryCount);
          return;
        }

        // Only redirect if we actually got results and they're incomplete
        // Don't redirect if we couldn't fetch the data (network issues, etc.)
        if (profile !== null || profilePrivate !== null) {
          const needsProfile = !profile?.name || !profilePrivate?.date_of_birth;

          if (needsProfile) {
            // Redirect to auth page to complete profile
            navigate("/auth");
          }
        }
      } catch (error) {
        console.log("Profile check failed:", error);
      }
    };

    // Longer delay to ensure auth state and session are fully settled
    setTimeout(checkProfileCompletion, 300);

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

  const actuallyJoinActivity = useCallback(async (activity: string, cityOverride?: string) => {
    // Close any open dialogs first
    setShowActivityDialog(false);

    // Set the selected activity and city
    setSelectedActivity(activity);
    const targetCity = cityOverride || selectedCity;
    setActivityCity(targetCity);

    const result = await joinActivity(activity, cityOverride);
    if (result.success) {
      if (result.isNewJoin) {
        triggerConfettiWaterfall();
        setShowClockAnimation(true);
      } else {
        // Navigate to chat tab with the activity - full screen chat view
        setPendingChatActivity({ activityType: activity, city: targetCity });
        setActiveTab("chat");
        setShowHomeActivities(false);
      }
    }
  }, [joinActivity, selectedCity]);

  const handleSelectActivity = async (activity: string) => {
    if (!user) {
      toast.error("Please sign in to join an activity");
      setShowActivityDialog(false);
      navigate("/auth");
      return;
    }

    await actuallyJoinActivity(activity);
  };

  const handlePlanCreated = useCallback(() => {
    // Plan created - just close the dialog, no map
  }, []);

  const handleClockAnimationComplete = useCallback(() => {
    setShowClockAnimation(false);
    // Show the joined confirmation with venue info and option to join chat
    setShowJoinedConfirmation(true);
  }, []);

  const handleJoinGroupChatFromConfirmation = useCallback(() => {
    // Navigate to chat tab with full-screen view
    setPendingChatActivity({ activityType: selectedActivity, city: activityCity || selectedCity });
    setActiveTab("chat");
    setShowHomeActivities(false);
  }, [selectedActivity, activityCity, selectedCity]);

  const handleHomeActivitySelect = async (activity: { id: string; label: string; emoji: string }) => {
    if (!user) {
      toast.error("Please sign in to join an activity");
      navigate("/auth");
      return;
    }

    // Use the activity object passed directly - no lookup needed
    // This prevents race conditions on mobile where the carousel might change
    setPendingHomeActivity(activity);
    setShowHomeConfirmation(true);
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

  const handleChatViewChange = useCallback((isInChat: boolean) => {
    setIsInFullPageChat(isInChat);
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
        return (
          <PlansTab 
            onChatViewChange={handleChatViewChange}
            pendingPaidActivityId={pendingPaidActivityId}
            onPendingPaidActivityHandled={() => setPendingPaidActivityId(null)}
          />
        );
      case "chat":
        return (
          <ChatTab 
            onChatViewChange={handleChatViewChange} 
            pendingActivity={pendingChatActivity}
            onPendingActivityHandled={() => setPendingChatActivity(null)}
          />
        );
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
      <main className={cn("flex-1 overflow-hidden safe-area-top", user && !isInFullPageChat && "pb-20")}>
        <div className="h-full">
          {renderTab()}
        </div>
      </main>

      {/* Only show navigation when user is logged in and not in full-page chat */}
      {user && !isInFullPageChat && <IOSTabBar activeTab={activeTab} onTabChange={handleTabChange} onShakeStart={handleTabBarShake} />}

      {/* Dialogs */}
      <ActivitySelectionDialog
        open={showActivityDialog}
        onOpenChange={setShowActivityDialog}
        onSelectActivity={handleSelectActivity}
        onPlanCreated={handlePlanCreated}
        city={selectedCity}
      />

      <ActivityConfirmationDialog
        open={showHomeConfirmation}
        onOpenChange={setShowHomeConfirmation}
        activity={pendingHomeActivity}
        currentCity={selectedCity}
        onExplore={() => {
          setShowHomeConfirmation(false);
          setPendingHomeActivity(null);
        }}
        onConfirm={async (city) => {
          if (!pendingHomeActivity) return;
          setShowHomeConfirmation(false);
          setShowHomeActivities(false);
          const id = pendingHomeActivity.id;
          setPendingHomeActivity(null);
          await actuallyJoinActivity(id, city);
        }}
      />

      <ShakingClockAnimation
        open={showClockAnimation}
        onOpenChange={setShowClockAnimation}
        onComplete={handleClockAnimationComplete}
      />

      <ActivityJoinedConfirmation
        open={showJoinedConfirmation}
        onOpenChange={setShowJoinedConfirmation}
        activityType={selectedActivity}
        city={activityCity || selectedCity}
        onJoinGroupChat={handleJoinGroupChatFromConfirmation}
      />


      <PremiumDialog
        open={showPremiumDialog}
        onOpenChange={setShowPremiumDialog}
      />

      {/* Proximity Check-in Popup */}
      {venueName && proximityActivityType && distance !== null && (
        <ProximityCheckInPopup
          open={showProximityPopup}
          onOpenChange={(open) => {
            setShowProximityPopup(open);
            if (!open) dismissProximity();
          }}
          venueName={venueName}
          city={selectedCity}
          activityType={proximityActivityType}
          distance={distance}
        />
      )}
    </div>
  );
}
