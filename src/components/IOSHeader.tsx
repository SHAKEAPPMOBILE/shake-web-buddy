import { SuperHumanIcon } from "./SuperHumanIcon";
import { useAuth } from "@/contexts/AuthContext";
import logoShake from "@/assets/shake-logo-new.png";

interface IOSHeaderProps {
  title?: string;
  onUpgradeClick?: () => void;
}

export function IOSHeader({ title, onUpgradeClick }: IOSHeaderProps) {
  const { isPremium } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-b border-border safe-area-top">
      <div className="flex items-center justify-center px-3 h-12">
        {/* Centered Logo */}
        <div className="flex items-center gap-1.5">
          <img 
            src={logoShake} 
            alt="Shake" 
            className="h-6 w-auto object-contain" 
          />
          <div className="flex flex-col">
            <span className="text-base font-display font-bold text-foreground lowercase leading-tight">
              shake
            </span>
            <span className="text-[7px] font-medium tracking-[0.12em] uppercase text-muted-foreground -mt-0.5">
              social
            </span>
          </div>
          {isPremium && (
            <SuperHumanIcon size={14} className="text-shake-yellow ml-1" />
          )}
        </div>
      </div>
    </header>
  );
}
