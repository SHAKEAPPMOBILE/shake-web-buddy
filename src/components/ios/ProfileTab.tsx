import { useState, useEffect } from "react";
import { User, LogOut, Settings, Video, CreditCard, Share2, Copy, Check, Globe, Wallet, ExternalLink, Loader2, RefreshCw } from "lucide-react";
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
}

export function ProfileTab({ onSignOut }: ProfileTabProps) {
  const { t } = useTranslation();
  const { user, isPremium, signOut } = useAuth();
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
  const [showStripeConnect, setShowStripeConnect] = useState(false);
  const { isConnected: stripeConnected, status: stripeStatus, isLoading: stripeLoading, startOnboarding, checkStatus: checkStripeStatus } = useStripeConnect();

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
      
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, name")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (data) {
        setAvatarUrl(data.avatar_url);
        setUserName(data.name);
      }
    };
    
    fetchProfile();
  }, [user]);

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
                    onClick={() => {
                      setShowSubscriptionDropdown(false);
                      setShowPremiumDialog(true);
                    }}
                    className="w-full mt-2 py-2 text-sm font-medium text-shake-green border border-shake-green/30 rounded-lg hover:bg-shake-green/10 transition-colors"
                  >
                    {t('profile.manageBilling', 'Manage in Billing Portal')}
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

        {/* Connect Stripe for Payouts */}
        <div className="w-full bg-card border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowStripeConnect(!showStripeConnect)}
            className="w-full flex items-center gap-4 px-4 py-3"
          >
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              stripeConnected && stripeStatus === "complete" ? "bg-shake-green/10" : "bg-primary/10"
            )}>
              <Wallet className={cn("w-5 h-5", stripeConnected && stripeStatus === "complete" ? "text-shake-green" : "text-primary")} />
            </div>
            <div className="flex-1 text-left">
              <span className="font-medium">{t('profile.stripeConnect', 'Creator Payouts')}</span>
              <p className="text-xs text-muted-foreground">
                {stripeConnected && stripeStatus === "complete"
                  ? t('profile.stripeConnected', 'Ready to receive payments')
                  : stripeConnected && stripeStatus === "pending"
                  ? t('profile.stripePending', 'Verification pending')
                  : t('profile.stripeNotConnected', 'Set up to receive payments')}
              </p>
            </div>
            {stripeConnected && stripeStatus === "complete" && (
              <div className="w-2 h-2 rounded-full bg-shake-green" />
            )}
            {stripeConnected && stripeStatus === "pending" && (
              <div className="w-2 h-2 rounded-full bg-amber-500" />
            )}
          </button>
          {showStripeConnect && (
            <div className="px-4 pb-4 pt-0 animate-fade-in border-t border-border/50">
              <div className="space-y-3 pt-3">
                {stripeConnected && stripeStatus === "complete" ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-shake-green" />
                      <span className="text-sm text-shake-green font-medium">
                        {t('profile.stripeReady', 'Ready to receive payouts')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('profile.stripeConnectedDesc', 'Your Stripe account is connected. You\'ll receive 90% of payments from your paid activities.')}
                    </p>
                  </>
                ) : stripeConnected && stripeStatus === "pending" ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                      <span className="text-sm text-amber-500 font-medium">
                        {t('profile.stripePendingTitle', 'Verification in progress')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('profile.stripePendingDesc', 'Stripe is verifying your account. This usually takes a few minutes. Click below to complete any remaining steps.')}
                    </p>
                    <button
                      onClick={() => {
                        startOnboarding();
                        setShowStripeConnect(false);
                      }}
                      disabled={stripeLoading}
                      className="w-full py-2 text-sm font-medium text-amber-600 border border-amber-500/30 rounded-lg hover:bg-amber-500/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {stripeLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ExternalLink className="w-4 h-4" />
                      )}
                      {t('profile.stripeCompletePending', 'Complete verification')}
                    </button>
                    <button
                      onClick={checkStripeStatus}
                      disabled={stripeLoading}
                      className="w-full py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {stripeLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      {t('profile.stripeRefreshStatus', 'Refresh status')}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {t('profile.stripeConnectDesc', 'Connect your Stripe account to receive payments when people join your paid activities. You\'ll keep 90% of each payment.')}
                    </p>
                    <button
                      onClick={() => {
                        startOnboarding();
                        setShowStripeConnect(false);
                      }}
                      disabled={stripeLoading}
                      className="w-full py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {stripeLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <ExternalLink className="w-4 h-4" />
                          {t('profile.connectStripe', 'Connect Stripe Account')}
                        </>
                      )}
                    </button>
                  </>
                )}
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

    </div>
  );
}
