import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut, Crown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import logoShake from "@/assets/logo_shake_original_color.png";
import { CitySelector } from "./CitySelector";
import { PremiumDialog } from "./PremiumDialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const { user, isPremium, signOut } = useAuth();
  const navigate = useNavigate();

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
        .single();
      
      if (data?.avatar_url) {
        setAvatarUrl(data.avatar_url);
      }
    };
    
    fetchAvatar();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-28 md:h-36">
            {/* Empty spacer for left side */}
            <div className="flex-1" />

            {/* Centered Logo */}
            <div className="flex items-center justify-center">
              <img src={logoShake} alt="Shake Social" className="h-20 md:h-28 object-contain" />
            </div>

            {/* Right side buttons */}
            <div className="flex-1 flex justify-end">
              <div className="hidden md:flex items-center gap-4">
                <CitySelector 
                  isPremium={isPremium} 
                  onUpgradeClick={() => setShowPremiumDialog(true)} 
                />
                {user ? (
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
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
                      Sign In
                    </Button>
                    <Button 
                      size="sm" 
                      className="bg-shake-yellow text-background hover:bg-shake-yellow/90"
                      onClick={() => navigate("/auth")}
                    >
                      Get Started
                    </Button>
                  </>
                )}
              </div>

              {/* Mobile Menu Button */}
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
            <div className="pt-4 border-t border-border flex gap-4">
              {user ? (
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
              ) : (
                <>
                  <Button variant="ghost" size="sm" className="flex-1" onClick={() => navigate("/auth")}>
                    Sign In
                  </Button>
                  <Button 
                    size="sm" 
                    className="flex-1 bg-shake-yellow text-background hover:bg-shake-yellow/90"
                    onClick={() => navigate("/auth")}
                  >
                    Get Started
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <PremiumDialog 
        open={showPremiumDialog} 
        onOpenChange={setShowPremiumDialog}
      />
    </>
  );
}
