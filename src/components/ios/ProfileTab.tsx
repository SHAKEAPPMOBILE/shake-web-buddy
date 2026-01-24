import { useState, useEffect } from "react";
import { User, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PremiumDialog } from "../PremiumDialog";
import { SuperHumanIcon } from "../SuperHumanIcon";
import { UserProfileDialog } from "../UserProfileDialog";
import { Link } from "react-router-dom";
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
        <div className="w-24 h-24 rounded-full bg-muted border-2 border-border overflow-hidden flex items-center justify-center mb-4">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <User className="w-12 h-12 text-muted-foreground" />
          )}
        </div>
        <h2 className="text-xl font-display font-bold">{userName || "User"}</h2>
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

        {!isPremium && (
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
    </div>
  );
}
