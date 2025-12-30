import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCity } from "@/contexts/CityContext";
import { useNavigate } from "react-router-dom";
import { MyActivitiesDialog } from "../MyActivitiesDialog";
import { GroupChatDialog } from "../GroupChatDialog";
import { PlanGroupChatDialog } from "../PlanGroupChatDialog";
import { useActivityJoins } from "@/hooks/useActivityJoins";
import { useUserActivities, type UserActivity } from "@/hooks/useUserActivities";
import { supabase } from "@/integrations/supabase/client";

export function ChatTab() {
  const { user } = useAuth();
  const { selectedCity } = useCity();
  const navigate = useNavigate();
  const [showMyActivitiesDialog, setShowMyActivitiesDialog] = useState(true);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [showPlanChatDialog, setShowPlanChatDialog] = useState(false);
  const [selectedChatActivity, setSelectedChatActivity] = useState<{ activityType: string; city: string } | null>(null);
  const [selectedPlanActivity, setSelectedPlanActivity] = useState<UserActivity | null>(null);
  const { getActivityJoinCount } = useActivityJoins(selectedCity);
  const { fetchActivities: refetchCityPlans } = useUserActivities(selectedCity);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <MessageSquare className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-display font-bold mb-2">Sign in to chat</h2>
        <p className="text-muted-foreground mb-6">
          Join activities and connect with others
        </p>
        <button
          onClick={() => navigate("/auth")}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium"
        >
          Sign In
        </button>
      </div>
    );
  }

  const handleSelectActivityFromList = async (selection: { activityType: string; city: string; activityId?: string }) => {
    setShowMyActivitiesDialog(false);

    if (selection.activityId) {
      const { data: plan, error } = await supabase
        .from("user_activities")
        .select("*")
        .eq("id", selection.activityId)
        .maybeSingle();

      if (error || !plan) {
        setSelectedChatActivity({ activityType: selection.activityType, city: selection.city });
        setShowChatDialog(true);
        return;
      }

      await refetchCityPlans();
      setSelectedPlanActivity(plan as unknown as UserActivity);
      setShowPlanChatDialog(true);
      return;
    }

    setSelectedChatActivity({ activityType: selection.activityType, city: selection.city });
    setShowChatDialog(true);
  };

  const handleBackToActivities = () => {
    setShowChatDialog(false);
    setShowPlanChatDialog(false);
    setSelectedPlanActivity(null);
    setShowMyActivitiesDialog(true);
  };

  return (
    <div className="flex flex-col h-full">
      <MyActivitiesDialog
        open={showMyActivitiesDialog}
        onOpenChange={setShowMyActivitiesDialog}
        onSelectActivity={handleSelectActivityFromList}
      />

      {selectedChatActivity && (
        <GroupChatDialog
          open={showChatDialog}
          onOpenChange={setShowChatDialog}
          activityType={selectedChatActivity.activityType}
          onBack={handleBackToActivities}
          attendeeCount={getActivityJoinCount(selectedChatActivity.activityType)}
          city={selectedChatActivity.city}
        />
      )}

      {selectedPlanActivity && (
        <PlanGroupChatDialog
          open={showPlanChatDialog}
          onOpenChange={setShowPlanChatDialog}
          activity={selectedPlanActivity}
          onBack={handleBackToActivities}
        />
      )}
    </div>
  );
}
