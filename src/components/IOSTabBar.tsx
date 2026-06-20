import { useState, useEffect } from "react";
import { Home, MapPin, MessageSquare, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTotalUnreadChats } from "@/hooks/useTotalUnreadChats";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { getDisplayAvatarUrl } from "@/lib/avatar";

interface IOSTabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onShakeStart?: () => void;
}

export function IOSTabBar({ activeTab, onTabChange, onShakeStart }: IOSTabBarProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { totalUnread } = useTotalUnreadChats();
  // Always use the same blue as the activity ring (border-blue-400 = #60a5fa)
  const shakeButtonStyle = { background: "#60a5fa" };

  // Current user's avatar for the Profile tab
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const userName = (user?.user_metadata?.name as string | undefined) ?? user?.email ?? null;

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.avatar_url) setUserAvatarUrl(data.avatar_url);
      });
  }, [user?.id]);

  const tabs = [
    { id: "home", icon: Home, label: t('home.title', 'Home') },
    { id: "plans", icon: MapPin, label: t('plans.title') },
    { id: "shake", icon: Plus, label: "Shake", isCenter: true },
    { id: "chat", icon: MessageSquare, label: t('chat.title') },
    { id: "profile", icon: null, label: t('profile.title'), isProfile: true },
  ];

  const handleTabClick = (tabId: string) => {
    // Block navigation if user is not logged in
    if (!user) {
      return;
    }

    if (tabId === "shake") {
      onTabChange(tabId);
      return;
    }
    onTabChange(tabId);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border safe-area-bottom">
      <div className="flex items-end justify-around px-2 pt-2 pb-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const hasNotification = tab.id === "chat" && totalUnread > 0;

          if (tab.isCenter) {
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                aria-disabled={!user}
                className="relative -mt-6 flex flex-col items-center"
              >
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all",
                  isActive && "scale-110"
                )} style={shakeButtonStyle}>
                  <Plus className="w-8 h-8 text-white" />
                </div>
              </button>
            );
          }

          // Profile tab: circular avatar (photo or initials), no text label
          if ((tab as any).isProfile) {
            const displayAvatar = getDisplayAvatarUrl(userAvatarUrl ?? undefined);
            const initial = userName?.charAt(0)?.toUpperCase() ?? "?";
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                disabled={!user}
                className={cn(
                  "relative flex flex-col items-center py-1 px-3 min-w-[60px]",
                  !user && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="relative p-2 rounded-xl transition-all">
                  <div className={cn(
                    "w-7 h-7 rounded-full overflow-hidden flex items-center justify-center transition-all",
                    isActive
                      ? "ring-2 ring-primary ring-offset-1 ring-offset-card"
                      : "ring-1 ring-border"
                  )}>
                    {displayAvatar ? (
                      <img
                        src={displayAvatar}
                        alt={userName ?? "Profile"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className={cn(
                        "w-full h-full flex items-center justify-center text-[10px] font-bold",
                        isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        {initial}
                      </span>
                    )}
                  </div>
                </div>
                {/* Invisible spacer keeps this button the same height as icon+label tabs */}
                <span className="text-[10px] invisible select-none" aria-hidden>·</span>
              </button>
            );
          }

          const Icon = tab.icon!;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              disabled={!user}
              className={cn(
                "relative flex flex-col items-center py-1 px-3 min-w-[60px]",
                !user && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className={cn(
                "relative p-2 rounded-xl transition-all",
                isActive && "bg-primary/10"
              )}>
                <Icon className={cn(
                  "w-6 h-6 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )} />
                {hasNotification && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-600 shadow-sm ring-2 ring-card"
                    aria-label="Unread messages"
                  />
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
