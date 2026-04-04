import { useState } from "react";
import { Home, MapPin, MessageSquare, User, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTotalUnreadChats } from "@/hooks/useTotalUnreadChats";
import { useTranslation } from "react-i18next";
import { useSettlingGradient } from "@/hooks/useSettlingGradient";

interface IOSTabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onShakeStart?: () => void;
}

export function IOSTabBar({ activeTab, onTabChange, onShakeStart }: IOSTabBarProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { totalUnread } = useTotalUnreadChats();
  const { style: animatedShakeGradientStyle } = useSettlingGradient("bottom-nav-shake", { alwaysAnimated: true });
  const [isShaking, setIsShaking] = useState(false);

  // Apply rainbow gradient only when user is logged in, otherwise use solid blue
  const shakeButtonStyle = user ? animatedShakeGradientStyle : { background: "rgb(59, 130, 246)" }; // bg-blue-500

  const tabs = [
    { id: "home", icon: Home, label: t('home.title', 'Home') },
    { id: "plans", icon: MapPin, label: t('plans.title') },
    { id: "shake", icon: Plus, label: "Shake", isCenter: true },
    { id: "chat", icon: MessageSquare, label: t('chat.title') },
    { id: "profile", icon: User, label: t('profile.title') },
  ];

  const handleShakeAnimation = () => {
    setIsShaking(true);
    setTimeout(() => {
      setIsShaking(false);
    }, 3000);
  };

  const handleTabClick = (tabId: string) => {
    // Block navigation if user is not logged in
    if (!user) {
      return;
    }
    
    if (tabId === "shake") {
      handleShakeAnimation();
    }
    onTabChange(tabId);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border safe-area-bottom">
      <div className="flex items-end justify-around px-2 pt-2 pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
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
                <div className="flex items-center gap-1">
                  {/* Left arrow - only visible during shake (fixed green, not themed) */}
                  {isShaking && (
                    <ChevronLeft 
                      className="w-5 h-5 text-emerald-400 animate-bounce-left"
                    />
                  )}
                  
                  {/* Center circle - rainbow gradient when logged in, solid blue when not */}
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all",
                    isActive && "scale-110",
                    isShaking && "animate-shake-center"
                  )} style={shakeButtonStyle}>
                    <Plus className="w-8 h-8 text-white" />
                  </div>
                  
                  {/* Right arrow - only visible during shake (fixed green, not themed) */}
                  {isShaking && (
                    <ChevronRight 
                      className="w-5 h-5 text-emerald-400 animate-bounce-right"
                    />
                  )}
                </div>
                <span className={cn(
                  "text-[10px] mt-1 font-medium",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                  {tab.label}
                </span>
              </button>
            );
          }

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
                    className="absolute -top-0.5 -right-0.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-card"
                    aria-label={`${totalUnread} unread messages`}
                  >
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </span>
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
