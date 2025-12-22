import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut, Crown, User, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import logoShake from "@/assets/logo_shake_original_color.png";
import { CitySelector } from "./CitySelector";
import { PremiumDialog } from "./PremiumDialog";
import { GroupChatDialog } from "./GroupChatDialog";
import { ActivitySelectionDialog } from "./ActivitySelectionDialog";
import { MyActivitiesDialog } from "./MyActivitiesDialog";
import { GreetingsIndicator } from "./GreetingsIndicator";
import { useAuth } from "@/contexts/AuthContext";
import { useCity } from "@/contexts/CityContext";
import { useActiveChat } from "@/hooks/useActiveChat";
import { useActivityJoins } from "@/hooks/useActivityJoins";
import { supabase } from "@/integrations/supabase/client";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [showMyActivitiesDialog, setShowMyActivitiesDialog] = useState(false);
  const [selectedChatActivity, setSelectedChatActivity] = useState<{ activityType: string; city: string } | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const { user, isPremium, signOut, isLoading } = useAuth();
  const { selectedCity } = useCity();
  const navigate = useNavigate();
  const { activeChat, markAsRead, refreshActiveChat } = useActiveChat(selectedCity);
  const { joinActivity, getActivityJoinCount } = useActivityJoins(selectedCity);

  // Fetch user avatar
  useEffect(() => {
    const fetchAvatar = async () => {
      if (!user) {
        setAvatarUrl(null);
        return;
      }
      
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (data?.avatar_url) {
        setAvatarUrl(data.avatar_url);
      }
    };
    
    fetchAvatar();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleOpenChat = () => {
    // If user has an active chat, open the activities list
    // so they can choose which chat to enter
    setShowMyActivitiesDialog(true);
  };

  const handleSelectActivityFromList = (activityType: string, city: string) => {
    setShowMyActivitiesDialog(false);
    setSelectedChatActivity({ activityType, city });
    markAsRead(activityType, city);
    setShowChatDialog(true);
  };

  const handleChatClose = (open: boolean) => {
    setShowChatDialog(open);
    if (!open && selectedChatActivity) {
      markAsRead(selectedChatActivity.activityType, selectedChatActivity.city);
    }
  };

  const handleBackToActivities = () => {
    setShowChatDialog(false);
    setShowMyActivitiesDialog(true);
  };

  const handleSelectActivity = async (activity: string) => {
    setShowActivityDialog(false);
    await joinActivity(activity);
    await refreshActiveChat();
    setSelectedChatActivity({ activityType: activity, city: selectedCity });
    setShowChatDialog(true);
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-28 md:h-36">
            {/* Left side - Mobile Menu Button */}
            <div className="flex-1 flex items-center">
              <button
                className="md:hidden p-2"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? (
                  <X className="w-6 h-6 text-foreground" />
                ) : (
                  <Menu className="w-6 h-6 text-foreground" />
                )}
              </button>
            </div>

            {/* Centered Logo */}
            <button 
              onClick={() => navigate("/")}
              className="flex flex-col items-center justify-center"
            >
              <img src={logoShake} alt="Shake Social" className="h-24 md:h-32 object-contain" />
            </button>

            {/* Right side buttons */}
            <div className="flex-1 flex justify-end items-center gap-2">
              {/* Greetings indicator - visible for all logged-in users */}
              {user && <GreetingsIndicator />}

              {/* Chat shortcut - visible for all logged-in users */}
              {user && (
                <button
                  onClick={handleOpenChat}
                  className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl hover:bg-muted/50 transition-colors"
                  title="My Activities"
                >
                  <MessageSquare className="w-5 h-5 text-foreground" />
                  <span className="text-[10px] font-medium text-foreground">Chat</span>
                  {activeChat && activeChat.unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 bg-destructive rounded-full border-2 border-background flex items-center justify-center text-[10px] font-bold text-destructive-foreground">
                      {activeChat.unreadCount > 99 ? "99+" : activeChat.unreadCount}
                    </span>
                  )}
                </button>
              )}

              <div className="hidden md:flex items-center gap-4">
                <CitySelector 
                  isPremium={isPremium} 
                  onUpgradeClick={() => setShowPremiumDialog(true)} 
                />
                {!isLoading && user ? (
                  <>
                    {isPremium && (
                      <span className="flex items-center gap-1 text-xs text-shake-yellow">
                        <Crown className="w-3 h-3" />
                        Premium
                      </span>
                    )}
                    <button
                      onClick={() => navigate("/profile")}
                      className="w-9 h-9 rounded-full bg-muted border border-border overflow-hidden flex items-center justify-center hover:border-primary transition-colors"
                    >
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                    <Button variant="ghost" size="sm" onClick={handleSignOut}>
                      <LogOut className="w-4 h-4 mr-1" />
                      Sign Out
                    </Button>
                  </>
                ) : !isLoading ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
                      Sign In
                    </Button>
                    <Button 
                      size="sm" 
                      className="bg-shake-yellow text-background hover:bg-shake-yellow/90"
                      onClick={() => navigate("/auth?mode=signup")}
                    >
                      Get Started
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className={cn(
          "md:hidden absolute top-28 md:top-36 left-0 right-0 bg-card border-b border-border transition-all duration-300",
          isMenuOpen ? "opacity-100 visible" : "opacity-0 invisible"
        )}>
          <div className="container mx-auto px-4 py-4 space-y-4">
            <div className="flex justify-center">
              <CitySelector 
                isPremium={isPremium} 
                onUpgradeClick={() => setShowPremiumDialog(true)} 
              />
            </div>
            {/* Chat shortcut for mobile - in menu */}
            {user && (
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleOpenChat();
                  }}
                  className="relative p-2 rounded-xl hover:bg-muted/50 transition-colors flex flex-col items-center gap-0.5"
                >
                  <MessageSquare className="w-5 h-5 text-foreground" />
                  <span className="text-[10px] font-medium">Chat</span>
                  {activeChat && activeChat.unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 bg-destructive rounded-full flex items-center justify-center text-[10px] font-bold text-destructive-foreground">
                      {activeChat.unreadCount > 99 ? "99+" : activeChat.unreadCount}
                    </span>
                  )}
                </button>
              </div>
            )}
            <div className="pt-4 border-t border-border flex gap-4 flex-1">
              {!isLoading && user ? (
                <>
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      navigate("/profile");
                    }}
                    className="w-10 h-10 rounded-full bg-muted border border-border overflow-hidden flex items-center justify-center"
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                  <Button variant="ghost" size="sm" className="flex-1" onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-1" />
                    Sign Out
                  </Button>
                </>
              ) : !isLoading ? (
                <>
                  <Button variant="ghost" size="sm" className="flex-1" onClick={() => navigate("/auth")}>
                    Sign In
                  </Button>
                  <Button 
                    size="sm" 
                    className="flex-1 bg-shake-yellow text-background hover:bg-shake-yellow/90"
                    onClick={() => navigate("/auth?mode=signup")}
                  >
                    Get Started
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <PremiumDialog 
        open={showPremiumDialog} 
        onOpenChange={setShowPremiumDialog}
      />

      <ActivitySelectionDialog
        open={showActivityDialog}
        onOpenChange={setShowActivityDialog}
        onSelectActivity={handleSelectActivity}
        city={selectedCity}
      />

      <MyActivitiesDialog
        open={showMyActivitiesDialog}
        onOpenChange={setShowMyActivitiesDialog}
        onSelectActivity={handleSelectActivityFromList}
      />

      {selectedChatActivity && (
        <GroupChatDialog
          open={showChatDialog}
          onOpenChange={handleChatClose}
          activityType={selectedChatActivity.activityType}
          onBack={handleBackToActivities}
          attendeeCount={getActivityJoinCount(selectedChatActivity.activityType)}
          city={selectedChatActivity.city}
        />
      )}
    </>
  );
}
