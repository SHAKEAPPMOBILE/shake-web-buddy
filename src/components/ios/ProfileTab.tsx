import { useState, useEffect, useRef } from "react";
import { User, LogOut, Settings, Video, CreditCard } from "lucide-react";
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
  const { statusVideo, hasActiveStatus } = useStatusVideo(user?.id);
  const [statusRefreshKey, setStatusRefreshKey] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [videoProgress, setVideoProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Reset video playing state when status changes
  useEffect(() => {
    if (hasActiveStatus) {
      setIsVideoPlaying(true);
      setVideoProgress(0);
    }
  }, [hasActiveStatus, statusRefreshKey]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setVideoProgress(progress);
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
          {/* Circular Progress Indicator */}
          {hasActiveStatus && isVideoPlaying && (
            <svg
              className="absolute inset-0 w-[104px] h-[104px] -m-[4px] rotate-[-90deg]"
              viewBox="0 0 104 104"
            >
              {/* Background circle */}
              <circle
                cx="52"
                cy="52"
                r="48"
                fill="none"
                stroke="hsl(var(--shake-green) / 0.2)"
                strokeWidth="4"
              />
              {/* Progress circle */}
              <circle
                cx="52"
                cy="52"
                r="48"
                fill="none"
                stroke="hsl(var(--shake-green))"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 48}
                strokeDashoffset={2 * Math.PI * 48 * (1 - videoProgress / 100)}
                className="transition-[stroke-dashoffset] duration-100 ease-linear"
              />
            </svg>
          )}
          
          <div className={cn(
            "w-24 h-24 rounded-full bg-muted overflow-hidden flex items-center justify-center",
            hasActiveStatus && !isVideoPlaying
              ? "ring-4 ring-shake-green ring-offset-2 ring-offset-background"
              : !hasActiveStatus
              ? "border-2 border-border"
              : ""
          )}>
            {hasActiveStatus && isVideoPlaying && statusVideo ? (
              <video
                ref={videoRef}
                src={statusVideo.video_url}
                className="w-full h-full object-cover"
                autoPlay
                muted
                playsInline
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsVideoPlaying(false)}
              />
            ) : avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
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
        <button
          onClick={() => navigate("/profile")}
          className="w-full flex items-center gap-4 px-4 py-3 bg-card border border-border rounded-xl"
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <span className="font-medium">Edit Profile</span>
        </button>

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
    </div>
  );
}
