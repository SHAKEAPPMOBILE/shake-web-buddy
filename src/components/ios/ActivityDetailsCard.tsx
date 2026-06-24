import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface Activity {
  id: string;
  label: string;
  emoji: string;
  icon?: string;
  isProposePlan?: boolean;
}

interface City {
  name: string;
  country: string;
}

export interface ActivityDetailsCardProps {
  show: boolean;
  activity: Activity | null;
  dayName: string;
  time: string | null;
  joinCity: string;
  carouselJoinCount: number;
  maxGroupSize: number;
  hasNoVenue: boolean;
  /** Label for the primary confirm button. Defaults to "Yes!" */
  confirmLabel?: string;
  showCityChoices?: boolean;
  groupedCities?: Record<string, City[]>;
  isPremium?: boolean;
  /** Whether to show the "Join in a different city" link. Defaults to true. */
  showDifferentCity?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  onToggleCityChoices?: () => void;
  onSelectCity?: (cityName: string) => void;
  onUpgradeClick?: () => void;
}

export function ActivityDetailsCard({
  show,
  activity,
  dayName,
  time,
  joinCity,
  carouselJoinCount,
  maxGroupSize,
  hasNoVenue,
  confirmLabel,
  showCityChoices = false,
  groupedCities = {},
  isPremium = false,
  showDifferentCity = true,
  onConfirm,
  onClose,
  onToggleCityChoices,
  onSelectCity,
  onUpgradeClick,
}: ActivityDetailsCardProps) {
  const { t } = useTranslation();
  const primaryLabel = confirmLabel ?? t('home.yesBtn', 'Yes!');

  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-200",
        show ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      onClick={onClose}
    >
      <div className="w-full p-5 text-center space-y-3 bg-transparent border-0 shadow-none">
        <div className="w-24 h-24 mx-auto rounded-full bg-white shadow-lg flex items-center justify-center overflow-hidden">
          {activity?.icon ? (
            <img src={activity.icon} alt={activity.label} className="w-full h-full object-cover rounded-full" />
          ) : (
            <span className="text-5xl">{activity?.emoji}</span>
          )}
        </div>

        <p className="text-2xl font-display font-bold text-foreground">{activity?.label}</p>
        {!!dayName && <p className="text-xl font-semibold text-primary">{dayName}</p>}
        {!!time && <p className="text-lg font-semibold text-primary">{time}</p>}
        <p className="text-base text-muted-foreground">
          {t('activityDialog.inCity', 'in {{city}}', { city: joinCity })}
        </p>

        <div className="space-y-2 pt-1" onClick={(e) => e.stopPropagation()}>
          {/* BUG FIX: hasNoVenue must NEVER replace "Yes!" with "Propose a Plan".
              Joining an activity does not require a venue — the venue is just
              displayed as extra info. Routing to /propose-plan here was causing
              the carousel join to intermittently navigate to the create-plan flow
              whenever the venue data hadn't loaded or the city had no venue entry. */}
          {hasNoVenue && (
            // Log when hasNoVenue is true so we can track it in the console
            // (expression evaluates to null, renders nothing)
            (() => { console.log('[Carousel] hasNoVenue=true for', activity?.id, 'in', joinCity, '— still allowing join (venue not required to join)'); return null; })()
          )}
          <>
            {carouselJoinCount >= maxGroupSize && !activity?.isProposePlan ? (
              <button
                type="button"
                disabled
                className="w-full rounded-full px-4 py-2.5 text-white font-semibold bg-gray-400 cursor-not-allowed opacity-70"
              >
                Full
              </button>
            ) : (
              <button
                type="button"
                onClick={onConfirm}
                className="w-full rounded-full px-4 py-2.5 text-white font-semibold bg-[hsl(210,100%,50%)] hover:bg-[hsl(210,100%,45%)] transition-colors"
              >
                {primaryLabel}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full px-4 py-2.5 font-medium border border-border bg-background hover:bg-muted/60 transition-colors"
            >
              {t('home.humBtn', 'Hum!')}
            </button>
            {showDifferentCity && (
              <button
                type="button"
                onClick={() => {
                  if (!isPremium) {
                    onUpgradeClick?.();
                    return;
                  }
                  onToggleCityChoices?.();
                }}
                className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              >
                {t('activityDialog.joinDifferentCity', 'Join in a different city')}
              </button>
            )}
          </>
        </div>

        {showCityChoices && (
          <div className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-background p-2 text-left">
            {Object.entries(groupedCities).map(([region, cities]) => (
              cities.length > 0 && (
                <div key={region} className="mb-2 last:mb-0">
                  <p className="px-1 pb-1 text-[10px] font-semibold uppercase text-muted-foreground">{region}</p>
                  <div className="space-y-1">
                    {cities.map((city) => (
                      <button
                        key={city.name}
                        type="button"
                        onClick={() => onSelectCity?.(city.name)}
                        className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted transition-colors"
                      >
                        {city.name}, {city.country}
                      </button>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
