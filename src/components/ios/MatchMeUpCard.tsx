import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export interface MatchedProfile {
  user_id: string;
  name: string;
  avatar_url: string | null;
  sharedInterests: string[];
}

export interface MatchMeUpCardProps {
  show: boolean;
  status: "loading" | "found" | "none";
  profile: MatchedProfile | null;
  joinCity: string;
  onSayHi: () => void;
  onClose: () => void;
}

/**
 * Same visual shell as ActivityDetailsCard (absolute inset-0, centered
 * column, no background of its own — see the bleed-through fix there for
 * why) but showing a matched person instead of an activity: their photo,
 * name, and shared interests, with "Say hi!" / "Hum!" in place of "Yes!" /
 * "Hum!". Kept as its own component rather than overloading
 * ActivityDetailsCard's prop contract (capacity, venue, city-switcher —
 * none of which apply here) with match-specific special cases.
 */
export function MatchMeUpCard({ show, status, profile, joinCity, onSayHi, onClose }: MatchMeUpCardProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center",
        show ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      onClick={onClose}
    >
      {status === "loading" && (
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-base text-muted-foreground">
            {t("home.findingMatch", "Finding your match...")}
          </p>
        </div>
      )}

      {status === "none" && (
        <div className="w-full p-5 text-center space-y-4" onClick={(e) => e.stopPropagation()}>
          <p className="text-lg font-semibold text-foreground">
            {t("home.noMatchFound", "No matched users at this time, try going to a plan")}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full px-4 py-2.5 font-medium border border-border bg-background hover:bg-muted/60 transition-colors"
          >
            {t("home.humBtn", "Hum!")}
          </button>
        </div>
      )}

      {status === "found" && profile && (
        <div className="w-full p-5 text-center space-y-3">
          <div className="w-24 h-24 mx-auto rounded-full bg-white shadow-lg flex items-center justify-center overflow-hidden">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover rounded-full" />
            ) : (
              <span className="text-3xl font-semibold text-foreground">
                {profile.name?.charAt(0)?.toUpperCase() || "?"}
              </span>
            )}
          </div>

          <p className="text-2xl font-display font-bold text-foreground">{profile.name}</p>
          <p className="text-xl font-semibold text-primary">
            {t("home.sharedInterestsCount", "{{count}} shared interests", { count: profile.sharedInterests.length })}
          </p>
          {profile.sharedInterests.length > 0 && (
            <p className="text-base font-semibold text-foreground">{profile.sharedInterests.join(", ")}</p>
          )}
          <p className="text-base text-muted-foreground">
            {t("activityDialog.inCity", "in {{city}}", { city: joinCity })}
          </p>

          <div className="space-y-2 pt-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={onSayHi}
              className="w-full rounded-full px-4 py-2.5 text-white font-semibold bg-[hsl(210,100%,50%)] hover:bg-[hsl(210,100%,45%)] transition-colors"
            >
              {t("home.sayHiBtn", "Say hi!")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full px-4 py-2.5 font-medium border border-border bg-background hover:bg-muted/60 transition-colors"
            >
              {t("home.humBtn", "Hum!")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
