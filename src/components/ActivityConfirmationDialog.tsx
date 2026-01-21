import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect } from "react";
import { MapPin, Globe, ChevronRight, Calendar, CheckCircle2, Search } from "lucide-react";
import { SHAKE_CITIES, REGIONS } from "@/data/cities";
import { useAuth } from "@/contexts/AuthContext";
import { PremiumDialog } from "@/components/PremiumDialog";
import { SuperHumanIcon } from "@/components/SuperHumanIcon";
import { getActivityDay } from "@/data/activityTypes";

interface ActivityConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: { id: string; label: string; emoji: string } | null;
  currentCity: string;
  onConfirm: (city: string) => void;
  onExplore: () => void;
}

export function ActivityConfirmationDialog({
  open,
  onOpenChange,
  activity,
  currentCity,
  onConfirm,
  onExplore,
}: ActivityConfirmationDialogProps) {
  const { isPremium } = useAuth();
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  // Reset state when dialog opens or activity changes
  useEffect(() => {
    if (open) {
      setShowCityPicker(false);
      setSelectedCity(null);
    }
  }, [open, activity?.id]);

  if (!activity) return null;

  const activityDay = getActivityDay(activity.id);
  const displayCity = selectedCity || currentCity;

  const handleChangeCity = () => {
    if (!isPremium) {
      setShowPremiumDialog(true);
      return;
    }
    setShowCityPicker(true);
  };

  const handleSelectCity = (cityName: string) => {
    setSelectedCity(cityName);
    setShowCityPicker(false);
  };

  const groupedCities = REGIONS.reduce((acc, region) => {
    acc[region] = SHAKE_CITIES.filter(city => city.region === region && city.name !== displayCity);
    return acc;
  }, {} as Record<string, typeof SHAKE_CITIES>);

  // City picker view
  if (showCityPicker) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50 p-0 max-h-[80vh]">
          <div className="p-6 pb-4 border-b border-border/30">
            <button
              onClick={() => setShowCityPicker(false)}
              className="absolute top-4 left-4 p-2 rounded-full hover:bg-muted/50 transition-colors"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-white shadow-lg flex items-center justify-center">
                <span className="text-3xl">{activity.emoji}</span>
              </div>
              <h2 className="text-xl font-display font-bold">
                Select a city for {activity.label}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                As a Super-Human, you can join activities worldwide!
              </p>
            </div>
          </div>
          
          <ScrollArea className="max-h-[50vh] px-4 py-2">
            {Object.entries(groupedCities).map(([region, cities]) => (
              cities.length > 0 && (
                <div key={region} className="mb-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                    {region}
                  </h3>
                  <div className="space-y-1">
                    {cities.map((city) => (
                      <button
                        key={city.name}
                        onClick={() => handleSelectCity(city.name)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{city.name}</p>
                          <p className="text-xs text-muted-foreground">{city.country}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            ))}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  }

  // Main confirmation view
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50">
          <div className="flex flex-col items-center py-4 space-y-4">
            {/* Activity emoji */}
            <div className="w-20 h-20 rounded-full bg-white shadow-lg flex items-center justify-center animate-bounce-subtle">
              <span className="text-4xl">{activity.emoji}</span>
            </div>

            {/* Activity name and details */}
            <div className="text-center space-y-1.5">
              <p className="text-xl font-bold text-foreground">
                {activity.label}
              </p>
              {activityDay && (
                <div className="flex items-center justify-center gap-1.5 text-primary font-medium text-sm">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{activityDay}</span>
                </div>
              )}
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-sm">
                <MapPin className="w-3.5 h-3.5" />
                <span>in {displayCity}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="w-full space-y-2">
              <Button
                onClick={() => onConfirm(displayCity)}
                className="w-full h-9 text-sm font-semibold bg-[hsl(210,100%,50%)] hover:bg-[hsl(210,100%,45%)] text-white gap-1.5"
              >
                <CheckCircle2 className="w-3 h-3 text-white" />
                <span>Yes!</span>
              </Button>
              
              <Button
                onClick={onExplore}
                variant="outline"
                className="w-full h-9 text-sm font-medium gap-1.5"
              >
                <Search className="w-3 h-3 text-primary" />
                <span>Hum!</span>
              </Button>
            </div>

            {/* Change city option */}
            <button
              onClick={handleChangeCity}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
            >
              <Globe className="w-4 h-4" />
              <span>Join in a different city</span>
              {!isPremium && (
                <SuperHumanIcon className="w-4 h-4" />
              )}
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <PremiumDialog open={showPremiumDialog} onOpenChange={setShowPremiumDialog} />
    </>
  );
}
