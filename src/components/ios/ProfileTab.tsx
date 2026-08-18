import { useState, useEffect, useCallback, type CSSProperties } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { User, LogOut, Settings, Video, CreditCard, Share2, Copy, Check, Globe, Wallet, ExternalLink, Loader2, Mail, Trash2, DollarSign, Shield, Clock, CheckCircle, XCircle, Ghost, ScanFace, Sun, Smartphone, Bell, ChevronRight, Instagram, Lock, FileText, AlertTriangle, Users } from "lucide-react";
import { ManageFriendsDialog } from "@/components/ManageFriendsDialog";
import { useFriends } from "@/hooks/useFriends";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PremiumDialog } from "../PremiumDialog";
import { ManagePlanDialog } from "../ManagePlanDialog";
import { UserProfileDialog } from "../UserProfileDialog";
import { useStatusVideo } from "@/hooks/useStatusVideo";
import { StatusVideoRecorder } from "../StatusVideoRecorder";
import { cn, getPriceValue } from "@/lib/utils";
import { PointsDashboard } from "../PointsDashboard";
import { useUserPoints } from "@/hooks/useUserPoints";
import { useReferralCode, getReferralLink } from "@/hooks/useReferralCode";
import { useStripeConnect } from "@/hooks/useStripeConnect";
import { toast } from "@/hooks/use-toast";
import shakeCoin from "@/assets/shake-coin-transparent.png";
import supermanImg from "@/assets/superhuman-superman.png";
import { LanguageSelector } from "../LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "react-i18next";
import { useCreatorEarnings } from "@/hooks/useCreatorEarnings";
import { useCreatorVerification } from "@/hooks/useCreatorVerification";
import { IDVerificationDialog } from "../IDVerificationDialog";
import { ContactSupport } from "../ContactSupport";
import { logPostgrestError } from "@/lib/supabaseErrorLog";
import { useSettlingGradient } from "@/hooks/useSettlingGradient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getDisplayAvatarUrl } from "@/lib/avatar";
import { FaceCaptureModal } from "@/components/FaceCaptureModal";
import { storeFaceDescriptor } from "@/services/faceAuthService";

interface ProfileTabProps {
  onSignOut?: () => void;
  initialOpenSubscription?: boolean;
  onSubscriptionOpened?: () => void;
}

// Temporary rollout flag: keep implementation in codebase but hide from users.
const FACE_ID_FEATURE_ENABLED = false;

