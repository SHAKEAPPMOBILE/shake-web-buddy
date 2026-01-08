import { useState, useEffect } from "react";
import { Home, MapPin, MessageSquare, User, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useActiveChat } from "@/hooks/useActiveChat";
import { useCity } from "@/contexts/CityContext";

interface IOSTabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function IOSTabBar({ activeTab, onTabChange }: IOSTabBarProps) {
  const { user, isPremium } = useAuth();
  const { selectedCity } = useCity();
  const { activeChat } = useActiveChat(selectedCity);
  const navigate = useNavigate();
  const [isShaking, setIsShaking] = useState(false);
  const [shuffledPositions, setShuffledPositions] = useState<number[]>([0, 1, 2, 3, 4]);

  const tabs = [
    { id: "home", icon: Home, label: "Home" },
    { id: "plans", icon: MapPin, label: "Plans" },
    { id: "shake", icon: Plus, label: "Shake", isCenter: true },
    { id: "chat", icon: MessageSquare, label: "Chat" },
    { id: "profile", icon: User, label: "Profile" },
  ];

  const handleShakeAnimation = () => {
    setIsShaking(true);
    // Shuffle positions (excluding center button at index 2)
    const positions = [0, 1, 3, 4];
    const shuffled = [...positions].sort(() => Math.random() - 0.5);
    setShuffledPositions([shuffled[0], shuffled[1], 2, shuffled[2], shuffled[3]]);
    
    // Reset after 3 seconds
    setTimeout(() => {
      setIsShaking(false);
      setShuffledPositions([0, 1, 2, 3, 4]);
    }, 3000);
  };

  const handleTabClick = (tabId: string) => {
    if (tabId === "shake") {
      handleShakeAnimation();
    }
    if (tabId === "profile" && !user) {
      navigate("/auth");
      return;
    }
    onTabChange(tabId);
  };

  // Get the display order based on shuffled positions
  const getTransform = (index: number) => {
    if (!isShaking) return "translateX(0)";
    const currentPos = shuffledPositions.indexOf(index);
    const offset = (currentPos - index) * 70; // 70px per tab slot
    return `translateX(${offset}px)`;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border safe-area-bottom">
      <div className="flex items-end justify-around px-2 pt-2 pb-2">
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const hasNotification = tab.id === "chat" && activeChat && activeChat.unreadCount > 0;

          if (tab.isCenter) {
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  "relative -mt-6 flex flex-col items-center transition-transform duration-500",
                  isShaking && "animate-shake"
                )}
              >
                <div className={cn(
                  "w-16 h-16 rounded-full bg-[hsl(210,100%,50%)] flex items-center justify-center shadow-lg transition-all",
                  isActive && "scale-110"
                )}>
                  <Plus className="w-8 h-8 text-white" />
                </div>
                <span className={cn(
                  "text-[10px] mt-1 font-medium",
                  isActive ? "text-[hsl(210,100%,50%)]" : "text-muted-foreground"
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
              className={cn(
                "relative flex flex-col items-center py-1 px-3 min-w-[60px] transition-transform duration-500 ease-in-out",
                isShaking && "animate-shake"
              )}
              style={{ transform: getTransform(index) }}
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
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-destructive rounded-full flex items-center justify-center text-[10px] font-bold text-destructive-foreground">
                    {activeChat.unreadCount > 99 ? "99+" : activeChat.unreadCount}
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
