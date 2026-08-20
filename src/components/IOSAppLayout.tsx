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
import { UpdatePrompt } from "./UpdatePrompt";
import { ProximityCheckInPopup } from "./ProximityCheckInPopup";
import { useAuth } from "@/contexts/AuthContext";
import { useAppUpdateCheck } from "@/hooks/useAppUpdateCheck";
import { useReviewPrompt } from "@/hooks/useReviewPrompt";
import { useCity } from "@/contexts/CityContext";
import { useActivityJoins } from "@/hooks/useActivityJoins";
import { usePrivateMessageNotifications } from "@/hooks/usePrivateMessageNotifications";
import { useProximityCheckIn } from "@/hooks/useProximityCheckIn";
import { usePaymentSuccessHandler } from "@/hooks/usePaymentSuccessHandler";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useCapacitorPushNotifications } from "@/hooks/useCapacitorPushNotifications";
import { useTotalUnreadChats } from "@/hooks/useTotalUnreadChats";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "@/lib/app-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { logPostgrestError } from "@/lib/supabaseErrorLog";
import { hasValidAvatarUrl } from "@/lib/avatar";
import { isEmailPrefixName } from "@/lib/profileName";
import { getOrderedActivities, getNextOccurrenceDate, getActivityLabel } from "@/data/activityTypes";
import { triggerConfettiWaterfall } from "@/lib/confetti";
import EventsPage from "@/pages/EventsPage";

