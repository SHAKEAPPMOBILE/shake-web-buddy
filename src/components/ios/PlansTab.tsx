import { useState } from "react";
import { MapPin, Calendar, Users } from "lucide-react";
import { useCity } from "@/contexts/CityContext";
import { useUserActivities } from "@/hooks/useUserActivities";
import { PlansMapDialog } from "../PlansMapDialog";
import { format } from "date-fns";
import { ACTIVITY_TYPES } from "@/data/activityTypes";

export function PlansTab() {
  const { selectedCity } = useCity();
  const { activities, isLoading } = useUserActivities(selectedCity);
  const [showMap, setShowMap] = useState(false);

  const getActivityEmoji = (type: string) => {
    const activity = ACTIVITY_TYPES.find(a => a.id === type);
    return activity?.emoji || "📍";
  };

  const getActivityLabel = (type: string) => {
    const activity = ACTIVITY_TYPES.find(a => a.id === type);
    return activity?.label || type;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-lg font-display font-bold">Plans in {selectedCity}</h2>
        <button
          onClick={() => setShowMap(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium"
        >
          <MapPin className="w-4 h-4" />
          Map View
        </button>
      </div>

      {/* Plans List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No plans yet in {selectedCity}</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Shake to create one!</p>
          </div>
        ) : (
          activities.map((plan) => (
            <div
              key={plan.id}
              className="bg-card border border-border rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">
                  {getActivityEmoji(plan.activity_type)}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">
                    {getActivityLabel(plan.activity_type)}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(plan.scheduled_for), "MMM d, h:mm a")}
                    </span>
                  </div>
                </div>
              </div>
              {plan.participant_count && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  <span>{plan.participant_count} joined</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <PlansMapDialog 
        open={showMap} 
        onOpenChange={setShowMap} 
        city={selectedCity} 
      />
    </div>
  );
}
