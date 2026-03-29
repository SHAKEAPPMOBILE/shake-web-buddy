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
import { OnboardingScreens } from "./OnboardingScreens";
import { MandatoryPhotoScreen } from "./MandatoryPhotoScreen";
import { LoadingSpinner } from "./LoadingSpinner";

import { PremiumDialog } from "./PremiumDialog";
import { ProximityCheckInPopup } from "./ProximityCheckInPopup";
import { useAuth } from "@/contexts/AuthContext";
import { useCity } from "@/contexts/CityContext";
import { useActivityJoins } from "@/hooks/useActivityJoins";
import { usePrivateMessageNotifications } from "@/hooks/usePrivateMessageNotifications";
import { useProximityCheckIn } from "@/hooks/useProximityCheckIn";
import { usePaymentSuccessHandler } from "@/hooks/usePaymentSuccessHandler";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "@/lib/app-toast";
import { triggerConfettiWaterfall } from "@/lib/confetti";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { logPostgrestError } from "@/lib/supabaseErrorLog";
import { hasValidAvatarUrl } from "@/lib/avatar";
import { getOrderedActivities, getNextOccurrenceDate } from "@/data/activityTypes";
import EventsPage from "@/pages/EventsPage";

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
  const [showEvents, setShowEvents] = useState(false);
  const [eventsEntrySource, setEventsEntrySource] = useState<"home" | "plans">("home");
  
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
  
  // State for opening subscription dropdown from navigation state
  const [openSubscriptionOnMount, setOpenSubscriptionOnMount] = useState(false);
  const [showMandatoryPhoto, setShowMandatoryPhoto] = useState(false);
  const [isCheckingAvatar, setIsCheckingAvatar] = useState(true);

  const { user, isLoading, didJustSignUp } = useAuth();
  const { selectedCity } = useCity();
  const navigate = useNavigate();
  const location = useLocation();
  const { joinActivity, getActivityJoinCount, activeJoins, hasUserJoined } = useActivityJoins(selectedCity);
  const { showOnboarding, isChecking: isCheckingOnboarding, completeOnboarding } = useOnboarding(user?.id, didJustSignUp);
  
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
  
  // location.state: profile tab + subscription, or Near You (openEvents) after standalone /events
  useEffect(() => {
    const state = location.state as {
      openTab?: string;
      openSubscription?: boolean;
      openEvents?: boolean;
      activeTab?: string;
    } | null;
    if (!state) return;

    let shouldClear = false;
    if (state.openTab === "profile" && state.openSubscription) {
      setActiveTab("profile");
      setOpenSubscriptionOnMount(true);
      shouldClear = true;
    }
    if (state.activeTab === "plans") {
      setActiveTab("plans");
      shouldClear = true;
    }
    if (state.activeTab === "home") {
      setActiveTab("home");
      shouldClear = true;
    }
    if (state.openEvents) {
      setShowEvents(true);
      shouldClear = true;
    }
    if (shouldClear) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, navigate, location.pathname]);
  
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

  // Check if user needs to complete profile (avatar required; name/dob for auth redirect)
  useEffect(() => {
    if (isLoading || !user) {
      setIsCheckingAvatar(false);
      setShowMandatoryPhoto(false);
      return;
    }

    let cancelled = false;
    let retryCount = 0;
    const maxRetries = 3;

    const checkProfileCompletion = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setIsCheckingAvatar(false);
          return;
        }

        const [
          { data: profile, error: profileError },
          { data: profilePrivate, error: privateError },
        ] = await Promise.all([
          supabase.from("profiles").select("name, avatar_url").eq("user_id", user.id).maybeSingle(),
          supabase.from("profiles_private").select("*").eq("user_id", user.id).maybeSingle(),
        ]);

        if (cancelled) return;

        if (privateError) {
          logPostgrestError("IOSAppLayout profiles_private select", privateError);
        }
        if (profileError) {
          logPostgrestError("IOSAppLayout profiles select", profileError);
        }

        if ((profileError || privateError || (!profile && !profilePrivate)) && retryCount < maxRetries) {
          retryCount++;
          setTimeout(checkProfileCompletion, 500 * retryCount);
          return;
        }

        const avatarMissing = !hasValidAvatarUrl(profile?.avatar_url);
        if (avatarMissing) {
          setShowMandatoryPhoto(true);
        } else {
          setShowMandatoryPhoto(false);
        }

        if (profile !== null || profilePrivate !== null) {
          const needsProfile = !profile?.name || !profilePrivate?.date_of_birth;
          if (needsProfile && !avatarMissing) {
            navigate("/auth");
          }
        }
      } catch (error) {
        console.log("Profile check failed:", error);
      } finally {
        if (!cancelled) setIsCheckingAvatar(false);
      }
    };

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
    setShowEvents(false);
    setActiveTab("home");
    setShowHomeActivities(true);
    // Keep URL in sync with the home/activities flow.
    navigate("/", { replace: true });
  };

  const handleTabChange = (tab: string) => {
    if (tab === "shake") {
      handleShakeClick();
      return;
    }
    setShowEvents(false);
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
        // Already joined - show confirmation modal again so user sees venue + time
        setShowJoinedConfirmation(true);
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
    // Show the joined confirmation with venue info and attendee preview
    setShowJoinedConfirmation(true);
    setShowHomeActivities(false);
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

  const openNearYou = useCallback((from: "home" | "plans") => {
    try {
      sessionStorage.setItem("eventsEntrySource", from);
    } catch {
      /* ignore */
    }
    setEventsEntrySource(from);
    setShowEvents(true);
  }, []);

  /** Chat tab stays mounted (hidden when inactive) so `isActiveTab` can flip and refetch the list after event join. */
  const renderNonChatTab = () => {
    switch (activeTab) {
      case "chat":
        return null;
      case "home":
        return (
          <HomeTab 
            showActivities={showHomeActivities} 
            onSelectActivity={handleHomeActivitySelect}
            onCloseActivities={() => setShowHomeActivities(false)}
            isShaking={isHeroShaking}
            onOpenEvents={() => openNearYou("home")}
            onUpgradeClick={() => setShowPremiumDialog(true)}
          />
        );
      case "plans":
        return (
          <PlansTab 
            onChatViewChange={handleChatViewChange}
            pendingPaidActivityId={pendingPaidActivityId}
            onPendingPaidActivityHandled={() => setPendingPaidActivityId(null)}
            onOpenEvents={() => openNearYou("plans")}
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
              onOpenEvents={() => openNearYou("home")}
              onUpgradeClick={() => setShowPremiumDialog(true)}
            />
          );
        }
        return (
          <ProfileTab 
            onSignOut={handleSignOut} 
            initialOpenSubscription={openSubscriptionOnMount}
            onSubscriptionOpened={() => setOpenSubscriptionOnMount(false)}
          />
        );
      default:
        return (
          <HomeTab 
            showActivities={showHomeActivities} 
            onSelectActivity={handleHomeActivitySelect}
            onCloseActivities={() => setShowHomeActivities(false)}
            isShaking={isHeroShaking}
            onOpenEvents={() => openNearYou("home")}
            onUpgradeClick={() => setShowPremiumDialog(true)}
          />
        );
    }
  };

  // While checking if user has avatar, avoid flashing main app
  if (user && isCheckingAvatar) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Block until profile photo is set (new and existing users)
  if (user && showMandatoryPhoto) {
    return (
      <MandatoryPhotoScreen
        userId={user.id}
        onComplete={() => setShowMandatoryPhoto(false)}
      />
    );
  }

  // Show onboarding for new users (after signup)
  if (showOnboarding && !isCheckingOnboarding && user) {
    return <OnboardingScreens onComplete={completeOnboarding} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main content area - fixed height, no scroll */}
      <main
        className={cn(
          "flex-1 overflow-hidden safe-area-top",
          activeTab === "chat" && "bg-white",
          !isInFullPageChat && "pb-20"
        )}
      >
        <div className="h-full">
          {showEvents ? (
            <EventsPage
              eventsEntrySource={eventsEntrySource}
              onClose={(tab) => {
                setShowEvents(false);
                setActiveTab(tab);
              }}
            />
          ) : (
            <div className="relative h-full">
              <div className={cn("h-full", activeTab === "chat" && "hidden")}>{renderNonChatTab()}</div>
              <div className={cn("h-full", activeTab !== "chat" && "hidden")}>
                <ChatTab
                  onChatViewChange={handleChatViewChange}
                  pendingActivity={pendingChatActivity}
                  onPendingActivityHandled={() => setPendingChatActivity(null)}
                  isActiveTab={activeTab === "chat"}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Only hide navigation in full-page chat */}
      {!isInFullPageChat && (
        <IOSTabBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onShakeStart={handleTabBarShake}
        />
      )}

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
