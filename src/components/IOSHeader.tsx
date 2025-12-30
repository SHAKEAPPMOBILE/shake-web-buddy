import { CitySelector } from "./CitySelector";
import { SuperHumanIcon } from "./SuperHumanIcon";
import { useAuth } from "@/contexts/AuthContext";
import logoShake from "@/assets/shake-logo-new.png";

interface IOSHeaderProps {
  title?: string;
  onUpgradeClick: () => void;
}

export function IOSHeader({ title, onUpgradeClick }: IOSHeaderProps) {
  const { isPremium } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-b border-border safe-area-top">
      <div className="flex items-center justify-between px-4 h-14">
        {/* Left - Logo */}
        <div className="flex items-center gap-2">
          <img 
            src={logoShake} 
            alt="Shake" 
            className="h-8 w-auto object-contain" 
          />
          <div className="flex flex-col">
            <span className="text-lg font-display font-bold text-foreground lowercase leading-tight">
              shake
            </span>
            <span className="text-[8px] font-medium tracking-[0.15em] uppercase text-muted-foreground -mt-0.5">
              social
            </span>
          </div>
        </div>

        {/* Right - City & Premium */}
        <div className="flex items-center gap-2">
          {isPremium && (
            <span className="flex items-center gap-1 text-[10px] text-shake-yellow">
              <SuperHumanIcon size={12} />
            </span>
          )}
        <CitySelector 
          isPremium={isPremium} 
          onUpgradeClick={onUpgradeClick}
        />
        </div>
      </div>
    </header>
  );
}
