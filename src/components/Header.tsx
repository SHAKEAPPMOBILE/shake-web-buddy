import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import logoShake from "@/assets/logo_shake_original_color.png";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Empty spacer for left side */}
          <div className="flex-1" />

          {/* Centered Logo */}
          <div className="flex items-center justify-center">
            <img src={logoShake} alt="Shake Social" className="h-12" />
          </div>

          {/* Right side buttons */}
          <div className="flex-1 flex justify-end">
            <div className="hidden md:flex items-center gap-4">
              <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <MapPin className="w-4 h-4 text-primary" />
                <span>Los Angeles</span>
              </button>
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
              <Button size="sm" className="bg-shake-yellow text-background hover:bg-shake-yellow/90">
                Get Started
              </Button>
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
        "md:hidden absolute top-16 left-0 right-0 bg-card border-b border-border transition-all duration-300",
        isMenuOpen ? "opacity-100 visible" : "opacity-0 invisible"
      )}>
        <div className="container mx-auto px-4 py-4 space-y-4">
          <a href="#how-it-works" className="block text-sm font-medium text-muted-foreground hover:text-foreground">
            How it Works
          </a>
          <div className="pt-4 border-t border-border flex gap-4">
            <Button variant="ghost" size="sm" className="flex-1">
              Sign In
            </Button>
            <Button size="sm" className="flex-1 bg-shake-yellow text-background hover:bg-shake-yellow/90">
              Get Started
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
