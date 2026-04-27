import { Home, MapPin, MessageSquare, User, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTotalUnreadChats } from "@/hooks/useTotalUnreadChats";
import { useTranslation } from "react-i18next";
import { useSettlingGradient } from "@/hooks/useSettlingGradient";
import { useNavigate } from "react-router-dom";

interface IOSTabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onShakeStart?: () => void;
}

export function IOSTabBar({ activeTab, onTabChange, onShakeStart }: IOSTabBarProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { totalUnread } = useTotalUnreadChats();
  const { style: settlingGradientStyle } = useSettlingGradient("bottom-nav-shake");
  const navigate = useNavigate();

  // Apply settling gradient only when user is logged in, otherwise use solid blue
  const shakeButtonStyle = user ? settlingGradientStyle : { background: "rgb(59, 130, 246)" }; // bg-blue-500

  const tabs = [
    { id: "home", icon: Home, label: t('home.title', 'Home') },
    { id: "plans", icon: MapPin, label: t('plans.title') },
    { id: "shake", icon: Plus, label: "Shake", isCenter: true },
    { id: "chat", icon: MessageSquare, label: t('chat.title') },
    { id: "profile", icon: User, label: t('profile.title') },
  ];

  const handleTabClick = (tabId: string) => {
    // Block navigation if user is not logged in
    if (!user) {
      return;
    }

    if (tabId === "shake") {
      navigate("/propose-plan");
      return;
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
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all",
                  isActive && "scale-110"
                )} style={shakeButtonStyle}>
                  <Plus className="w-8 h-8 text-white" />
                </div>
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
