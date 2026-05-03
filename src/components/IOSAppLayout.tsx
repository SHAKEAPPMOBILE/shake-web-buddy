import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { IOSTabBar } from "./IOSTabBar";
import { HomeTab } from "./ios/HomeTab";
import { PlansTab } from "./ios/PlansTab";
import { ChatTab } from "./ios/ChatTab";
import { ProfileTab } from "./ios/ProfileTab";
import { ActivitySelectionDialog } from "./ActivitySelectionDialog";
import { ActivityJoinedConfirmation } from "./ActivityJoinedConfirmation";
import { getShakeActivity } from "@/lib/getShakeActivity";
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
import { useCapacitorPushNotifications } from "@/hooks/useCapacitorPushNotifications";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "@/lib/app-toast";
import { triggerConfettiWaterfall } from "@/lib/confetti";
import { playDingDingSound } from "@/lib/notification-sound";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { logPostgrestError } from "@/lib/supabaseErrorLog";
import { hasValidAvatarUrl } from "@/lib/avatar";
import { getOrderedActivities, getNextOccurrenceDate } from "@/data/activityTypes";
import EventsPage from "@/pages/EventsPage";

export function IOSAppLayout() {
  const [activeTab, setActiveTab] = useState("home");
  const [showActivityDialog, setShowActivityDialog] = useState(false);
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
  
  // Track the city used for the current activity/chat (for cross-city joins)
  const [activityCity, setActivityCity] = useState<string>("");
  const [showProximityPopup, setShowProximityPopup] = useState(false);
  
  // State for pending paid activity to open after verification
  const [pendingPaidActivityId, setPendingPaidActivityId] = useState<string | null>(null);
  
  // State for opening subscription dropdown from navigation state
  const [openSubscriptionOnMount, setOpenSubscriptionOnMount] = useState(false);
  const [showMandatoryPhoto, setShowMandatoryPhoto] = useState(false);
  const [isCheckingAvatar, setIsCheckingAvatar] = useState(true);
  const pendingProfileCheckTimeoutRef = useRef<number | null>(null);

  const { user, isLoading, didJustSignUp } = useAuth();
  const { selectedCity } = useCity();
  const navigate = useNavigate();
  const location = useLocation();
  const { joinActivity, getActivityJoinCount, activeJoins, hasUserJoined } = useActivityJoins(selectedCity);
  const { showOnboarding, isChecking: isCheckingOnboarding, completeOnboarding } = useOnboarding(user?.id, didJustSignUp);

  const fetchProfileCompletionStatus = useCallback(async () => {
    if (!user) return null;

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) {
      console.warn("[IOSAppLayout] getSession failed during profile completion check", sessionError.message);
    }
    if (!session) {
      return {
        avatarMissing: false,
        needsProfile: false,
        shouldRetry: false,
      };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle();

    let resolvedProfile = profile;

    if (profileError) {
      logPostgrestError("IOSAppLayout profiles select", profileError);
    }

    if (!profileError && !resolvedProfile) {
      const fallbackName = String(
        user.user_metadata?.name ??
        user.user_metadata?.full_name ??
        user.email?.split("@")[0] ??
        ""
      ).trim() || null;

      const { data: bootstrappedProfile, error: bootstrapError } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: user.id,
            name: fallbackName,
          },
          { onConflict: "user_id" }
        )
        .select("name, avatar_url")
        .maybeSingle();

      if (bootstrapError) {
        logPostgrestError("IOSAppLayout profiles upsert bootstrap", bootstrapError);
      } else {
        resolvedProfile = bootstrappedProfile ?? resolvedProfile;
      }
    }

    const nameMissing = resolvedProfile !== null ? !resolvedProfile?.name?.trim() : false;
    const avatarMissing = !hasValidAvatarUrl(resolvedProfile?.avatar_url);
    const needsProfile = nameMissing || avatarMissing;

    return {
      avatarMissing,
      nameMissing,
      needsProfile,
      shouldRetry: Boolean(profileError || !resolvedProfile),
    };
  }, [user]);

  const applyProfileCompletionStatus = useCallback((status: { avatarMissing: boolean; needsProfile: boolean; nameMissing: boolean }) => {
    setShowMandatoryPhoto(status.avatarMissing);

    // Only redirect to /auth when the user is entirely new (both name AND avatar
    // are absent). A user who has an avatar — e.g. assigned by the DB trigger
    // after Apple OAuth — should never be kicked back to registration just
    // because name is transiently null.
    if (status.nameMissing && status.avatarMissing) {
      navigate("/auth");
    }
  }, [navigate]);
  
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
  
  // Initialize APNs/FCM push notifications (iOS native)
  useCapacitorPushNotifications();

  // Initialize push notifications for private messages
  usePrivateMessageNotifications();

  // Check if user needs to complete profile (name and avatar required for auth redirect)
  useEffect(() => {
    if (isLoading || !user) {
      if (pendingProfileCheckTimeoutRef.current !== null) {
        window.clearTimeout(pendingProfileCheckTimeoutRef.current);
        pendingProfileCheckTimeoutRef.current = null;
      }
      setIsCheckingAvatar(false);
      setShowMandatoryPhoto(false);
      return;
    }

    let cancelled = false;
    let retryCount = 0;
    const maxRetries = 6;

    const checkProfileCompletion = async () => {
      try {
        const status = await fetchProfileCompletionStatus();
        if (cancelled) return;
        if (!status) {
          setIsCheckingAvatar(false);
          return;
        }

        if (status.shouldRetry && retryCount < maxRetries) {
          retryCount++;
          pendingProfileCheckTimeoutRef.current = window.setTimeout(checkProfileCompletion, 500 * retryCount);
          return;
        }

        if (!status.needsProfile) {
          try {
            sessionStorage.removeItem("shake_profile_just_saved");
          } catch {
            /* ignore */
          }
        }

        if (status.nameMissing && status.avatarMissing) {
          let justSavedTs = 0;
          try {
            justSavedTs = Number(sessionStorage.getItem("shake_profile_just_saved") || 0);
          } catch {
            justSavedTs = 0;
          }
          const inGracePeriod = justSavedTs > 0 && Date.now() - justSavedTs < 20000;
          if (inGracePeriod && retryCount < maxRetries) {
            retryCount++;
            pendingProfileCheckTimeoutRef.current = window.setTimeout(checkProfileCompletion, 450 * Math.min(retryCount, 8));
            return;
          }
        }

        applyProfileCompletionStatus(status);
      } catch (error) {
        console.log("Profile check failed:", error);
      } finally {
        if (!cancelled) setIsCheckingAvatar(false);
      }
    };

    setIsCheckingAvatar(true);
    pendingProfileCheckTimeoutRef.current = window.setTimeout(checkProfileCompletion, 300);

    return () => {
      cancelled = true;
      if (pendingProfileCheckTimeoutRef.current !== null) {
        window.clearTimeout(pendingProfileCheckTimeoutRef.current);
        pendingProfileCheckTimeoutRef.current = null;
      }
    };
  }, [user, isLoading, fetchProfileCompletionStatus, applyProfileCompletionStatus]);

  // Global fail-safe: never keep main app blocked by the avatar/profile check spinner for > 3s.
  useEffect(() => {
    if (!user || !isCheckingAvatar) return;

    const timeoutId = window.setTimeout(() => {
      setIsCheckingAvatar(false);
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [user, isCheckingAvatar]);

  const shakeDebounceRef = useRef(false);

  const triggerHapticFeedback = useCallback(() => {
    navigator.vibrate?.(200);
  }, []);

  const executeShakeAction = useCallback(async () => {
    if (!user) return;

    const activity = getShakeActivity(getOrderedActivities());
    if (!activity) return;

    await triggerHapticFeedback();

    setTimeout(() => {
      setSelectedActivity(activity.id);
      setShowEvents(false);
      setActiveTab("home");
      setShowHomeActivities(true);
    }, 600);
  }, [user, triggerHapticFeedback]);

  const handleShakeClick = () => {
    if (!user && !isLoading) {
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
    // JOIN PATH — plan limit does NOT apply here.
    // Joining an existing activity is always free and unlimited.
    // Only creating a new plan (propose-plan flow) is gated by the plan limit.
    console.log('[Join] actuallyJoinActivity — JOIN path, plan limit bypassed', {
      activity,
      cityOverride,
      targetCity: cityOverride || selectedCity,
    });

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
        playDingDingSound();
      }
      // Show the single confirmation modal (celebration phase → venue phase internally)
      setShowJoinedConfirmation(true);
      setShowHomeActivities(false);
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

  const handleJoinGroupChatFromConfirmation = useCallback(() => {
    // Navigate to chat tab with full-screen view
    setPendingChatActivity({ activityType: selectedActivity, city: activityCity || selectedCity });
    setActiveTab("chat");
    setShowHomeActivities(false);
  }, [selectedActivity, activityCity, selectedCity]);

  const handleHomeActivitySelect = async (activity: { id: string; label: string; emoji: string }, cityOverride?: string) => {
    // JOIN PATH from home carousel — plan limit is never checked here.
    // This is called from HomeTab.handleConfirmSelection via the onConfirmActivity prop.
    console.log('[Join] handleHomeActivitySelect — ENTRY', {
      activity,          // full activity object
      cityOverride,
      selectedCity,
      hasUser: !!user,
      userId: user?.id,
      timestamp: new Date().toISOString(),
    });

    if (!user) {
      console.log('[Join] handleHomeActivitySelect → branch: no user → redirecting to /auth');
      toast.error("Please sign in to join an activity");
      navigate("/auth");
      return;
    }

    console.log('[Join] handleHomeActivitySelect → branch: user present → calling actuallyJoinActivity', {
      activityId: activity.id,
      cityOverride,
    });
    setShowHomeActivities(false);
    await actuallyJoinActivity(activity.id, cityOverride);
  };

  const handleSignOut = useCallback(() => {
    setActiveTab("home");
  }, []);

  const handleTabBarShake = useCallback(() => {
    if (shakeDebounceRef.current) {
      return;
    }
    shakeDebounceRef.current = true;
    setTimeout(() => {
      shakeDebounceRef.current = false;
    }, 300);

    setIsHeroShaking(true);
    setTimeout(() => {
      setIsHeroShaking(false);
    }, 3000);

    executeShakeAction();
  }, [executeShakeAction]);

  const handleChatViewChange = useCallback((isInChat: boolean) => {
    setIsInFullPageChat(isInChat);
  }, []);

  // Device motion detection for physical shake
  useEffect(() => {
    if (!user) return;

    let lastAcceleration = { x: 0, y: 0, z: 0 };
    let lastShakeTime = 0;
    const shakeThreshold = 18; // Acceleration threshold for shake detection
    const shakeCooldown = 1000; // Minimum time between shakes in milliseconds

    const requestDeviceMotionPermission = async () => {
      // Check if DeviceMotionEvent.requestPermission exists (iOS 13+)
      if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
        try {
          const permission = await (DeviceMotionEvent as any).requestPermission();
          if (permission !== 'granted') {
            console.log('Device motion permission denied');
            return false;
          }
        } catch (error) {
          console.log('Error requesting device motion permission:', error);
          return false;
        }
      }
      return true;
    };

    const handleDeviceMotion = (event: DeviceMotionEvent) => {
      const acceleration = event.accelerationIncludingGravity;
      if (!acceleration) return;

      const { x = 0, y = 0, z = 0 } = acceleration;
      const currentTime = Date.now();

      // Calculate acceleration change
      const deltaX = Math.abs(x - lastAcceleration.x);
      const deltaY = Math.abs(y - lastAcceleration.y);
      const deltaZ = Math.abs(z - lastAcceleration.z);

      // Check if acceleration exceeds threshold and cooldown has passed
      if ((deltaX > shakeThreshold || deltaY > shakeThreshold || deltaZ > shakeThreshold) &&
          (currentTime - lastShakeTime > shakeCooldown)) {
        lastShakeTime = currentTime;
        handleTabBarShake();
      }

      lastAcceleration = { x, y, z };
    };

    const setupDeviceMotion = async () => {
      // Check if device motion is supported
      if (!window.DeviceMotionEvent) {
        console.log('Device motion not supported');
        return;
      }

      // Request permission on iOS
      const hasPermission = await requestDeviceMotionPermission();
      if (!hasPermission) return;

      // Add event listener
      window.addEventListener('devicemotion', handleDeviceMotion, { passive: true });
    };

    setupDeviceMotion();

    // Cleanup
    return () => {
      window.removeEventListener('devicemotion', handleDeviceMotion);
    };
  }, [user, handleTabBarShake]);

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
            onConfirmActivity={handleHomeActivitySelect}
            onCloseActivities={() => setShowHomeActivities(false)}
            onOpenActivities={handleShakeClick}
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
              onConfirmActivity={handleHomeActivitySelect}
              onCloseActivities={() => setShowHomeActivities(false)}
              onOpenActivities={handleShakeClick}
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
            onConfirmActivity={handleHomeActivitySelect}
            onCloseActivities={() => setShowHomeActivities(false)}
            onOpenActivities={handleShakeClick}
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
        onComplete={async (savedAvatarUrl) => {
          if (!hasValidAvatarUrl(savedAvatarUrl)) {
            toast.error("We couldn't confirm your photo. Please try again.");
            return;
          }

          setIsCheckingAvatar(true);

          try {
            const status = await fetchProfileCompletionStatus();
            if (!status) {
              return;
            }

            applyProfileCompletionStatus(status);

            if (status.avatarMissing) {
              toast.error("We couldn't confirm your photo yet. Please try again.");
            }
          } finally {
            setIsCheckingAvatar(false);
          }
        }}
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
          activeTab === "plans" && "bg-white dark:bg-white",
          activeTab === "profile" && "bg-white dark:bg-white",
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
