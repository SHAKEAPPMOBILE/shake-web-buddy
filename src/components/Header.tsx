import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Menu, X, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <ShakeLogo className="w-10 h-10" />
            <span className="font-display font-bold text-xl text-foreground">
              SHAKE
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#activities" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Discover
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              How it Works
            </a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Create Event
            </a>
          </nav>

          {/* Location & Auth */}
          <div className="hidden md:flex items-center gap-4">
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <MapPin className="w-4 h-4 text-primary" />
              <span>Los Angeles</span>
            </button>
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
            <Button size="sm">
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

      {/* Mobile Menu */}
      <div className={cn(
        "md:hidden absolute top-16 left-0 right-0 bg-card border-b border-border transition-all duration-300",
        isMenuOpen ? "opacity-100 visible" : "opacity-0 invisible"
      )}>
        <div className="container mx-auto px-4 py-4 space-y-4">
          <a href="#activities" className="block text-sm font-medium text-muted-foreground hover:text-foreground">
            Discover
          </a>
          <a href="#how-it-works" className="block text-sm font-medium text-muted-foreground hover:text-foreground">
            How it Works
          </a>
          <a href="#" className="block text-sm font-medium text-muted-foreground hover:text-foreground">
            Create Event
          </a>
          <div className="pt-4 border-t border-border flex gap-4">
            <Button variant="ghost" size="sm" className="flex-1">
              Sign In
            </Button>
            <Button size="sm" className="flex-1">
              Get Started
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

function ShakeLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none">
      {/* Colorful curved shapes like the app icon */}
      <path
        d="M20 80 Q10 50 30 30 Q50 10 70 30"
        stroke="hsl(var(--shake-coral))"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M30 70 Q20 45 40 30 Q60 15 75 40"
        stroke="hsl(var(--shake-green))"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M40 80 Q25 55 45 35 Q65 15 85 45"
        stroke="hsl(var(--shake-teal))"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M50 85 Q35 60 55 40 Q75 20 90 55"
        stroke="hsl(var(--shake-yellow))"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
