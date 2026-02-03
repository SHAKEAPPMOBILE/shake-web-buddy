import { useState, useEffect } from "react";
import { User, LogOut, Settings, Video, CreditCard, Share2, Copy, Check, Globe, Wallet, ExternalLink, Loader2, RefreshCw, RotateCcw, Mail, Trash2, DollarSign, Shield, Clock, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PremiumDialog } from "../PremiumDialog";
import { SuperHumanIcon } from "../SuperHumanIcon";
import { UserProfileDialog } from "../UserProfileDialog";
import { Link } from "react-router-dom";
import { useStatusVideo } from "@/hooks/useStatusVideo";
import { StatusVideoRecorder } from "../StatusVideoRecorder";
import { cn } from "@/lib/utils";
import { PointsDashboard } from "../PointsDashboard";
import { useUserPoints } from "@/hooks/useUserPoints";
import { useReferralCode, getReferralLink } from "@/hooks/useReferralCode";
import { toast } from "@/hooks/use-toast";
import shakeCoin from "@/assets/shake-coin-transparent.png";
import { LanguageSelector } from "../LanguageSelector";
import { useTranslation } from "react-i18next";
import { useStripeConnect } from "@/hooks/useStripeConnect";
import { usePayPalConnect } from "@/hooks/usePayPalConnect";
import { useCreatorEarnings } from "@/hooks/useCreatorEarnings";
import { StripeCountrySelectorDialog } from "../StripeCountrySelectorDialog";
import { PayPalConnectDialog } from "../PayPalConnectDialog";
import { useCreatorVerification } from "@/hooks/useCreatorVerification";
import { IDVerificationDialog } from "../IDVerificationDialog";
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

interface ProfileTabProps {
  onSignOut?: () => void;
  initialOpenSubscription?: boolean;
  onSubscriptionOpened?: () => void;
}