export function IOSAppLayout() {
  const [activeTab, setActiveTab] = useState("home");
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [showJoinedConfirmation, setShowJoinedConfirmation] = useState(false);
  
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState("");
  const [showHomeActivities, setShowHomeActivities] = useState(true);
  const [isInFullPageChat, setIsInFullPageChat] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [eventsEntrySource, setEventsEntrySource] = useState<"home" | "plans">("home");
  
  // State for navigating to chat tab with a specific activity
  const [pendingChatActivity, setPendingChatActivity] = useState<{ activityType: string; city: string } | null>(null);
  const [pendingPlanActivityId, setPendingPlanActivityId] = useState<string | null>(null);
  const [pendingPrivateChatUserId, setPendingPrivateChatUserId] = useState<string | null>(null);
  
  // Track the city used for the current activity/chat (for cross-city joins)
  const [activityCity, setActivityCity] = useState<string>("");
  const [showProximityPopup, setShowProximityPopup] = useState(false);
  
  // State for pending paid activity to open after verification
  const [pendingPaidActivityId, setPendingPaidActivityId] = useState<string | null>(null);
  // Set right after creating a plan (see ProposePlanPage's navigate("/", { state })
  // call) so the Plans tab opens the swipe feed directly on the plan the user just
  // created, instead of landing back on whatever tab they created it from.
  const [pendingNewPlanId, setPendingNewPlanId] = useState<string | null>(null);
  const [duplicateActivityBlock, setDuplicateActivityBlock] = useState<{
    activityType: string;
    oldCity: string;
    newCity: string;
  } | null>(null);
  
  // State for opening subscription dropdown from navigation state
  const [openSubscriptionOnMount, setOpenSubscriptionOnMount] = useState(false);
  const [showMandatoryPhoto, setShowMandatoryPhoto] = useState(false);
  const [isCheckingAvatar, setIsCheckingAvatar] = useState(true);
  const [onboardingUserName, setOnboardingUserName] = useState<string | null>(null);
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
      .select("name, avatar_url, onboarding_completed_at")
      .eq("user_id", user.id)
      .maybeSingle();

    let resolvedProfile = profile;

    if (profileError) {
      logPostgrestError("IOSAppLayout profiles select", profileError);
    }

    if (!profileError && !resolvedProfile) {
      // Bootstrap an empty row — do NOT write name here. A truthy name would
      // make nameMissing=false and bypass the onboarding wizard in Auth.tsx.
      const { data: bootstrappedProfile, error: bootstrapError } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: user.id,
          },
          { onConflict: "user_id" }
        )
        .select("name, avatar_url, onboarding_completed_at")
        .maybeSingle();

      if (bootstrapError) {
        logPostgrestError("IOSAppLayout profiles upsert bootstrap", bootstrapError);
      } else {
        resolvedProfile = bootstrappedProfile ?? resolvedProfile;
      }
    }

    // Completeness is keyed off onboarding_completed_at (set exactly once by
    // the wizard's own save in Auth.tsx) rather than inferred from name/avatar
    // being present — see profiles migration 20260724000000 for why.
    // isEmailPrefixName is a belt-and-suspenders guard for rows that predate
    // this flag or that acquire a bad name through some other write path.
    const nameMissing = resolvedProfile !== null
      ? !resolvedProfile?.onboarding_completed_at || isEmailPrefixName(resolvedProfile.name, user.email)
      : false;
    const avatarMissing = !hasValidAvatarUrl(resolvedProfile?.avatar_url);
    const needsProfile = nameMissing || avatarMissing;

    return {
      avatarMissing,
      nameMissing,
      needsProfile,
      shouldRetry: Boolean(profileError || !resolvedProfile),
      name: resolvedProfile?.name ?? null,
    };
  }, [user]);

  const applyProfileCompletionStatus = useCallback((status: { avatarMissing: boolean; needsProfile: boolean; nameMissing: boolean; name?: string | null }) => {
    // Never block with the avatar screen if we're about to redirect to onboarding —
    // Auth.tsx wizard collects avatar as its final step.
    setShowMandatoryPhoto(!status.nameMissing && status.avatarMissing);
    if (!status.nameMissing && status.name) {
      setOnboardingUserName(status.name);
    }

    // If name is absent the user hasn't completed onboarding. Send them to
    // Auth.tsx which runs the 8-step wizard and collects name + avatar together.
    // The old guard (nameMissing && avatarMissing) was too narrow: the DB trigger
    // now sets a preset avatar_url for email signups, so avatarMissing was always
    // false for new users — they were never redirected and the wizard was bypassed.
    // Never redirect while the user is on a share landing page.
    if (status.nameMissing && !location.pathname.startsWith('/invite/')) {
      navigate("/auth");
    }
  }, [navigate, location.pathname]);
  
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
      activityId?: string;
      other_user_id?: string;
      pendingNewPlanId?: string;
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
    if (state.pendingNewPlanId) {
      setPendingNewPlanId(state.pendingNewPlanId);
      shouldClear = true;
    }
    if (state.activeTab === "home") {
      setActiveTab("home");
      shouldClear = true;
    }
    if (state.activeTab === "chat") {
      setActiveTab("chat");
      if (state.activityId) {
        setPendingPlanActivityId(state.activityId);
        setPendingPrivateChatUserId(null);
      }
      if (state.other_user_id) setPendingPrivateChatUserId(state.other_user_id);
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

  // Check for app updates and request in-app review on 3rd launch —
  // only once the user is signed in and past onboarding (Guideline 5.6.3:
  // don't prompt on first launch or during onboarding).
  const { needsUpdate } = useAppUpdateCheck();
  useReviewPrompt(!!user && !isCheckingOnboarding && !showOnboarding);

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
      let scheduledRetry = false;
      try {
        const status = await fetchProfileCompletionStatus();
        if (cancelled) return;
        if (!status) {
          return;
        }

        if (status.shouldRetry && retryCount < maxRetries) {
          retryCount++;
          scheduledRetry = true;
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
            scheduledRetry = true;
            pendingProfileCheckTimeoutRef.current = window.setTimeout(checkProfileCompletion, 450 * Math.min(retryCount, 8));
            return;
          }
        }

        applyProfileCompletionStatus(status);
      } catch (error) {
        console.log("Profile check failed:", error);
      } finally {
        // Do NOT clear the blocking spinner while a retry is pending — that
        // was the bug: it unblocked the home page render after the first
        // attempt even though the real completeness check (and the
        // nameMissing -> /auth redirect) was still running in the
        // background, letting users reach the app before the mandatory
        // profile wizard actually finished.
        if (!cancelled && !scheduledRetry) setIsCheckingAvatar(false);
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

  // Global fail-safe: never keep main app blocked indefinitely if the profile
  // completeness check hangs. Set well above the retry chain's worst case
  // (~10.5s) so it only fires for a genuinely stuck check, not normal
  // retry backoff — this used to be 3s, which fired before retries for a
  // fresh signup could finish, letting users into the app before the
  // mandatory profile wizard redirect had a chance to run.
  useEffect(() => {
    if (!user || !isCheckingAvatar) return;

    const timeoutId = window.setTimeout(() => {
      setIsCheckingAvatar(false);
    }, 15000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [user, isCheckingAvatar]);

  // + tab bar button → propose-plan page
  const handleShakeClick = () => {
    if (!user && !isLoading && !location.pathname.startsWith('/invite/')) {
      navigate("/auth");
      return;
    }

    navigate("/propose-plan");
  };

  // Shakehand circle on home screen → open activity carousel
  const handleOpenActivities = () => {
    setShowEvents(false);
    setActiveTab("home");
    setShowHomeActivities(true);
    navigate("/", { replace: true });
  };

  const { refresh: refreshUnreadCount, markAllAsRead } = useTotalUnreadChats();

  // Clear private chat state whenever the user leaves the chat tab
  useEffect(() => {
    if (activeTab !== "chat") setPendingPrivateChatUserId(null);
  }, [activeTab]);

  const handleTabChange = (tab: string) => {
    if (tab === "shake") {
      handleShakeClick();
      return;
    }
    setShowEvents(false);
    setShowHomeActivities(false);
    setActiveTab(tab);
    if (tab === "chat") {
      setTimeout(() => markAllAsRead(), 500);
    }
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

    // Block joining same activity_type in multiple cities
    if (user?.id) {
      const targetCity = cityOverride || selectedCity || "";
      const { data: existingJoins } = await supabase
        .from("activity_joins")
        .select("city")
        .eq("user_id", user.id)
        .eq("activity_type", activity)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
      const conflict = (existingJoins ?? []).find(
        (j: { city: string }) => j.city && j.city.toLowerCase() !== targetCity.toLowerCase()
      );
      if (conflict) {
        setDuplicateActivityBlock({ activityType: activity, oldCity: conflict.city, newCity: targetCity });
        return;
      }
    }

    // Set the selected activity and city
    setSelectedActivity(activity);
    const targetCity = cityOverride || selectedCity;
    setActivityCity(targetCity);

    const result = await joinActivity(activity, cityOverride);
    if (result.success) {
      // Confetti + ding are now fired inside ActivityJoinedConfirmation (phase 1)
      // Show the single confirmation modal (celebration phase → venue phase internally)
      setShowJoinedConfirmation(true);
      setShowHomeActivities(false);
    }
  }, [joinActivity, selectedCity]);

  const handleSelectActivity = async (activity: string) => {
    if (!user && !location.pathname.startsWith('/invite/')) {
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
    setPendingPrivateChatUserId(null);
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

    if (!user && !location.pathname.startsWith('/invite/')) {
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
            onConfirmActivity={handleHomeActivitySelect}
            onCloseActivities={() => setShowHomeActivities(false)}
            onOpenActivities={handleOpenActivities}

            onOpenEvents={() => openNearYou("home")}
            onUpgradeClick={() => setShowPremiumDialog(true)}
            isActivityJoined={hasUserJoined}
          />
        );
      case "plans":
        return (
          <PlansTab
            onChatViewChange={handleChatViewChange}
            pendingPaidActivityId={pendingPaidActivityId}
            onPendingPaidActivityHandled={() => setPendingPaidActivityId(null)}
            pendingNewPlanId={pendingNewPlanId}
            onPendingNewPlanHandled={() => setPendingNewPlanId(null)}
            onOpenEvents={() => openNearYou("plans")}
            onJoinActivity={handleOpenActivities}
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
              onOpenActivities={handleOpenActivities}
  
              onOpenEvents={() => openNearYou("home")}
              onUpgradeClick={() => setShowPremiumDialog(true)}
              isActivityJoined={hasUserJoined}
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
            onOpenActivities={handleOpenActivities}

            onOpenEvents={() => openNearYou("home")}
            onUpgradeClick={() => setShowPremiumDialog(true)}
            isActivityJoined={hasUserJoined}
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
    return <OnboardingScreens onComplete={completeOnboarding} userName={onboardingUserName} />;
  }

  return (
    <div className={cn("h-[100dvh] overflow-hidden bg-background flex flex-col", showEvents && "bg-white")}>
      {/* Main content area - fixed height, no scroll */}
      <main
        className={cn(
          "flex-1 overflow-hidden safe-area-top",
          activeTab === "chat" && "bg-white",
          activeTab === "plans" && "bg-white dark:bg-white",
          activeTab === "profile" && "bg-white dark:bg-white",
          showEvents && "bg-white dark:bg-white",
          !isInFullPageChat && "pb-20"
        )}
      >
        <div className="h-full overflow-hidden" style={showEvents ? { background: 'white', backgroundColor: 'white' } : undefined}>
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
                  key={activeTab === "chat" ? "chat-active" : "chat-inactive"}
                  onChatViewChange={handleChatViewChange}
                  pendingActivity={pendingChatActivity}
                  onPendingActivityHandled={() => setPendingChatActivity(null)}
                  pendingPlanActivityId={pendingPlanActivityId}
                  onPendingPlanActivityHandled={() => setPendingPlanActivityId(null)}
                  pendingPrivateChatUserId={pendingPrivateChatUserId}
                  onPendingPrivateChatHandled={() => setPendingPrivateChatUserId(null)}
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
        onGoToPlans={() => setActiveTab("plans")}
      />


      <PremiumDialog
        open={showPremiumDialog}
        onOpenChange={setShowPremiumDialog}
      />

      {/* Duplicate-activity block modal */}
      {duplicateActivityBlock && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 pointer-events-auto">
          <div
            className="absolute inset-0 pointer-events-auto"
            style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
            onClick={() => setDuplicateActivityBlock(null)}
          />
          <div
            className="relative z-10 w-full max-w-sm pointer-events-auto px-6 py-7 flex flex-col gap-4"
            style={{
              background: "rgba(255,255,255,0.55)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.4)",
              borderRadius: "24px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            }}
          >
            <div className="text-center space-y-2">
              <p className="text-xl font-bold text-gray-900">Hold on Tiger! 🐯</p>
              <p className="text-sm text-gray-600 leading-relaxed">
                You're already joined for{" "}
                <span className="font-semibold">{duplicateActivityBlock.activityType}</span>{" "}
                in <span className="font-semibold">{duplicateActivityBlock.oldCity}</span>. Leave that one first before joining in{" "}
                <span className="font-semibold">{duplicateActivityBlock.newCity}</span>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDuplicateActivityBlock(null)}
              className="w-full h-11 rounded-full font-semibold text-base transition-all hover:opacity-90 active:scale-95"
              style={{
                background: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(0,0,0,0.12)",
                color: "#1a1a1a",
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* App update prompt — non-dismissable, shown when remote version > installed */}
      <UpdatePrompt visible={needsUpdate} />

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
