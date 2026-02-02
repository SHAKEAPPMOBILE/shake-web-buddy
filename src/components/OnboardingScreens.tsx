import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight, Users, MessageSquare, MapPin, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingScreensProps {
  onComplete: () => void;
}

const screens = [
  {
    emoji: "🎉",
    title: "Welcome to SHAKE",
    description: "Meet new people and make real connections through shared activities",
    icon: Sparkles,
    color: "from-primary/20 to-primary/5",
  },
  {
    emoji: "🍽️",
    title: "Join Activities",
    description: "Pick an activity like Dinner, Drinks, Hike, or propose one, and join others in your city",
    icon: Users,
    color: "from-orange-500/20 to-orange-500/5",
  },
  {
    emoji: "💬",
    title: "Chat & Connect",
    description: "Message your group, make plans, and get to know everyone before meeting up",
    icon: MessageSquare,
    color: "from-blue-500/20 to-blue-500/5",
  },
  {
    emoji: "📍",
    title: "Meet In Person",
    description: "Show up at the venue, check in, and enjoy real-life connections",
    icon: MapPin,
    color: "from-green-500/20 to-green-500/5",
  },
];

export function OnboardingScreens({ onComplete }: OnboardingScreensProps) {
  const [currentScreen, setCurrentScreen] = useState(0);

  const handleNext = async () => {
    if (currentScreen < screens.length - 1) {
      setCurrentScreen(currentScreen + 1);
    } else {
      await onComplete();
    }
  };

  const handleSkip = async () => {
    await onComplete();
  };

  const screen = screens[currentScreen];
  const isLastScreen = currentScreen === screens.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col safe-area-top safe-area-bottom">
      {/* Skip button */}
      <div className="flex justify-end p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkip}
          className="text-muted-foreground hover:text-foreground"
        >
          Skip
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Animated background gradient */}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-b opacity-50 transition-all duration-500",
            screen.color
          )}
        />

        {/* Icon/Emoji container */}
        <div className="relative z-10 mb-8">
          <div className="w-32 h-32 rounded-full bg-card border border-border flex items-center justify-center shadow-lg">
            <span className="text-6xl">{screen.emoji}</span>
          </div>
        </div>

        {/* Text content */}
        <div className="relative z-10 text-center max-w-sm">
          <h1 className="text-2xl font-display font-bold text-foreground mb-3">
            {screen.title}
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            {screen.description}
          </p>
        </div>
      </div>

      {/* Bottom section */}
      <div className="relative z-10 px-8 pb-8">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6">
          {screens.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentScreen(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                index === currentScreen
                  ? "w-6 bg-primary"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              aria-label={`Go to screen ${index + 1}`}
            />
          ))}
        </div>

        {/* Next/Get Started button */}
        <Button
          onClick={handleNext}
          className="w-full h-12 text-base font-medium"
          size="lg"
        >
          {isLastScreen ? (
            "Get Started"
          ) : (
            <>
              Next
              <ChevronRight className="w-5 h-5 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
