import { useState, useEffect, useCallback } from "react";
import { User, LogOut, Settings, Video, CreditCard, Share2, Copy, Check, Globe, Wallet, ExternalLink, Loader2, RefreshCw, RotateCcw, Mail, Trash2, DollarSign, Shield, Clock, CheckCircle, XCircle, Ghost, ScanFace, Sun, Smartphone, Bell, ChevronRight, Instagram, Lock, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PremiumDialog } from "../PremiumDialog";
import { ManagePlanDialog } from "../ManagePlanDialog";
import { SuperHumanIcon } from "../SuperHumanIcon";
import { UserProfileDialog } from "../UserProfileDialog";
import { useStatusVideo } from "@/hooks/useStatusVideo";
import { StatusVideoRecorder } from "../StatusVideoRecorder";
import { cn } from "@/lib/utils";
import { PointsDashboard } from "../PointsDashboard";
import { useUserPoints } from "@/hooks/useUserPoints";
import { useReferralCode, getReferralLink } from "@/hooks/useReferralCode";
import { toast } from "@/hooks/use-toast";
import shakeCoin from "@/assets/shake-coin-transparent.png";
import { LanguageSelector } from "../LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "react-i18next";
import { useStripeConnect } from "@/hooks/useStripeConnect";
import { usePayPalConnect } from "@/hooks/usePayPalConnect";
import { useCreatorEarnings } from "@/hooks/useCreatorEarnings";
import { StripeCountrySelectorDialog } from "../StripeCountrySelectorDialog";
import { PayPalConnectDialog } from "../PayPalConnectDialog";
import { useCreatorVerification } from "@/hooks/useCreatorVerification";
import { IDVerificationDialog } from "../IDVerificationDialog";
import { ContactSupport } from "../ContactSupport";
import { logPostgrestError } from "@/lib/supabaseErrorLog";
import { useSettlingGradient } from "@/hooks/useSettlingGradient";
import { Capacitor } from "@capacitor/core";
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
  const isNative = Capacitor.isNativePlatform();
  const { style: profileIconGradientStyle } = useSettlingGradient("profile");
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showStatusRecorder, setShowStatusRecorder] = useState(false);
  const [showPointsDialog, setShowPointsDialog] = useState(false);
  const [showSubscriptionDropdown, setShowSubscriptionDropdown] = useState(false);
  const { statusVideo, hasActiveStatus, refetch: refetchStatus } = useStatusVideo(user?.id);
  const { points } = useUserPoints(user?.id);
  const { referralCode } = useReferralCode(user?.id);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showReferralLink, setShowReferralLink] = useState(false);
  const [showPayoutOptions, setShowPayoutOptions] = useState(false);
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  const [showResetCountrySelector, setShowResetCountrySelector] = useState(false);
  const [showPayPalDialog, setShowPayPalDialog] = useState(false);
  const [showPayPalDisconnectConfirm, setShowPayPalDisconnectConfirm] = useState(false);
  const [preferredMethod, setPreferredMethod] = useState<string | null>(null);
  const [showManagePlanDialog, setShowManagePlanDialog] = useState(false);
  const { isConnected: stripeConnected, status: stripeStatus, email: stripeEmail, isLoading: stripeLoading, error: stripeError, startOnboarding, checkStatus: checkStripeStatus, resetAndRecreate } = useStripeConnect();
  const { isConnected: paypalConnected, paypalEmail, isLoading: paypalLoading, connectPayPal, disconnectPayPal } = usePayPalConnect();
  const { totalNet, currency, activities, isLoading: earningsLoading } = useCreatorEarnings();
  const { isVerified, isPending, isRejected, isLoading: verificationLoading } = useCreatorVerification();
  const [showIDVerificationDialog, setShowIDVerificationDialog] = useState(false);
  const [showParanormal, setShowParanormal] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<{ user_id: string; name: string; avatar_url: string | null }[]>([]);
  const [isLoadingParanormal, setIsLoadingParanormal] = useState(false);
  const [faceAuthEnabled, setFaceAuthEnabled] = useState(false);
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

  const handleStartOnboarding = (countryCode: string) => {
    setShowCountrySelector(false);
    startOnboarding(countryCode);
  };

  const handleResetAndRecreate = (countryCode: string) => {
    setShowResetCountrySelector(false);
    resetAndRecreate(countryCode);
  };

  const handleSetPreferredMethod = async (method: "stripe" | "paypal") => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles_private")
        .update({ preferred_payout_method: method })
        .eq("user_id", user.id);
      if (error) throw error;
      setPreferredMethod(method);
      toast({
        title: t('profile.payoutMethodUpdated', 'Payout method updated'),
        description: method === "stripe"
          ? t('profile.stripeIsNowActive', 'Stripe is now your active payout method')
          : t('profile.paypalIsNowActive', 'PayPal is now your active payout method'),
      });
    } catch (error) {
      console.error("Error updating preferred method:", error);
      toast({
        title: t('profile.errorTitle', 'Error'),
        description: t('profile.failedPayoutMethod', 'Failed to update payout method'),
        variant: "destructive",
      });
    }
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
        description: 'Failed to delete account. Please contact support.',
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
        .select("avatar_url, name, face_auth_enabled")
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
    }
    if (privateProfile.error) {
      logPostgrestError("ProfileTab profiles_private select", privateProfile.error);
    }
    if (privateProfile.data) {
      setPreferredMethod(privateProfile.data.preferred_payout_method ?? null);
    }
  }, [user]);

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
          name: p.name ?? "User",
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
          <div className={cn(
            "w-24 h-24 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center",
            hasActiveStatus
              ? "ring-4 ring-shake-green ring-offset-2 ring-offset-white"
              : "border-2 border-gray-200"
          )}>
            {hasActiveStatus && statusVideo ? (
              <video
                src={statusVideo.video_url}
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
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
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setShowStatusRecorder(true); }}
            className={cn(
              "absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white transition-colors",
              hasActiveStatus ? "bg-shake-green hover:bg-shake-green/90" : "bg-primary hover:bg-primary/90"
            )}
          >
            <Video className="w-4 h-4 text-white" />
          </button>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); setShowStatusRecorder(true); }}
          className="mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          {hasActiveStatus ? t('profile.viewStatus', 'View Status') : t('profile.addStatus', 'Add Status')}
        </button>

        <h2 className="mt-2 text-xl font-display font-bold text-gray-900">{userName || t('profile.userFallback', 'User')}</h2>
        {isPremium && (
          <div
            onClick={(e) => { e.stopPropagation(); setShowPremiumDialog(true); }}
            className="flex items-center gap-1.5 mt-2 px-3 py-1 bg-shake-yellow/10 rounded-full cursor-pointer hover:bg-shake-yellow/20 transition-colors"
          >
            <SuperHumanIcon size={14} />
            <span className="text-sm font-medium text-shake-yellow">{t('profile.superHuman')}</span>
          </div>
        )}
      </button>

      {/* Sections */}
      <div className="flex-1 px-4 py-6 space-y-6">

        {/* ── ACCOUNT ── */}
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-400 px-1 mb-2">Account</p>
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

        {/* ── PLAN & REWARDS ── */}
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-400 px-1 mb-2">Plan & Rewards</p>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
            {/* Subscription */}
            {isPremium ? (
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
                      <SuperHumanIcon size={16} />
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
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                style={profileIconGradientStyle}
              >
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <SuperHumanIcon size={20} />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-white">{t('profile.upgradeToPremium', 'Upgrade to Premium')}</span>
                  <p className="text-xs text-white/70">{t('profile.unlimitedMessages', 'Unlimited messages & more')}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/50" />
              </button>
            )}

            {/* My Points */}
            <button
              onClick={() => setShowPointsDialog(!showPointsDialog)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={profileIconGradientStyle}>
                <img src={shakeCoin} alt="Points" className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900">{t('profile.myPoints')}</span>
                <p className="text-xs text-gray-400">{points.toLocaleString()} {t('profile.points')} earned</p>
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
                  {(stripeConnected && stripeStatus === "complete") || paypalConnected
                    ? t('profile.payoutsConnected', 'Ready to receive payments')
                    : stripeConnected && stripeStatus === "pending"
                    ? t('profile.stripePending', 'Verification pending')
                    : t('profile.payoutsNotConnected', 'Set up to receive payments')}
                </p>
              </div>
              {((stripeConnected && stripeStatus === "complete") || paypalConnected) && (
                <div className="w-2 h-2 rounded-full bg-shake-green mr-1" />
              )}
              {stripeConnected && stripeStatus === "pending" && !paypalConnected && (
                <div className="w-2 h-2 rounded-full bg-amber-500 mr-1" />
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
                    <span className="text-xs text-gray-400">85% {t('profile.afterFee', 'after platform fee')}</span>
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

                {/* ID Verification */}
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

                {/* Connected status banner */}
                {((stripeConnected && stripeStatus === "complete") || paypalConnected) && (
                  <div className="flex items-center gap-2 p-2 bg-shake-green/10 rounded-2xl">
                    <Check className="w-4 h-4 text-shake-green" />
                    <span className="text-sm text-shake-green font-medium">{t('profile.payoutsReady', 'Ready to receive payouts')}</span>
                  </div>
                )}

                {/* Stripe */}
                <div className={`border rounded-2xl p-3 space-y-2 ${preferredMethod === "stripe" ? "border-shake-green bg-shake-green/5" : "border-border"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-[#635BFF] rounded-xl flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold">S</span>
                      </div>
                      <span className="text-sm font-medium">Stripe</span>
                      {preferredMethod === "stripe" && stripeConnected && stripeStatus === "complete" && (
                        <span className="text-[10px] text-shake-green font-medium uppercase">Active</span>
                      )}
                    </div>
                    {stripeConnected && stripeStatus === "complete" && (
                      <span className="text-xs text-shake-green bg-shake-green/10 px-2 py-0.5 rounded-full">Connected</span>
                    )}
                    {stripeConnected && (stripeStatus === "pending" || stripeStatus === "verification_pending") && (
                      <span className="text-xs text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                        {stripeStatus === "verification_pending" ? "Verifying" : "Pending"}
                      </span>
                    )}
                  </div>
                  {stripeConnected && stripeStatus === "complete" ? (
                    <>
                      {stripeEmail && (
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{stripeEmail}</span>
                        </div>
                      )}
                      {preferredMethod !== "stripe" && paypalConnected && (
                        <button
                          onClick={() => handleSetPreferredMethod("stripe")}
                          className="w-full py-2 text-xs font-medium text-[#635BFF] border border-[#635BFF]/30 rounded-2xl hover:bg-[#635BFF]/10 transition-colors"
                        >
                          {t('profile.useStripe', 'Use Stripe for payouts')}
                        </button>
                      )}
                    </>
                  ) : stripeConnected && stripeStatus === "verification_pending" ? (
                    <>
                      <p className="text-xs text-gray-400">{t('profile.stripeVerificationPending', 'Stripe is reviewing your account. This usually takes 1-3 business days.')}</p>
                      {stripeEmail && (
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{stripeEmail}</span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={checkStripeStatus}
                          disabled={stripeLoading}
                          className="flex-1 py-2 text-xs font-medium text-amber-600 border border-amber-500/30 rounded-2xl hover:bg-amber-500/10 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          {stripeLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          {t('profile.checkStatus', 'Check Status')}
                        </button>
                      </div>
                    </>
                  ) : stripeConnected && stripeStatus === "pending" ? (
                    <>
                      <p className="text-xs text-gray-400">{t('profile.stripePendingDesc', 'Complete your Stripe onboarding to receive payments.')}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { startOnboarding(); setShowPayoutOptions(false); }}
                          disabled={stripeLoading}
                          className="flex-1 py-2 text-xs font-medium text-amber-600 border border-amber-500/30 rounded-2xl hover:bg-amber-500/10 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          {stripeLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                          {t('profile.completeOnboarding', 'Complete Setup')}
                        </button>
                        <button
                          onClick={checkStripeStatus}
                          disabled={stripeLoading}
                          className="py-2 px-3 text-xs text-gray-400 border border-border rounded-2xl hover:bg-muted/50 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => { setShowPayoutOptions(false); setShowResetCountrySelector(true); }}
                          disabled={stripeLoading}
                          className="py-2 px-3 text-xs text-destructive border border-destructive/30 rounded-2xl hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-gray-400">{t('profile.stripeDesc', 'Credit/debit card payments with identity verification.')}</p>
                      <button
                        onClick={() => {
                          console.log('[Stripe] Connect button clicked', { stripeLoading, stripeConnected, stripeStatus, stripeError });
                          const result = startOnboarding();
                          if (result && typeof (result as any).then === 'function') {
                            (result as Promise<unknown>)
                              .then(r => console.log('[Stripe] startOnboarding resolved:', r))
                              .catch(e => console.error('[Stripe] startOnboarding rejected:', e));
                          } else {
                            console.log('[Stripe] startOnboarding returned (sync):', result);
                          }
                        }}
                        disabled={stripeLoading}
                        className="w-full py-2 text-xs font-medium text-[#635BFF] border border-[#635BFF]/30 rounded-2xl hover:bg-[#635BFF]/10 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {stripeLoading ? (
                          <><Loader2 className="w-3 h-3 animate-spin" />{t('profile.connecting', 'Connecting to Stripe...')}</>
                        ) : (
                          <><ExternalLink className="w-3 h-3" />{t('profile.connectStripe', 'Connect Stripe')}</>
                        )}
                      </button>
                    </>
                  )}
                </div>

                {/* PayPal */}
                <div className={`border rounded-2xl p-3 space-y-2 ${preferredMethod === "paypal" ? "border-shake-green bg-shake-green/5" : "border-border"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-[#0070BA] rounded-xl flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold">PP</span>
                      </div>
                      <span className="text-sm font-medium">PayPal</span>
                      {preferredMethod === "paypal" && paypalConnected && (
                        <span className="text-[10px] text-shake-green font-medium uppercase">Active</span>
                      )}
                    </div>
                    {paypalConnected && (
                      <span className="text-xs text-shake-green bg-shake-green/10 px-2 py-0.5 rounded-full">Connected</span>
                    )}
                  </div>
                  {paypalConnected ? (
                    <>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{paypalEmail}</span>
                      </div>
                      {preferredMethod !== "paypal" && stripeConnected && stripeStatus === "complete" && (
                        <button
                          onClick={() => handleSetPreferredMethod("paypal")}
                          className="w-full py-2 text-xs font-medium text-[#0070BA] border border-[#0070BA]/30 rounded-2xl hover:bg-[#0070BA]/10 transition-colors"
                        >
                          {t('profile.usePayPal', 'Use PayPal for payouts')}
                        </button>
                      )}
                      <button
                        onClick={() => setShowPayPalDisconnectConfirm(true)}
                        disabled={paypalLoading}
                        className="w-full py-2 text-xs font-medium text-destructive border border-destructive/30 rounded-2xl hover:bg-destructive/10 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <Trash2 className="w-3 h-3" />
                        {t('profile.disconnectPayPal', 'Disconnect PayPal')}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-gray-400">{t('profile.paypalDesc', 'Simple email-based payouts with no verification needed.')}</p>
                      <button
                        onClick={() => { setShowPayoutOptions(false); setShowPayPalDialog(true); }}
                        disabled={paypalLoading}
                        className="w-full py-2 text-xs font-medium text-[#0070BA] border border-[#0070BA]/30 rounded-2xl hover:bg-[#0070BA]/10 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {paypalLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                        {t('profile.connectPayPal', 'Connect PayPal')}
                      </button>
                    </>
                  )}
                </div>

                <p className="text-xs text-center text-gray-400">
                  {t('profile.payoutNote', "You'll receive 90% of each payment. Connect at least one method.")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── SOCIAL ── */}
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-400 px-1 mb-2">Social</p>
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
                <span className="text-sm font-medium text-gray-900">Follow us on Instagram</span>
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
                <span className="text-sm font-medium text-gray-900">Share Shake</span>
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
                  Share App
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
          <p className="text-xs uppercase tracking-wider text-gray-400 px-1 mb-2">Settings</p>
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
            {/* Paranormal Activity */}
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

        {/* ── SUPPORT ── */}
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-400 px-1 mb-2">Support</p>
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
              <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center">
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
              <div className="w-9 h-9 rounded-xl bg-gray-500 flex items-center justify-center">
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
              <div className="w-9 h-9 rounded-xl bg-gray-400 flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="flex-1 text-sm font-medium text-gray-900">{t('common.termsOfService', 'Terms of Service')}</span>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
          </div>
        </div>

        {/* ── ACCOUNT ACTIONS ── */}
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-400 px-1 mb-2">Account Actions</p>
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
              <span className="flex-1 text-sm font-medium text-red-500">Delete Account</span>
            </button>
          </div>
        </div>

        {/* Copyright */}
        <p className="text-center text-xs text-gray-400 pb-2">
          © {new Date().getFullYear()} SHAKEapp Inc.
        </p>
      </div>

      {/* ── DIALOGS ── */}

      {/* Paranormal Activity */}
      <Dialog open={showParanormal} onOpenChange={setShowParanormal}>
        <DialogContent className="max-w-md [&>button:last-child]:hidden">
          <DialogHeader>
            <DialogTitle>👻 Paranormal Activity</DialogTitle>
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
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account and all your data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status Video Recorder */}
      {user && (
        <StatusVideoRecorder
          open={showStatusRecorder}
          onOpenChange={setShowStatusRecorder}
          userId={user.id}
          existingVideoUrl={hasActiveStatus ? statusVideo?.video_url : null}
          onVideoUploaded={() => {
            fetchProfile();
            refetchStatus();
          }}
        />
      )}

      {/* Stripe Country Selector (new) */}
      <StripeCountrySelectorDialog
        open={showCountrySelector}
        onOpenChange={setShowCountrySelector}
        onSelectCountry={handleStartOnboarding}
        isLoading={stripeLoading}
        isReset={false}
      />

      {/* Stripe Country Selector (reset) */}
      <StripeCountrySelectorDialog
        open={showResetCountrySelector}
        onOpenChange={setShowResetCountrySelector}
        onSelectCountry={handleResetAndRecreate}
        isLoading={stripeLoading}
        isReset={true}
      />

      {/* PayPal Connect */}
      <PayPalConnectDialog
        open={showPayPalDialog}
        onOpenChange={setShowPayPalDialog}
        onConnect={connectPayPal}
        isLoading={paypalLoading}
      />

      {/* PayPal Disconnect Confirmation */}
      <AlertDialog open={showPayPalDisconnectConfirm} onOpenChange={setShowPayPalDisconnectConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('profile.disconnectPayPalTitle', 'Disconnect PayPal?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('profile.disconnectPayPalDesc', "You won't be able to receive PayPal payouts until you reconnect your account.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { disconnectPayPal(); setShowPayPalDisconnectConfirm(false); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('profile.disconnect', 'Disconnect')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
