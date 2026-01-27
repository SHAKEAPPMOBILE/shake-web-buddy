import { useState, useEffect } from "react";
import { User, LogOut, Settings, Video, CreditCard, Share2, Copy, Check } from "lucide-react";
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
  const { user, isPremium, signOut } = useAuth();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showStatusRecorder, setShowStatusRecorder] = useState(false);
  const [showPointsDialog, setShowPointsDialog] = useState(false);
  const { statusVideo, hasActiveStatus } = useStatusVideo(user?.id);
  const [statusRefreshKey, setStatusRefreshKey] = useState(0);
  const { points } = useUserPoints(user?.id);
  const { referralCode } = useReferralCode(user?.id);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyReferralLink = async () => {
    const link = getReferralLink(referralCode);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      toast({
        title: "Link copied!",
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
          {hasActiveStatus ? "View Status" : "Add Status"}
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
            <span className="text-sm font-medium text-shake-yellow">Super-Human</span>
          </div>
        )}
        
      </button>

      {/* Menu Items */}
      <div className="flex-1 px-4 py-4 space-y-2">
        {/* Edit Profile */}
        <button
          onClick={() => navigate("/profile")}
          className="w-full flex items-center gap-4 px-4 py-3 bg-card border border-border rounded-xl"
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <span className="font-medium">Edit Profile</span>
        </button>

        {/* My Points */}
        <button
          onClick={() => setShowPointsDialog(true)}
          className="w-full flex items-center gap-4 px-4 py-3 bg-card border border-shake-yellow/30 rounded-xl"
        >
          <div className="w-10 h-10 rounded-full bg-shake-yellow/10 flex items-center justify-center">
            <img src={shakeCoin} alt="Points" className="w-6 h-6" />
          </div>
          <div className="flex-1 text-left">
            <span className="font-medium">My Points</span>
            <p className="text-xs text-muted-foreground">{points.toLocaleString()} points earned</p>
          </div>
        </button>

        {/* Share Referral Link */}
        <div className="w-full bg-card border border-primary/30 rounded-xl overflow-hidden">
          <button
            onClick={handleShareReferralLink}
            className="w-full flex items-center gap-4 px-4 py-3"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <span className="font-medium">Share Referral Link</span>
              <p className="text-xs text-muted-foreground">Earn +5 points per signup</p>
            </div>
          </button>
          {referralCode && (
            <div className="px-4 pb-3 pt-0">
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <span className="flex-1 text-sm text-muted-foreground truncate">
                  {getReferralLink(referralCode)}
                </span>
                <button
                  onClick={handleCopyReferralLink}
                  className="p-1.5 hover:bg-muted rounded-md transition-colors"
                >
                  {copiedLink ? (
                    <Check className="w-4 h-4 text-shake-green" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {isPremium ? (
          <button
            onClick={() => setShowPremiumDialog(true)}
            className="w-full flex items-center gap-4 px-4 py-3 bg-card border border-shake-green/30 rounded-xl"
          >
            <div className="w-10 h-10 rounded-full bg-shake-green/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-shake-green" />
            </div>
            <div className="flex-1 text-left">
              <span className="font-medium">Manage Subscription</span>
              <p className="text-xs text-muted-foreground">Cancel or update your plan</p>
            </div>
          </button>
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
              <span className="font-medium text-white">Upgrade to Premium</span>
              <p className="text-xs text-white/70">Unlimited messages & more</p>
            </div>
            <span className="text-xs font-medium text-white bg-white/20 px-2 py-1 rounded-full">
              Subscribe now
            </span>
          </button>
        )}

        <button
          onClick={handleSignOutClick}
          className="w-full flex items-center gap-4 px-4 py-3 bg-card border border-border rounded-xl"
        >
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <LogOut className="w-5 h-5 text-destructive" />
          </div>
          <span className="font-medium text-destructive">Antisocial</span>
        </button>
      </div>

      {/* Footer Links */}
      <div className="px-4 pb-6 space-y-2">
        <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
          <Link to="/community-guidelines" className="hover:text-foreground">Community Guidelines</Link>
          <Link to="/privacy-policy" className="hover:text-foreground">Privacy Policy</Link>
          <Link to="/terms-of-service" className="hover:text-foreground">Terms of Service</Link>
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
            <AlertDialogTitle>Going antisocial? 😢</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sign out? You'll miss all the fun activities!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay Social</AlertDialogCancel>
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

      {/* Points Dialog */}
      <Dialog open={showPointsDialog} onOpenChange={setShowPointsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <img src={shakeCoin} alt="Points" className="w-6 h-6" />
              My Points
            </DialogTitle>
          </DialogHeader>
          <PointsDashboard userId={user?.id} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
