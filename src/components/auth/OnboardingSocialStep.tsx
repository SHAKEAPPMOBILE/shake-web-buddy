import { useState, useMemo } from "react";
import { Instagram, Linkedin, Twitter, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

type SocialPlatform = "instagram" | "linkedin" | "twitter";

interface OnboardingSocialStepProps {
  instagramUrl: string;
  linkedinUrl: string;
  twitterUrl: string;
  onChangeInstagram: (value: string) => void;
  onChangeLinkedin: (value: string) => void;
  onChangeTwitter: (value: string) => void;
  onDone: () => void;
  onSkip: () => void;
  isSaving?: boolean;
}

/**
 * Chat-flow-style social-links step for the signup wizard — same visual
 * language as OnboardingInterestsStep / ProposePlanPage. Tapping a platform
 * icon switches which URL the single composer input is bound to; the
 * placeholder text updates to match ("paste your Instagram link here", …).
 */
export function OnboardingSocialStep({
  instagramUrl,
  linkedinUrl,
  twitterUrl,
  onChangeInstagram,
  onChangeLinkedin,
  onChangeTwitter,
  onDone,
  onSkip,
  isSaving = false,
}: OnboardingSocialStepProps) {
  const [activePlatform, setActivePlatform] = useState<SocialPlatform | null>(null);

  const platforms: { id: SocialPlatform; icon: typeof Instagram; label: string; value: string; placeholder: string }[] = useMemo(
    () => [
      { id: "instagram", icon: Instagram, label: "Instagram", value: instagramUrl, placeholder: "Paste your Instagram link here" },
      { id: "twitter", icon: Twitter, label: "X", value: twitterUrl, placeholder: "Paste your X link here" },
      { id: "linkedin", icon: Linkedin, label: "LinkedIn", value: linkedinUrl, placeholder: "Paste your LinkedIn link here" },
    ],
    [instagramUrl, twitterUrl, linkedinUrl]
  );

  const activeValue =
    activePlatform === "instagram" ? instagramUrl :
    activePlatform === "linkedin" ? linkedinUrl :
    activePlatform === "twitter" ? twitterUrl : "";

  const activePlaceholder =
    activePlatform === "instagram" ? "Paste your Instagram link here" :
    activePlatform === "linkedin" ? "Paste your LinkedIn link here" :
    activePlatform === "twitter" ? "Paste your X link here" :
    "Tap an icon above ↑";

  const handleActiveChange = (value: string) => {
    if (activePlatform === "instagram") onChangeInstagram(value);
    else if (activePlatform === "linkedin") onChangeLinkedin(value);
    else if (activePlatform === "twitter") onChangeTwitter(value);
  };

  return (
    <div className="space-y-6">
      {/* Platform icons */}
      <div className="flex gap-3">
        {platforms.map(({ id, icon: Icon, label, value }) => {
          const isActive = id === activePlatform;
          const isFilled = value.trim().length > 0;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActivePlatform(id)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-colors",
                isActive
                  ? "bg-black text-white border-black"
                  : isFilled
                  ? "bg-black/5 text-foreground border-black/20"
                  : "bg-background text-foreground border-border hover:border-black/40"
              )}
              aria-label={label}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Composer — bound to whichever platform is active */}
      <div className="flex items-center gap-3">
        <input
          value={activeValue}
          onChange={(e) => handleActiveChange(e.target.value)}
          disabled={!activePlatform}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onDone(); } }}
          placeholder={activePlaceholder}
          className="flex-1 h-16 rounded-2xl border border-border bg-muted/60 px-5 text-base focus:outline-none focus:ring-1 focus:ring-black/20 focus:border-black/20 placeholder:text-muted-foreground disabled:opacity-60"
        />
        <button
          type="button"
          onClick={onDone}
          disabled={isSaving}
          className="w-14 h-14 rounded-full flex items-center justify-center text-white shrink-0 transition-opacity hover:opacity-90 bg-black disabled:opacity-50"
          aria-label="Done"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      </div>

      <button
        type="button"
        onClick={onSkip}
        disabled={isSaving}
        className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1 text-center disabled:opacity-50"
      >
        Skip for now
      </button>
    </div>
  );
}