export function ProfileTab({ onSignOut, initialOpenSubscription, onSubscriptionOpened }: ProfileTabProps) {
  const { t } = useTranslation();
  const { user, isPremium, isManualOverride, signOut } = useAuth();
  const { pendingReceived } = useFriends();
  const isNative = Capacitor.isNativePlatform();
  // Teal/blue gradient matching the nav + button, with a 1.5s teal sweep on open.
  const { style: profileIconGradientStyle } = useSettlingGradient("profile", {
    fixedSettled: "linear-gradient(135deg, #00C6B6, #7c3aed)",
    animationGradient: "linear-gradient(270deg, #00C6B6, #7c3aed, #06b6d4, #38bdf8, #00C6B6)",
    settleDelayMs: 1500,
  });
  // The Premium upgrade banner keeps its own orange gradient (intentional brand colour).
  const premiumBannerStyle: CSSProperties = {
    background: "linear-gradient(135deg, #f97316, #ec4899)",
  };
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showStatusRecorder, setShowStatusRecorder] = useState(false);
  const [showPointsDialog, setShowPointsDialog] = useState(false);
  const [appVersionLabel, setAppVersionLabel] = useState<string | null>(null);
  const [showSubscriptionDropdown, setShowSubscriptionDropdown] = useState(false);
  const { statusVideo, hasActiveStatus, refetch: refetchStatus, deleteVideo: deleteStatusVideo } = useStatusVideo(user?.id);
  const { points } = useUserPoints(user?.id);
  const { referralCode } = useReferralCode(user?.id);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showReferralLink, setShowReferralLink] = useState(false);
  const [showPayoutOptions, setShowPayoutOptions] = useState(false);
  const [preferredMethod, setPreferredMethod] = useState<string | null>(null);
  const [showManagePlanDialog, setShowManagePlanDialog] = useState(false);
  const { isConnected: stripeConnected, status: stripeStatus, isLoading: stripeLoading, startOnboarding: startStripeOnboarding } = useStripeConnect();

  // Saved = persisted DB value (drives checkmark + collapsed view)
  // Input = current text-field value while editing
  // Editing = whether the input is expanded
  const [savedPaypal, setSavedPaypal] = useState("");
  const [paypalInput, setPaypalInput] = useState("");
  const [editingPaypal, setEditingPaypal] = useState(true);
  const [savedVenmo, setSavedVenmo] = useState("");
  const [venmoInput, setVenmoInput] = useState("");
  const [editingVenmo, setEditingVenmo] = useState(true);
  const [savedCashApp, setSavedCashApp] = useState("");
  const [cashAppInput, setCashAppInput] = useState("");
  const [editingCashApp, setEditingCashApp] = useState(true);
  const [payoutSaving, setPayoutSaving] = useState<string | null>(null);
  const { totalNet, currency, activities, isLoading: earningsLoading } = useCreatorEarnings();
  const { isVerified, isPending, isRejected, isLoading: verificationLoading } = useCreatorVerification();
  const [showIDVerificationDialog, setShowIDVerificationDialog] = useState(false);
  const [showParanormal, setShowParanormal] = useState(false);
  const [showManageFriends, setShowManageFriends] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<{ user_id: string; name: string; avatar_url: string | null }[]>([]);
  const [isLoadingParanormal, setIsLoadingParanormal] = useState(false);
  const [faceAuthEnabled, setFaceAuthEnabled] = useState(false);
  const [gender, setGender] = useState<string | null>(null);
  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [isUpdatingFaceAuth, setIsUpdatingFaceAuth] = useState(false);
  const [showRemoveFaceConfirm, setShowRemoveFaceConfirm] = useState(false);
  const [motionPermission, setMotionPermission] = useState<"granted" | "prompt">(
    () => (localStorage.getItem("shake_motion_permission") === "granted" ? "granted" : "prompt")
  );

  const handleRequestMotionPermission = useCallback(async () => {
    if (typeof (DeviceMotionEvent as any).requestPermission === "function") {
      try {
        const result = await (DeviceMotionEvent as any).requestPermission();
        if (result === "granted") {
          localStorage.setItem("shake_motion_permission", "granted");
          setMotionPermission("granted");
        }
      } catch (err) {
        console.log("Motion permission request failed:", err);
      }
    } else {
      localStorage.setItem("shake_motion_permission", "granted");
      setMotionPermission("granted");
    }
  }, []);

  const handleOpenManagePlan = () => {
    setShowSubscriptionDropdown(false);
    setShowManagePlanDialog(true);
  };

  const handleCopyReferralLink = async () => {
    const link = getReferralLink(referralCode);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      toast({
        title: t('profile.linkCopied'),
        description: t('profile.shareText', 'Share it with friends to earn points'),
      });
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast({
        title: t('profile.failedToCopy', 'Failed to copy'),
        description: t('profile.tryAgain', 'Please try again.'),
        variant: "destructive",
      });
    }
  };

  const handleShareReferralLink = async () => {
    const link = getReferralLink(referralCode);
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('profile.shareTitle', 'Join SHAKE!'),
          text: t('profile.shareText', 'Join me on SHAKE to find fun activities and meet new people!'),
          url: link,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          handleCopyReferralLink();
        }
      }
    } else {
      handleCopyReferralLink();
    }
  };

  const handleFaceEnrollSuccess = async (descriptor?: Float32Array) => {
    if (!user) return;
    if (!descriptor) {
      toast({
        title: t('profile.faceSetupFailedTitle', 'Face setup failed'),
        description: t('profile.tryAgain', 'Please try again.'),
        variant: "destructive",
      });
      setShowFaceCapture(false);
      return;
    }
    setIsUpdatingFaceAuth(true);
    try {
      await storeFaceDescriptor(user.id, descriptor);
      const { error } = await supabase
        .from("profiles")
        .update({ face_auth_enabled: true })
        .eq("user_id", user.id);
      if (error) throw error;
      setFaceAuthEnabled(true);
      toast({
        title: t('profile.faceIdEnabledTitle', 'Face ID enabled'),
        description: t('profile.faceIdEnabledDesc', 'You can now sign in with Face ID.'),
      });
    } catch (error) {
      console.error("Error enabling Face ID:", error);
      toast({
        title: t('profile.faceIdEnableFailedTitle', 'Failed to enable Face ID'),
        description: t('profile.tryAgain', 'Please try again.'),
        variant: "destructive",
      });
    } finally {
      setIsUpdatingFaceAuth(false);
      setShowFaceCapture(false);
    }
  };

  const handleRemoveFaceId = async () => {
    if (!user) return;
    setIsUpdatingFaceAuth(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ face_descriptor: null, face_auth_enabled: false })
        .eq("user_id", user.id);
      if (error) throw error;
      setFaceAuthEnabled(false);
      setShowRemoveFaceConfirm(false);
      toast({
        title: t('profile.faceIdRemovedTitle', 'Face ID removed'),
        description: t('profile.faceIdRemovedDesc', 'Face login has been disabled.'),
      });
    } catch (error) {
      console.error("Error removing Face ID:", error);
      toast({
        title: t('profile.faceIdRemoveFailedTitle', 'Failed to remove Face ID'),
        description: t('profile.tryAgain', 'Please try again.'),
        variant: "destructive",
      });
    } finally {
      setIsUpdatingFaceAuth(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      await supabase.rpc('delete_account');
    } catch (err) {
      console.error('Delete account error:', err);
      toast({
        title: t('profile.errorTitle', 'Error'),
        description: t('profile.deleteAccountError'),
        variant: 'destructive',
      });
      return;
    }
    setShowDeleteConfirm(false);
    await signOut();
    onSignOut?.();
  };

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const [publicProfile, privateProfile] = await Promise.all([
      supabase
        .from("profiles")
        .select("avatar_url, name, face_auth_enabled, payout_paypal, payout_venmo, payout_cashapp, gender")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("profiles_private")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle()
    ]);
    if (publicProfile.data) {
      setAvatarUrl(publicProfile.data.avatar_url);
      setUserName(publicProfile.data.name);
      setFaceAuthEnabled(Boolean(publicProfile.data.face_auth_enabled));
      setGender((publicProfile.data as any).gender ?? null);
      const pp = publicProfile.data.payout_paypal ?? "";
      setSavedPaypal(pp); setEditingPaypal(!pp);
      const vm = publicProfile.data.payout_venmo ?? "";
      setSavedVenmo(vm); setEditingVenmo(!vm);
      const ca = publicProfile.data.payout_cashapp ?? "";
      setSavedCashApp(ca); setEditingCashApp(!ca);
    }
    if (privateProfile.error) {
      logPostgrestError("ProfileTab profiles_private select", privateProfile.error);
    }
    if (privateProfile.data) {
      setPreferredMethod(privateProfile.data.preferred_payout_method ?? null);
    }
  }, [user]);

  const savePayoutField = async (field: string, value: string) => {
    if (!user) return;
    setPayoutSaving(field);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ [field]: value.trim() || null })
        .eq("user_id", user.id);
      if (error) throw error;
      toast({ title: t('profile.payoutSaved', 'Payout method saved') });
    } catch (err) {
      toast({ title: t('profile.errorTitle', 'Error'), description: String(err), variant: "destructive" });
    } finally {
      setPayoutSaving(null);
    }
  };

  const fetchBlockedUsers = useCallback(async () => {
    if (!user) return;
    setIsLoadingParanormal(true);
    try {
      const { data: blocks, error } = await supabase
        .from("user_blocks")
        .select("blocked_id")
        .eq("blocker_id", user.id);
      if (error) throw error;
      const ids = (blocks ?? []).map((b) => b.blocked_id);
      if (ids.length === 0) {
        setBlockedUsers([]);
        return;
      }
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url")
        .in("user_id", ids);
      if (profilesError) throw profilesError;
      setBlockedUsers(
        (profiles ?? []).map((p) => ({
          user_id: p.user_id,
          name: p.name ?? "Shaker",
          avatar_url: p.avatar_url ?? null,
        }))
      );
    } catch (error) {
      console.error("Error fetching blocked users:", error);
    } finally {
      setIsLoadingParanormal(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    App.getInfo()
      .then((info) => setAppVersionLabel(`v${info.version} (${info.build})`))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (showParanormal) {
      fetchBlockedUsers();
    }
  }, [showParanormal, fetchBlockedUsers]);

  useEffect(() => {
    const onFocus = () => fetchProfile();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchProfile]);

  useEffect(() => {
    if (initialOpenSubscription && isPremium) {
      setShowSubscriptionDropdown(true);
      onSubscriptionOpened?.();
    }
  }, [initialOpenSubscription, isPremium, onSubscriptionOpened]);

  if (!user) {
    return null;
  }

  const handleSignOutClick = () => {
    setShowSignOutConfirm(true);
  };

  const handleConfirmSignOut = async () => {
    setAvatarUrl(null);
    setUserName(null);
    await signOut();
    setShowSignOutConfirm(false);
    onSignOut?.();
  };

  return (
    <div className="flex flex-col h-full min-h-0 pt-[env(safe-area-inset-top,0px)] overflow-y-auto pb-[env(safe-area-inset-bottom,0px)] bg-[#F2F2F7] text-gray-900">

      {/* Profile Header */}
      <button
        onClick={() => setShowProfileDialog(true)}
        className="flex flex-col items-center px-6 py-8 bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors"
      >
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center border-2 border-gray-200">
            <Avatar className="w-full h-full rounded-2xl">
              <AvatarImage
                src={getDisplayAvatarUrl(avatarUrl ?? undefined)}
                alt=""
                className="w-full h-full object-cover"
              />
              <AvatarFallback className="bg-gray-100">
                <User className="w-12 h-12 text-gray-400" />
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        <h2 className="mt-4 text-xl font-display font-bold text-gray-900">{userName || t('profile.userFallback', 'User')}</h2>
      </button>

      {/* ── Payout warning banner ──────────────────────────────────────────
           Shows ONLY when:
             (a) user has ≥1 active paid plan (activities.length > 0 from
                 useCreatorEarnings — fetches user_activities where price_amount
                 is NOT NULL), AND
             (b) no payout method is saved (savedPaypal, savedVenmo, savedCashApp
                 all empty — the same fields shown in the Creator Payouts section).
           Tapping opens the Creator Payouts section in-page. */}
      {!earningsLoading && activities.some(a => getPriceValue(a.priceAmount) > 0) &&
       !stripeConnected && (
        <button
          type="button"
          onClick={() => setShowPayoutOptions(true)}
          className="w-full flex items-start gap-3 px-4 py-3 bg-amber-50 border-b border-amber-200 text-left"
        >
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">{t('profile.payoutInfoMissing')}</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {t('profile.payoutInfoMissingDesc')}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        </button>
      )}

      {/* ── Gender warning banner ────────────────────────────────────────────
           Shows when gender hasn't been set yet. Needed so "women only" plan
           filters (creating them, and being let into ones other women made)
           actually work for this person. Tapping jumps straight to the gender
           picker inside Edit Profile. */}
      {gender === null && (
        <button
          type="button"
          onClick={() => navigate("/profile", { state: { focusGender: true } })}
          className="w-full flex items-start gap-3 px-4 py-3 bg-amber-50 border-b border-amber-200 text-left"
        >
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">{t('profile.genderInfoMissing')}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        </button>
      )}

      {/* Sections */}
      <div className="flex-1 px-4 py-6 space-y-6">

        {/* ── ACCOUNT ── */}
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-400 px-1 mb-2">{t('profile.sectionAccount')}</p>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
            {/* Edit Profile */}
            <button
              onClick={() => navigate("/profile")}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={profileIconGradientStyle}>
                <Settings className="w-5 h-5 text-white" />
              </div>
              <span className="flex-1 text-sm font-medium text-gray-900">{t('profile.editProfile')}</span>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
            {/* Language */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={profileIconGradientStyle}>
                <Globe className="w-5 h-5 text-white" />
              </div>
              <span className="flex-1 text-sm font-medium text-gray-900">{t('profile.language', 'Language')}</span>
              <LanguageSelector showLabel={false} />
            </div>
          </div>
        </div>

        {/* ── SHAKERS ── */}
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-400 px-1 mb-2">{t('profile.sectionShakers', 'Shakers')}</p>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
            {/* My Friends */}
            <button
              onClick={() => setShowManageFriends(true)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="relative w-9 h-9 rounded-xl flex items-center justify-center" style={profileIconGradientStyle}>
                <Users className="w-5 h-5 text-white" />
                {pendingReceived.length > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-600 shadow-sm ring-2 ring-white"
                    aria-label="Pending friend requests"
                  />
                )}
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900">{t('shakers.manageFriends', 'My Friends')}</span>
                <p className="text-xs text-gray-400">{t('shakers.manageFriendsDesc', 'See, add, and unshake friends')}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
            {/* Paranormal Activity — blocked users, whether from nearby shakers or friends */}
            <button
              onClick={() => setShowParanormal(true)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={profileIconGradientStyle}>
                <Ghost className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900">{t('profile.paranormalActivityTitle', 'Paranormal Activity')}</span>
                <p className="text-xs text-gray-400">{t('profile.paranormalSubtitle', 'Blocked & flagged users')}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
          </div>
        </div>

        {/* ── PLAN & REWARDS ── */}
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-400 px-1 mb-2">{t('profile.sectionPlanRewards')}</p>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
            {/* Subscription */}
            {/* MONETIZATION BYPASS (2026-06): IAP removed; Stripe web billing coming.
                Hide the Manage Subscription row (routes to iOS native subscription
                screen that shows nothing) and the Upgrade row (paywall disabled).
                Restore this block when Stripe gate is wired — just remove the
                outer {false && ( ... )} wrapper. */}
            {false && (
              isPremium ? (
                <>
                  <button
                    onClick={() => setShowSubscriptionDropdown(!showSubscriptionDropdown)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-shake-green/10 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-shake-green" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900">{t('profile.manageSubscription')}</span>
                      <p className="text-xs text-gray-400">{t('profile.superHuman')} active</p>
                    </div>
                    <ChevronRight className={cn("w-4 h-4 text-gray-300 transition-transform", showSubscriptionDropdown && "rotate-90")} />
                  </button>
                  {showSubscriptionDropdown && (
                    <div className="px-4 py-4 bg-gray-50 animate-fade-in space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-shake-yellow">{t('profile.superHumanActive', 'Super-Human Active')}</span>
                      </div>
                      <button
                        onClick={handleOpenManagePlan}
                        className="w-full py-2 text-sm font-medium text-shake-green border border-shake-green/30 rounded-2xl hover:bg-shake-green/10 transition-colors"
                      >
                        {t('profile.managePlan', 'Manage Plan')}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={() => setShowPremiumDialog(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden">
                    <img src={shakeCoin} alt="Premium" className="w-7 object-contain" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900">{t('profile.upgradeToPremium', 'Upgrade to Premium')}</span>
                    <p className="text-xs text-gray-400">{t('profile.unlimitedMessages', 'Unlimited messages & more')}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </button>
              )
            )}

            {/* My Points */}
            <button
              onClick={() => setShowPointsDialog(!showPointsDialog)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={profileIconGradientStyle}>
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900">{t('profile.myPoints')}</span>
                <p className="text-xs text-gray-400">{t('profile.pointsEarned', { count: points.toLocaleString() })}</p>
              </div>
              <ChevronRight className={cn("w-4 h-4 text-gray-300 transition-transform", showPointsDialog && "rotate-90")} />
            </button>
            {showPointsDialog && (
              <div className="px-4 py-4 bg-gray-50 animate-fade-in">
                <PointsDashboard userId={user?.id} />
              </div>
            )}

            {/* Creator Payouts */}
            <button
              onClick={() => setShowPayoutOptions(!showPayoutOptions)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={profileIconGradientStyle}>
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900">{t('profile.creatorPayouts', 'Creator Payouts')}</span>
                <p className="text-xs text-gray-400">
                  {(savedPaypal || savedVenmo || savedCashApp)
                    ? t('profile.payoutsConnected', 'Ready to receive payments')
                    : t('profile.payoutsNotConnected', 'Set up to receive payments')}
                </p>
              </div>
              {(savedPaypal || savedVenmo || savedCashApp) && (
                <div className="w-2 h-2 rounded-full bg-shake-green mr-1" />
              )}
              <ChevronRight className={cn("w-4 h-4 text-gray-300 transition-transform", showPayoutOptions && "rotate-90")} />
            </button>
            {showPayoutOptions && (
              <div className="px-4 pb-4 pt-3 bg-gray-50 animate-fade-in space-y-4">
                {/* Earnings Summary */}
                <div className="border rounded-2xl p-3 bg-gradient-to-r from-shake-yellow/10 to-shake-green/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-shake-green" />
                      <span className="text-sm font-medium">{t('profile.yourEarnings', 'Your Earnings')}</span>
                    </div>
                    <span className="text-xs text-gray-400">{new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(totalNet || 0)}</span>
                  </div>
                  {earningsLoading ? (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    </div>
                  ) : activities.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-end justify-between">
                        <span className="text-2xl font-bold text-shake-green">
                          {currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency === "BRL" ? "R$" : "$"}
                          {totalNet.toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-400">{currency}</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        {t('profile.fromPaidActivities', 'From {{count}} paid activities', { count: activities.length })}
                      </p>
                      {activities.some(a => a.participants > 0) && (
                        <div className="text-xs text-gray-400 border-t border-gray-200 pt-2 mt-2">
                          {activities.filter(a => a.participants > 0).map(a => (
                            <div key={a.activityId} className="flex justify-between py-0.5">
                              <span>{a.activityType} ({a.participants} {t('profile.participants', 'participants')})</span>
                              <span className="text-shake-green">{a.currency === "USD" ? "$" : a.currency === "EUR" ? "€" : a.currency === "GBP" ? "£" : "$"}{a.netAmount.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">{t('profile.noEarningsYet', 'Create paid activities to start earning!')}</p>
                  )}
                </div>

                {/* ID Verification — hidden for now (paid-activity ID requirement is
                    also disabled via ID_VERIFICATION_ENABLED in ProposePlanPage.tsx
                    and CreateActivityDialog.tsx), so this status card has nothing
                    left to gate and would just be confusing to show. */}
                {false && (
                <button
                  onClick={() => setShowIDVerificationDialog(true)}
                  className={cn(
                    "w-full border rounded-2xl p-3 text-left transition-colors hover:bg-muted/30",
                    isVerified
                      ? "border-shake-green/30 bg-shake-green/5"
                      : isPending
                        ? "border-amber-500/30 bg-amber-500/5"
                        : isRejected
                          ? "border-destructive/30 bg-destructive/5"
                          : "border-border"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-6 h-6 rounded-xl flex items-center justify-center",
                        isVerified ? "bg-shake-green/20" : isPending ? "bg-amber-500/20" : isRejected ? "bg-destructive/20" : "bg-primary/10"
                      )}>
                        {isVerified ? <CheckCircle className="w-4 h-4 text-shake-green" />
                          : isPending ? <Clock className="w-4 h-4 text-amber-500" />
                          : isRejected ? <XCircle className="w-4 h-4 text-destructive" />
                          : <Shield className="w-4 h-4 text-primary" />}
                      </div>
                      <span className="text-sm font-medium">{t('profile.idVerification', 'ID Verification')}</span>
                    </div>
                    {verificationLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    ) : isVerified ? (
                      <span className="text-xs text-shake-green bg-shake-green/10 px-2 py-0.5 rounded-full">{t('profile.verified', 'Verified')}</span>
                    ) : isPending ? (
                      <span className="text-xs text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">{t('profile.pending', 'Pending')}</span>
                    ) : isRejected ? (
                      <span className="text-xs text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">{t('profile.rejected', 'Rejected')}</span>
                    ) : (
                      <span className="text-xs text-gray-400">{t('profile.notVerified', 'Not verified')}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1 ml-8">
                    {isVerified
                      ? t('profile.idVerifiedDesc', 'You can create paid activities')
                      : isPending
                        ? t('profile.idPendingDesc', 'Under review - usually within 1 hour')
                        : isRejected
                          ? t('profile.idRejectedDesc', 'Please resubmit your ID')
                          : t('profile.idRequiredDesc', 'Required to create paid activities')}
                  </p>
                </button>
                )}

                <p className="text-xs text-black mb-1">
                  {stripeConnected
                    ? t('profile.payoutNote', "Add at least one method so we can send your earnings.")
                    : t('profile.payoutNoteStripeOnly', "Connect Stripe below — it's the only payout method for now. We'll add more (including crypto) soon.")}
                </p>

                {/* PayPal — hidden for now, moving toward Stripe as the primary payout method */}
                {false && (
                <div className={`border rounded-2xl p-3 space-y-2 ${savedPaypal ? "border-shake-green bg-shake-green/5" : "border-border"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-[#0070BA] rounded-xl flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold">PP</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium">PayPal</span>
                        <p className="text-[10px] text-gray-400">~2.9% + $0.30 per payout</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {savedPaypal && <Check className="w-4 h-4 text-shake-green" />}
                      {savedPaypal && !editingPaypal && (
                        <button onClick={() => { setPaypalInput(savedPaypal); setEditingPaypal(true); }}
                                className="text-xs text-gray-500 underline">{t('profile.edit', 'Edit')}</button>
                      )}
                    </div>
                  </div>
                  {savedPaypal && !editingPaypal ? (
                    <p className="text-xs text-gray-600 px-1">{savedPaypal}</p>
                  ) : (
                    <>
                      <input
                        type="email"
                        value={paypalInput}
                        onChange={e => setPaypalInput(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white outline-none focus:border-[#0070BA]"
                      />
                      <button
                        onClick={async () => {
                          if (!user) return;
                          setPayoutSaving("payout_paypal");
                          try {
                            const { error } = await supabase.from("profiles").update({ payout_paypal: paypalInput.trim() || null }).eq("user_id", user.id);
                            if (error) throw error;
                            setSavedPaypal(paypalInput.trim());
                            setPaypalInput("");
                            setEditingPaypal(false);
                            toast({ title: t('profile.payoutSaved', 'Payout method saved') });
                          } catch (err) {
                            toast({ title: t('profile.errorTitle', 'Error'), description: String(err), variant: "destructive" });
                          } finally {
                            setPayoutSaving(null);
                          }
                        }}
                        disabled={payoutSaving === "payout_paypal"}
                        className="w-full py-2 text-xs font-medium text-[#0070BA] border border-[#0070BA]/30 rounded-2xl hover:bg-[#0070BA]/10 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {payoutSaving === "payout_paypal" ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        {t('profile.save', 'Save')}
                      </button>
                    </>
                  )}
                </div>
                )}

                {/* Venmo — hidden for now, Stripe is the sole active payout method until crypto options are added */}
                {false && (
                <div className={`border rounded-2xl p-3 space-y-2 ${savedVenmo ? "border-shake-green bg-shake-green/5" : "border-border"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-[#3D95CE] rounded-xl flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold">V</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium">Venmo</span>
                        <p className="text-[10px] text-gray-400">Free (standard) · 1.75% for instant transfer</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {savedVenmo && <Check className="w-4 h-4 text-shake-green" />}
                      {savedVenmo && !editingVenmo && (
                        <button onClick={() => { setVenmoInput(savedVenmo); setEditingVenmo(true); }}
                                className="text-xs text-gray-500 underline">{t('profile.edit', 'Edit')}</button>
                      )}
                    </div>
                  </div>
                  {savedVenmo && !editingVenmo ? (
                    <p className="text-xs text-gray-600 px-1">{savedVenmo}</p>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={venmoInput}
                        onChange={e => setVenmoInput(e.target.value)}
                        placeholder="@username"
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white outline-none focus:border-[#3D95CE]"
                      />
                      <button
                        onClick={async () => {
                          if (!user) return;
                          setPayoutSaving("payout_venmo");
                          try {
                            const { error } = await supabase.from("profiles").update({ payout_venmo: venmoInput.trim() || null }).eq("user_id", user.id);
                            if (error) throw error;
                            setSavedVenmo(venmoInput.trim());
                            setVenmoInput("");
                            setEditingVenmo(false);
                            toast({ title: t('profile.payoutSaved', 'Payout method saved') });
                            const notifyName = userName || user.email || user.id;
                            supabase.functions.invoke("send-admin-notification", {
                              body: { subject: "SHAKE: Payout method connected", body: `${notifyName} set up Venmo as a payout method.` },
                            }).catch(() => {});
                          } catch (err) {
                            toast({ title: t('profile.errorTitle', 'Error'), description: String(err), variant: "destructive" });
                          } finally {
                            setPayoutSaving(null);
                          }
                        }}
                        disabled={payoutSaving === "payout_venmo"}
                        className="w-full py-2 text-xs font-medium text-[#3D95CE] border border-[#3D95CE]/30 rounded-2xl hover:bg-[#3D95CE]/10 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {payoutSaving === "payout_venmo" ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        {t('profile.save', 'Save')}
                      </button>
                    </>
                  )}
                </div>
                )}

                {/* Stripe */}
                <div className={`border rounded-2xl p-3 space-y-2 ${stripeConnected ? "border-shake-green bg-shake-green/5" : "border-border"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-[#635BFF] rounded-xl flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold">S</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium">Stripe</span>
                        <p className="text-[10px] text-gray-400">~2.9% + $0.30 per transaction</p>
                      </div>
                    </div>
                    {stripeConnected && stripeStatus === "complete" && <Check className="w-4 h-4 text-shake-green" />}
                  </div>
                  {stripeConnected && stripeStatus === "complete" ? (
                    <p className="text-xs text-gray-600 px-1">
                      {t('profile.stripeConnected', 'Connected')}
                    </p>
                  ) : (
                    <>
                      {stripeConnected && (
                        <p className="text-xs text-gray-600 px-1">
                          {t('profile.stripePending', 'A few details are still needed to finish setup.')}
                        </p>
                      )}
                      <button
                        onClick={() => startStripeOnboarding()}
                        disabled={stripeLoading}
                        className="w-full py-2 text-xs font-medium text-[#635BFF] border border-[#635BFF]/30 rounded-2xl hover:bg-[#635BFF]/10 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {stripeLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        {stripeConnected ? t('profile.finishStripeSetup', 'Finish Setup') : t('profile.connectStripe', 'Connect Stripe')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── SOCIAL ── */}
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-400 px-1 mb-2">{t('profile.sectionSocial')}</p>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
            {/* Follow on Instagram */}
            <button
              onClick={() => window.open('https://www.instagram.com/shakeapp.inc/', '_blank')}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
                <Instagram className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900">{t('profile.followInstagram')}</span>
                <p className="text-xs text-gray-400">@shakeapp.inc</p>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-300" />
            </button>
            {/* Share Shake */}
            <button
              onClick={() => setShowReferralLink(!showReferralLink)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={profileIconGradientStyle}>
                <Share2 className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900">{t('profile.shareShake')}</span>
                <p className="text-xs text-gray-400">{t('profile.earnPoints', 'Earn +5 points per signup')}</p>
              </div>
              <ChevronRight className={cn("w-4 h-4 text-gray-300 transition-transform", showReferralLink && "rotate-90")} />
            </button>
            {showReferralLink && (
              <div className="px-4 py-3 bg-gray-50 animate-fade-in space-y-3">
                {/* General app share */}
                <button
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: 'SHAKE',
                        text: t('profile.shareText', 'Join me on SHAKE to find fun activities and meet new people!'),
                        url: 'https://shakeapp.today',
                      }).catch(() => {});
                    } else {
                      navigator.clipboard.writeText('https://shakeapp.today').then(() => {
                        toast({ title: t('profile.linkCopied', 'Link copied!') });
                      });
                    }
                  }}
                  className="w-full py-2 text-sm font-medium text-primary border border-primary/30 rounded-2xl hover:bg-primary/10 transition-colors flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  {t('profile.shareApp')}
                </button>
                {/* Referral link */}
                {referralCode && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1.5">{t('profile.shareReferral', 'Your referral link')}</p>
                    <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-2xl px-3 py-2">
                      <span className="flex-1 text-xs text-gray-500 truncate">{getReferralLink(referralCode)}</span>
                      <button
                        onClick={handleCopyReferralLink}
                        className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors"
                        title="Copy link"
                      >
                        {copiedLink ? <Check className="w-4 h-4 text-shake-green" /> : <Copy className="w-4 h-4 text-gray-400" />}
                      </button>
                      <button
                        onClick={handleShareReferralLink}
                        className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors"
                        title="Share link"
                      >
                        <Share2 className="w-4 h-4 text-primary" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── SETTINGS ── */}
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-400 px-1 mb-2">{t('profile.sectionSettings')}</p>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
            {/* Appearance */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={profileIconGradientStyle}>
                <Sun className="w-5 h-5 text-white" />
              </div>
              <span className="flex-1 text-sm font-medium text-gray-900">{t('profile.appearance', 'Appearance')}</span>
              <ThemeToggle />
            </div>
            {/* Motion & Shake */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={profileIconGradientStyle}>
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900">{t('profile.motionShake', 'Motion & Shake')}</span>
                <p className="text-xs text-gray-400">{t('profile.motionDesc', 'Allow shake to discover activities')}</p>
              </div>
              <Switch
                checked={motionPermission === "granted"}
                onCheckedChange={(checked) => {
                  if (checked) handleRequestMotionPermission();
                  else {
                    localStorage.setItem("shake_motion_permission", "denied");
                    setMotionPermission("prompt");
                  }
                }}
                className="data-[state=unchecked]:bg-gray-200"
              />
            </div>
            {/* Notifications — native only */}
            {isNative && (
              <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                onClick={() => window.open('app-settings:root=NOTIFICATIONS&path=com.shakeapp.shakeapp', '_system')}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={profileIconGradientStyle}>
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900">{t('profile.notifications', 'Notifications')}</span>
                  <p className="text-xs text-gray-400">{t('profile.notificationsDesc', 'Manage push notification settings')}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>
            )}
          </div>
        </div>

        {/* ── SUPPORT ── */}
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-400 px-1 mb-2">{t('profile.support')}</p>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
            {/* Contact Us */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={profileIconGradientStyle}>
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900">{t('profile.support', 'Contact Us')}</span>
                <p className="text-xs text-gray-400">{t('profile.supportDesc', 'Need help? Contact our team.')}</p>
              </div>
              <ContactSupport />
            </div>
            {/* Community Guidelines */}
            <button
              onClick={() => navigate('/community-guidelines')}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="flex-1 text-sm font-medium text-gray-900">{t('common.communityGuidelines', 'Community Guidelines')}</span>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
            {/* Privacy Policy */}
            <button
              onClick={() => navigate('/privacy-policy')}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center">
                <Lock className="w-5 h-5 text-white" />
              </div>
              <span className="flex-1 text-sm font-medium text-gray-900">{t('common.privacyPolicy', 'Privacy Policy')}</span>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
            {/* Terms of Service */}
            <button
              onClick={() => navigate('/terms-of-service')}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="flex-1 text-sm font-medium text-gray-900">{t('common.termsOfService', 'Terms of Service')}</span>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
          </div>
        </div>

        {/* ── ACCOUNT ACTIONS ── */}
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-400 px-1 mb-2">{t('profile.sectionAccountActions')}</p>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
            {/* Sign Out */}
            <button
              onClick={handleSignOutClick}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-red-500" />
              </div>
              <span className="flex-1 text-sm font-medium text-red-500">{t('common.signOut')}</span>
            </button>
            {/* Delete Account */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <span className="flex-1 text-sm font-medium text-red-500">{t('profile.deleteAccount')}</span>
            </button>
          </div>
        </div>

        {/* Copyright */}
        {appVersionLabel && (
          <p className="text-center text-[10px] text-gray-300">{appVersionLabel}</p>
        )}
        <p className="text-center text-xs text-gray-400 pb-2">
          © {new Date().getFullYear()} SHAKEapp Inc.
        </p>
      </div>

      {/* ── DIALOGS ── */}

      <ManageFriendsDialog open={showManageFriends} onOpenChange={setShowManageFriends} />

      {/* Paranormal Activity */}
      <Dialog open={showParanormal} onOpenChange={setShowParanormal}>
        <DialogContent className="max-w-md [&>button:last-child]:hidden">
          <DialogHeader>
            <DialogTitle>{t('profile.paranormalDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('profile.paranormalDialogDesc', "Blocked users won't appear in your feed or chats.")}</p>
            {isLoadingParanormal ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : blockedUsers.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {t('profile.noBlockedUsers', 'No blocked users 👻')}
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {blockedUsers.map((u) => (
                  <div key={u.user_id} className="flex items-center justify-between gap-3 py-1">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={getDisplayAvatarUrl(u.avatar_url ?? undefined)} alt={u.name} />
                        <AvatarFallback>
                          <User className="w-4 h-4 text-muted-foreground" />
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{u.name}</span>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await supabase
                            .from("user_blocks")
                            .delete()
                            .eq("blocker_id", user.id)
                            .eq("blocked_id", u.user_id);
                          setBlockedUsers((prev) => prev.filter((p) => p.user_id !== u.user_id));
                        } catch (error) {
                          console.error("Error unblocking user:", error);
                        }
                      }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {t('profile.unblock', 'Unblock')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <PremiumDialog open={showPremiumDialog} onOpenChange={setShowPremiumDialog} />

      {user && (
        <UserProfileDialog
          open={showProfileDialog}
          onOpenChange={setShowProfileDialog}
          userId={user.id}
          userName={userName}
          avatarUrl={avatarUrl}
        />
      )}

      {/* Sign Out Confirmation */}
      <AlertDialog open={showSignOutConfirm} onOpenChange={setShowSignOutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('profile.signOutTitle', 'Going antisocial? 😢')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('profile.signOutDescription', "Are you sure you want to sign out? You'll miss all the fun activities!")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('profile.staySocial', 'Stay Social')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSignOut} className="text-red-500 font-normal">
              {t('profile.signOutBtn', 'Sign Out')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('profile.deleteAccountTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('profile.deleteAccountDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status Video Recorder — hidden from UI, backend preserved */}
      {/* {user && (
        <StatusVideoRecorder
          open={showStatusRecorder}
          onOpenChange={setShowStatusRecorder}
          userId={user.id}
          existingVideoUrl={hasActiveStatus ? statusVideo?.video_url : null}
          onDeleteVideo={deleteStatusVideo}
          onVideoUploaded={() => {
            fetchProfile();
            refetchStatus();
          }}
        />
      )} */}


      {/* Face ID (hidden feature flag) */}
      {FACE_ID_FEATURE_ENABLED && (
        <AlertDialog open={showRemoveFaceConfirm} onOpenChange={setShowRemoveFaceConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('profile.removeFaceIdTitle', 'Remove Face ID?')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('profile.removeFaceIdDesc', "You'll need to use another login method until you set Face ID up again.")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isUpdatingFaceAuth}>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemoveFaceId}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isUpdatingFaceAuth ? t('profile.removeFaceIdRemoving', 'Removing...') : t('profile.faceIdRemoveBtn', 'Remove')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* ID Verification */}
      <IDVerificationDialog
        open={showIDVerificationDialog}
        onOpenChange={setShowIDVerificationDialog}
      />

      {/* Manage Plan */}
      <ManagePlanDialog
        open={showManagePlanDialog}
        onOpenChange={setShowManagePlanDialog}
      />

      {FACE_ID_FEATURE_ENABLED && (
        <FaceCaptureModal
          open={showFaceCapture}
          mode="enroll"
          onSuccess={handleFaceEnrollSuccess}
          onCancel={() => setShowFaceCapture(false)}
        />
      )}
    </div>
  );
}