export function ProfileTab({ onSignOut, initialOpenSubscription, onSubscriptionOpened }: ProfileTabProps) {
  const { t } = useTranslation();
  const { user, isPremium, isManualOverride, signOut } = useAuth();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showStatusRecorder, setShowStatusRecorder] = useState(false);
  const [showPointsDialog, setShowPointsDialog] = useState(false);
  const [showSubscriptionDropdown, setShowSubscriptionDropdown] = useState(false);
  const [showEditProfileDropdown, setShowEditProfileDropdown] = useState(false);
  const { statusVideo, hasActiveStatus } = useStatusVideo(user?.id);
  const [statusRefreshKey, setStatusRefreshKey] = useState(0);
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
  const [isBillingPortalLoading, setIsBillingPortalLoading] = useState(false);
  const { isConnected: stripeConnected, status: stripeStatus, email: stripeEmail, isLoading: stripeLoading, error: stripeError, startOnboarding, checkStatus: checkStripeStatus, resetAndRecreate } = useStripeConnect();
  const { isConnected: paypalConnected, paypalEmail, isLoading: paypalLoading, connectPayPal, disconnectPayPal } = usePayPalConnect();
  const { totalNet, currency, activities, isLoading: earningsLoading } = useCreatorEarnings();
  const { isVerified, isPending, isRejected, isLoading: verificationLoading } = useCreatorVerification();
  const [showIDVerificationDialog, setShowIDVerificationDialog] = useState(false);

  const handleOpenBillingPortal = async () => {
    setIsBillingPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error opening customer portal:", error);
      toast({
        title: "Error",
        description: "Failed to open billing portal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsBillingPortalLoading(false);
    }
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
        title: "Error",
        description: "Failed to update payout method",
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
        description: "Share it with friends to earn points",
      });
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleShareReferralLink = async () => {
    const link = getReferralLink(referralCode);
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join SHAKE!",
          text: "Join me on SHAKE to find fun activities and meet new people!",
          url: link,
        });
      } catch (err) {
        // User cancelled or share failed, fallback to copy
        if ((err as Error).name !== "AbortError") {
          handleCopyReferralLink();
        }
      }
    } else {
      handleCopyReferralLink();
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const [publicProfile, privateProfile] = await Promise.all([
        supabase
          .from("profiles")
          .select("avatar_url, name")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("profiles_private")
          .select("preferred_payout_method")
          .eq("user_id", user.id)
          .maybeSingle()
      ]);
      
      if (publicProfile.data) {
        setAvatarUrl(publicProfile.data.avatar_url);
        setUserName(publicProfile.data.name);
      }
      if (privateProfile.data) {
        setPreferredMethod(privateProfile.data.preferred_payout_method);
      }
    };
    
    fetchProfile();
  }, [user]);

  // Open subscription dropdown when triggered from navigation state (e.g., after donation)
  useEffect(() => {
    if (initialOpenSubscription && isPremium) {
      setShowSubscriptionDropdown(true);
      onSubscriptionOpened?.();
    }
  }, [initialOpenSubscription, isPremium, onSubscriptionOpened]);

  // When not logged in, trigger onSignOut to go to home
  if (!user) {
    return null; // Parent will handle showing home tab
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
    <div className="flex flex-col h-full pt-[env(safe-area-inset-top,0px)]">
      {/* Profile Header - Clickable to view own profile */}
      <button
        onClick={() => setShowProfileDialog(true)}
        className="flex flex-col items-center px-6 py-8 border-b border-border hover:bg-muted/30 transition-colors"
      >
        {/* Avatar with Status Ring and Progress */}
        <div className="relative">
          <div className={cn(
            "w-24 h-24 rounded-full bg-muted overflow-hidden flex items-center justify-center",
            hasActiveStatus
              ? "ring-4 ring-shake-green ring-offset-2 ring-offset-background"
              : "border-2 border-border"
          )}>
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt="" 
                className="w-full h-full object-cover"
                onError={() => setAvatarUrl(null)}
              />
            ) : (
              <User className="w-12 h-12 text-muted-foreground" />
            )}
          </div>

          {/* Status Camera Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowStatusRecorder(true);
            }}
            className={cn(
              "absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center border-2 border-background transition-colors",
              hasActiveStatus
                ? "bg-shake-green hover:bg-shake-green/90"
                : "bg-primary hover:bg-primary/90"
            )}
          >
            <Video className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Status label */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowStatusRecorder(true);
          }}
          className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {hasActiveStatus ? t('profile.viewStatus', 'View Status') : t('profile.addStatus', 'Add Status')}
        </button>

        <h2 className="mt-2 text-xl font-display font-bold">{userName || "User"}</h2>
        <p className="text-sm text-muted-foreground">{user.email}</p>
        {isPremium && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setShowPremiumDialog(true);
            }}
            className="flex items-center gap-1.5 mt-2 px-3 py-1 bg-shake-yellow/10 rounded-full cursor-pointer hover:bg-shake-yellow/20 transition-colors"
          >
            <SuperHumanIcon size={14} />
            <span className="text-sm font-medium text-shake-yellow">{t('profile.superHuman')}</span>
          </div>
        )}
        
      </button>

      {/* Menu Items */}
      <div className="flex-1 px-4 py-4 space-y-2">
        {/* Edit Profile - Dropdown */}
        <div className="w-full bg-card border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowEditProfileDropdown(!showEditProfileDropdown)}
            className="w-full flex items-center gap-4 px-4 py-3"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <span className="font-medium">{t('profile.editProfile')}</span>
              <p className="text-xs text-muted-foreground">{t('profile.updateYourInfo', 'Update your info')}</p>
            </div>
          </button>
          {showEditProfileDropdown && (
            <div className="px-4 pb-4 pt-0 animate-fade-in border-t border-border/50">
              <div className="space-y-3 pt-3">
                <p className="text-xs text-muted-foreground">
                  {t('profile.updateDescription', 'Update your name, avatar, nationality, occupation, and social links.')}
                </p>
                <button
                  onClick={() => {
                    setShowEditProfileDropdown(false);
                    navigate("/profile");
                  }}
                  className="w-full py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors"
                >
                  {t('profile.editProfile')}
                </button>
                
              </div>
            </div>
          )}
        </div>

        {/* Separator Line */}
        <div className="h-px bg-border my-2" />

        {/* My Points - Dropdown */}
        <div className="w-full bg-card border border-shake-yellow/30 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowPointsDialog(!showPointsDialog)}
            className="w-full flex items-center gap-4 px-4 py-3"
          >
            <div className="w-10 h-10 rounded-full bg-shake-yellow/10 flex items-center justify-center">
              <img src={shakeCoin} alt="Points" className="w-6 h-6" />
            </div>
            <div className="flex-1 text-left">
              <span className="font-medium">{t('profile.myPoints')}</span>
              <p className="text-xs text-muted-foreground">{points.toLocaleString()} {t('profile.points')} earned</p>
            </div>
          </button>
          {showPointsDialog && (
            <div className="px-4 pb-4 pt-0 animate-fade-in border-t border-border/50">
              <PointsDashboard userId={user?.id} />
            </div>
          )}
        </div>

        {isPremium ? (
          <div className="w-full bg-card border border-shake-green/30 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowSubscriptionDropdown(!showSubscriptionDropdown)}
              className="w-full flex items-center gap-4 px-4 py-3"
            >
              <div className="w-10 h-10 rounded-full bg-shake-green/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-shake-green" />
              </div>
            <div className="flex-1 text-left">
              <span className="font-medium">{t('profile.manageSubscription')}</span>
              <p className="text-xs text-muted-foreground">{t('profile.superHuman')} active</p>
            </div>
            </button>
            {showSubscriptionDropdown && (
              <div className="px-4 pb-4 pt-0 animate-fade-in border-t border-border/50">
                <div className="space-y-3 pt-3">
                  <div className="flex items-center gap-2">
                    <SuperHumanIcon size={16} />
                    <span className="text-sm font-medium text-shake-yellow">{t('profile.superHumanActive', 'Super-Human Active')}</span>
                  </div>
                  <button
                    onClick={handleOpenBillingPortal}
                    disabled={isBillingPortalLoading}
                    className="w-full mt-2 py-2 text-sm font-medium text-shake-green border border-shake-green/30 rounded-lg hover:bg-shake-green/10 transition-colors disabled:opacity-50"
                  >
                    {isBillingPortalLoading ? "Loading..." : t('profile.manageBilling', 'Manage in Billing Portal')}
                  </button>
                  <button
                    onClick={() => {
                      setShowSubscriptionDropdown(false);
                      setShowPremiumDialog(true);
                    }}
                    className="w-full py-2 text-sm font-medium text-pink-500 border border-pink-500/30 rounded-lg hover:bg-pink-500/10 transition-colors"
                  >
                    💚 Be a Kind Human (Support)
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowPremiumDialog(true)}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl"
            style={{
              background: "linear-gradient(to right, rgba(88, 28, 135, 0.6), rgba(67, 56, 202, 0.5))",
            }}
          >
            <div className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center">
              <SuperHumanIcon size={24} />
            </div>
            <div className="flex-1 text-left">
              <span className="font-medium text-white">{t('profile.upgradeToPremium', 'Upgrade to Premium')}</span>
              <p className="text-xs text-white/70">{t('profile.unlimitedMessages', 'Unlimited messages & more')}</p>
            </div>
            <span className="text-xs font-medium text-white bg-white/20 px-2 py-1 rounded-full">
              {t('profile.subscribeNow', 'Subscribe now')}
            </span>
          </button>
        )}

        {/* Share Referral Link */}
        <div className="w-full bg-card border border-primary/30 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowReferralLink(!showReferralLink)}
            className="w-full flex items-center gap-4 px-4 py-3"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <span className="font-medium">{t('profile.shareReferral')}</span>
              <p className="text-xs text-muted-foreground">{t('profile.earnPoints', 'Earn +5 points per signup')}</p>
            </div>
          </button>
          {showReferralLink && referralCode && (
            <div className="px-4 pb-3 pt-0 animate-fade-in">
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <span className="flex-1 text-sm text-muted-foreground truncate">
                  {getReferralLink(referralCode)}
                </span>
                <button
                  onClick={handleCopyReferralLink}
                  className="p-1.5 hover:bg-muted rounded-md transition-colors"
                  title="Copy link"
                >
                  {copiedLink ? (
                    <Check className="w-4 h-4 text-shake-green" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
                <button
                  onClick={handleShareReferralLink}
                  className="p-1.5 hover:bg-muted rounded-md transition-colors"
                  title="Share link"
                >
                  <Share2 className="w-4 h-4 text-primary" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Creator Payouts - Stripe or PayPal */}
        <div className="w-full bg-card border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowPayoutOptions(!showPayoutOptions)}
            className="w-full flex items-center gap-4 px-4 py-3"
          >
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              (stripeConnected && stripeStatus === "complete") || paypalConnected ? "bg-shake-green/10" : "bg-primary/10"
            )}>
              <Wallet className={cn("w-5 h-5", (stripeConnected && stripeStatus === "complete") || paypalConnected ? "text-shake-green" : "text-primary")} />
            </div>
            <div className="flex-1 text-left">
              <span className="font-medium">{t('profile.creatorPayouts', 'Creator Payouts')}</span>
              <p className="text-xs text-muted-foreground">
                {(stripeConnected && stripeStatus === "complete") || paypalConnected
                  ? t('profile.payoutsConnected', 'Ready to receive payments')
                  : stripeConnected && stripeStatus === "pending"
                  ? t('profile.stripePending', 'Verification pending')
                  : t('profile.payoutsNotConnected', 'Set up to receive payments')}
              </p>
            </div>
            {((stripeConnected && stripeStatus === "complete") || paypalConnected) && (
              <div className="w-2 h-2 rounded-full bg-shake-green" />
            )}
            {stripeConnected && stripeStatus === "pending" && !paypalConnected && (
              <div className="w-2 h-2 rounded-full bg-amber-500" />
            )}
          </button>
          {showPayoutOptions && (
            <div className="px-4 pb-4 pt-0 animate-fade-in border-t border-border/50">
              <div className="space-y-4 pt-3">
                {/* Earnings Summary */}
                <div className="border rounded-lg p-3 bg-gradient-to-r from-shake-yellow/10 to-shake-green/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-shake-green" />
                      <span className="text-sm font-medium">{t('profile.yourEarnings', 'Your Earnings')}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">85% {t('profile.afterFee', 'after platform fee')}</span>
                  </div>
                  {earningsLoading ? (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : activities.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-end justify-between">
                        <span className="text-2xl font-bold text-shake-green">
                          {currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency === "BRL" ? "R$" : "$"}
                          {totalNet.toFixed(2)}
                        </span>
                        <span className="text-xs text-muted-foreground">{currency}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('profile.fromPaidActivities', 'From {{count}} paid activities', { count: activities.length })}
                      </p>
                      {activities.some(a => a.participants > 0) && (
                        <div className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
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
                    <p className="text-xs text-muted-foreground">
                      {t('profile.noEarningsYet', 'Create paid activities to start earning!')}
                    </p>
                  )}
                </div>

                {/* ID Verification Status */}
                <button
                  onClick={() => setShowIDVerificationDialog(true)}
                  className={cn(
                    "w-full border rounded-lg p-3 text-left transition-colors hover:bg-muted/30",
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
                        "w-6 h-6 rounded flex items-center justify-center",
                        isVerified 
                          ? "bg-shake-green/20" 
                          : isPending 
                            ? "bg-amber-500/20" 
                            : isRejected
                              ? "bg-destructive/20"
                              : "bg-primary/10"
                      )}>
                        {isVerified ? (
                          <CheckCircle className="w-4 h-4 text-shake-green" />
                        ) : isPending ? (
                          <Clock className="w-4 h-4 text-amber-500" />
                        ) : isRejected ? (
                          <XCircle className="w-4 h-4 text-destructive" />
                        ) : (
                          <Shield className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <span className="text-sm font-medium">
                        {t('profile.idVerification', 'ID Verification')}
                      </span>
                    </div>
                    {verificationLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : isVerified ? (
                      <span className="text-xs text-shake-green bg-shake-green/10 px-2 py-0.5 rounded-full">
                        {t('profile.verified', 'Verified')}
                      </span>
                    ) : isPending ? (
                      <span className="text-xs text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                        {t('profile.pending', 'Pending')}
                      </span>
                    ) : isRejected ? (
                      <span className="text-xs text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                        {t('profile.rejected', 'Rejected')}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {t('profile.notVerified', 'Not verified')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 ml-8">
                    {isVerified 
                      ? t('profile.idVerifiedDesc', 'You can create paid activities')
                      : isPending 
                        ? t('profile.idPendingDesc', 'Under review - usually within 1 hour')
                        : isRejected
                          ? t('profile.idRejectedDesc', 'Please resubmit your ID')
                          : t('profile.idRequiredDesc', 'Required to create paid activities')}
                  </p>
                </button>

                {/* Connected Status Summary */}
                {((stripeConnected && stripeStatus === "complete") || paypalConnected) && (
                  <div className="flex items-center gap-2 p-2 bg-shake-green/10 rounded-lg">
                    <Check className="w-4 h-4 text-shake-green" />
                    <span className="text-sm text-shake-green font-medium">
                      {t('profile.payoutsReady', 'Ready to receive payouts')}
                    </span>
                  </div>
                )}

                {/* Stripe Section */}
                <div className={`border rounded-lg p-3 space-y-2 ${preferredMethod === "stripe" ? "border-shake-green bg-shake-green/5" : "border-border"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-[#635BFF] rounded flex items-center justify-center">
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
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{stripeEmail}</span>
                        </div>
                      )}
                      {preferredMethod !== "stripe" && paypalConnected && (
                        <button
                          onClick={() => handleSetPreferredMethod("stripe")}
                          className="w-full py-2 text-xs font-medium text-[#635BFF] border border-[#635BFF]/30 rounded-lg hover:bg-[#635BFF]/10 transition-colors"
                        >
                          {t('profile.useStripe', 'Use Stripe for payouts')}
                        </button>
                      )}
                    </>
                  ) : stripeConnected && stripeStatus === "verification_pending" ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        {t('profile.stripeVerificationPending', 'Stripe is reviewing your account. This usually takes 1-3 business days.')}
                      </p>
                      {stripeEmail && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{stripeEmail}</span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={checkStripeStatus}
                          disabled={stripeLoading}
                          className="flex-1 py-2 text-xs font-medium text-amber-600 border border-amber-500/30 rounded-lg hover:bg-amber-500/10 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          {stripeLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          {t('profile.checkStatus', 'Check Status')}
                        </button>
                      </div>
                    </>
                  ) : stripeConnected && stripeStatus === "pending" ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        {t('profile.stripePendingDesc', 'Complete your Stripe onboarding to receive payments.')}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            startOnboarding();
                            setShowPayoutOptions(false);
                          }}
                          disabled={stripeLoading}
                          className="flex-1 py-2 text-xs font-medium text-amber-600 border border-amber-500/30 rounded-lg hover:bg-amber-500/10 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          {stripeLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                          {t('profile.completeOnboarding', 'Complete Setup')}
                        </button>
                        <button
                          onClick={checkStripeStatus}
                          disabled={stripeLoading}
                          className="py-2 px-3 text-xs text-muted-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => {
                            setShowPayoutOptions(false);
                            setShowResetCountrySelector(true);
                          }}
                          disabled={stripeLoading}
                          className="py-2 px-3 text-xs text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        {t('profile.stripeDesc', 'Credit/debit card payments with identity verification.')}
                      </p>
                      <button
                        onClick={() => {
                          startOnboarding();
                        }}
                        disabled={stripeLoading}
                        className="w-full py-2 text-xs font-medium text-[#635BFF] border border-[#635BFF]/30 rounded-lg hover:bg-[#635BFF]/10 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {stripeLoading ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {t('profile.connecting', 'Connecting to Stripe...')}
                          </>
                        ) : (
                          <>
                            <ExternalLink className="w-3 h-3" />
                            {t('profile.connectStripe', 'Connect Stripe')}
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>

                {/* PayPal Section */}
                <div className={`border rounded-lg p-3 space-y-2 ${preferredMethod === "paypal" ? "border-shake-green bg-shake-green/5" : "border-border"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-[#0070BA] rounded flex items-center justify-center">
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
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{paypalEmail}</span>
                      </div>
                      {preferredMethod !== "paypal" && stripeConnected && stripeStatus === "complete" && (
                        <button
                          onClick={() => handleSetPreferredMethod("paypal")}
                          className="w-full py-2 text-xs font-medium text-[#0070BA] border border-[#0070BA]/30 rounded-lg hover:bg-[#0070BA]/10 transition-colors"
                        >
                          {t('profile.usePayPal', 'Use PayPal for payouts')}
                        </button>
                      )}
                      <button
                        onClick={() => setShowPayPalDisconnectConfirm(true)}
                        disabled={paypalLoading}
                        className="w-full py-2 text-xs font-medium text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/10 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <Trash2 className="w-3 h-3" />
                        {t('profile.disconnectPayPal', 'Disconnect PayPal')}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        {t('profile.paypalDesc', 'Simple email-based payouts with no verification needed.')}
                      </p>
                      <button
                        onClick={() => {
                          setShowPayoutOptions(false);
                          setShowPayPalDialog(true);
                        }}
                        disabled={paypalLoading}
                        className="w-full py-2 text-xs font-medium text-[#0070BA] border border-[#0070BA]/30 rounded-lg hover:bg-[#0070BA]/10 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {paypalLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                        {t('profile.connectPayPal', 'Connect PayPal')}
                      </button>
                    </>
                  )}
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  {t('profile.payoutNote', 'You\'ll receive 90% of each payment. Connect at least one method.')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Language Selector */}
        <div className="w-full bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Globe className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <span className="font-medium">{t('profile.language', 'Language')}</span>
              <p className="text-xs text-muted-foreground">{t('profile.selectLanguage', 'Select your preferred language')}</p>
            </div>
            <LanguageSelector showLabel={false} />
          </div>
        </div>

        <button
          onClick={handleSignOutClick}
          className="w-full flex items-center gap-4 px-4 py-3 bg-card border border-border rounded-xl"
        >
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <LogOut className="w-5 h-5 text-destructive" />
          </div>
          <span className="font-medium text-destructive">{t('common.signOut')}</span>
        </button>
      </div>

      {/* Footer Links */}
      <div className="px-4 pb-6 space-y-2">
        <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
          <Link to="/community-guidelines" className="hover:text-foreground">{t('common.communityGuidelines', 'Community Guidelines')}</Link>
          <Link to="/privacy-policy" className="hover:text-foreground">{t('common.privacyPolicy', 'Privacy Policy')}</Link>
          <Link to="/terms-of-service" className="hover:text-foreground">{t('common.termsOfService', 'Terms of Service')}</Link>
        </div>
        <p className="text-center text-xs text-muted-foreground/70">
          © {new Date().getFullYear()} SHAKEapp Inc.
        </p>
      </div>

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
            <AlertDialogAction onClick={handleConfirmSignOut} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sign Out
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
          onVideoUploaded={() => setStatusRefreshKey((prev) => prev + 1)}
        />
      )}

      {/* Country Selector for New Stripe Connect */}
      <StripeCountrySelectorDialog
        open={showCountrySelector}
        onOpenChange={setShowCountrySelector}
        onSelectCountry={handleStartOnboarding}
        isLoading={stripeLoading}
        isReset={false}
      />

      {/* Country Selector for Reset/Recreate Stripe Connect */}
      <StripeCountrySelectorDialog
        open={showResetCountrySelector}
        onOpenChange={setShowResetCountrySelector}
        onSelectCountry={handleResetAndRecreate}
        isLoading={stripeLoading}
        isReset={true}
      />

      {/* PayPal Connect Dialog */}
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
              {t('profile.disconnectPayPalDesc', 'You won\'t be able to receive PayPal payouts until you reconnect your account.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                disconnectPayPal();
                setShowPayPalDisconnectConfirm(false);
              }} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('profile.disconnect', 'Disconnect')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ID Verification Dialog */}
      <IDVerificationDialog
        open={showIDVerificationDialog}
        onOpenChange={setShowIDVerificationDialog}
      />

    </div>
  );
}
