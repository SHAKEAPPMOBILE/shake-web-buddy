import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Calendar, MapPin, Instagram, Linkedin, Twitter } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { SayHiButton } from "./SayHiButton";
import { PrivateChatDialog } from "./PrivateChatDialog";
import { useGreetings } from "@/hooks/useGreetings";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string | null;
  avatarUrl: string | null;
}

interface ActivityJoin {
  id: string;
  activity_type: string;
  city: string;
  joined_at: string;
}

interface SocialLinks {
  instagram_url: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
}

const calculateAge = (birthDate: string): number => {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

const activityEmojis: Record<string, string> = {
  lunch: "🍽️",
  dinner: "🍝",
  drinks: "🍻",
  hike: "🥾",
};

export function UserProfileDialog({ 
  open, 
  onOpenChange, 
  userId, 
  userName, 
  avatarUrl 
}: UserProfileDialogProps) {
  const [activityHistory, setActivityHistory] = useState<ActivityJoin[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({ instagram_url: null, linkedin_url: null, twitter_url: null });
  const [userAge, setUserAge] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const { isMatched } = useGreetings();
  const isMobile = useIsMobile();
  
  const swipeHandlers = useSwipeToClose({
    onClose: () => onOpenChange(false),
    threshold: 80,
    enabled: isMobile,
  });

  useEffect(() => {
    if (!open || !userId) return;

    const fetchUserData = async () => {
      setIsLoading(true);
      try {
        // Fetch activity history
        const { data: activityData, error: activityError } = await supabase
          .from("activity_joins")
          .select("id, activity_type, city, joined_at")
          .eq("user_id", userId)
          .order("joined_at", { ascending: false })
          .limit(10);

        if (activityError) {
          console.error("Error fetching activity history:", activityError);
        } else {
          setActivityHistory(activityData || []);
        }

        // Fetch social links from profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("instagram_url, linkedin_url, twitter_url")
          .eq("user_id", userId)
          .maybeSingle();

        if (profileError) {
          console.error("Error fetching profile:", profileError);
        } else if (profileData) {
          setSocialLinks({
            instagram_url: profileData.instagram_url,
            linkedin_url: profileData.linkedin_url,
            twitter_url: profileData.twitter_url,
          });
        }

        // Fetch date of birth from profiles_private (only works if current user is viewing their own profile or via public age)
        // For now, we fetch it using service role or a function - but since profiles_private is RLS protected,
        // we'll need to expose age differently. Let's add the age to the public profile calculation
        const { data: privateData } = await supabase
          .from("profiles_private")
          .select("date_of_birth")
          .eq("user_id", userId)
          .maybeSingle();

        if (privateData?.date_of_birth) {
          setUserAge(calculateAge(privateData.date_of_birth));
        } else {
          setUserAge(null);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [open, userId]);

  const hasSocialLinks = socialLinks.instagram_url || socialLinks.linkedin_url || socialLinks.twitter_url;
  const matched = isMatched(userId);

  const handleMatch = () => {
    setShowChatDialog(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="sm:max-w-sm bg-card/95 backdrop-blur-xl border-border/50"
          {...(isMobile ? swipeHandlers : {})}
        >
          {isMobile && (
            <div className="flex justify-center py-2 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
          )}
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-display">User Profile</DialogTitle>
          </DialogHeader>

          {/* Avatar and Name */}
          <div className="flex flex-col items-center py-4">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border-4 border-border shadow-lg">
              {avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt={userName || "User"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-12 h-12 text-muted-foreground" />
              )}
            </div>
            <h3 className="mt-4 text-xl font-semibold text-foreground">
              {userName || "Shaker"}{userAge ? `, ${userAge}` : ''}
            </h3>
            
            {/* Location from most recent activity */}
            {activityHistory.length > 0 && (
              <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" />
                <span>{activityHistory[0].city}</span>
              </div>
            )}

            {/* Say Hi Button */}
            <div className="mt-4">
              <SayHiButton
                targetUserId={userId}
                targetUserName={userName}
                onMatch={handleMatch}
              />
            </div>

            {/* Social Links */}
            {hasSocialLinks && (
              <div className="flex items-center justify-center gap-3 mt-3">
                {socialLinks.instagram_url && (
                  <a
                    href={socialLinks.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center hover:scale-110 transition-transform"
                  >
                    <Instagram className="w-4 h-4 text-white" />
                  </a>
                )}
                {socialLinks.linkedin_url && (
                  <a
                    href={socialLinks.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center hover:scale-110 transition-transform"
                  >
                    <Linkedin className="w-4 h-4 text-white" />
                  </a>
                )}
                {socialLinks.twitter_url && (
                  <a
                    href={socialLinks.twitter_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-sky-500 flex items-center justify-center hover:scale-110 transition-transform"
                  >
                    <Twitter className="w-4 h-4 text-white" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Activity History */}
          <div className="border-t border-border/50 pt-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Recent Activity
            </h4>
            
            {isLoading ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : activityHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground/70 text-center py-4">
                No recent activity
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {activityHistory.map((activity) => (
                  <div 
                    key={activity.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                  >
                    <span className="text-lg">
                      {activityEmojis[activity.activity_type] || "📍"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground capitalize">
                        {activity.activity_type}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {activity.city}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {format(new Date(activity.joined_at), "MMM d")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <PrivateChatDialog
        open={showChatDialog}
        onOpenChange={setShowChatDialog}
        otherUserId={userId}
        otherUserName={userName}
        otherUserAvatar={avatarUrl}
      />
    </>
  );
}
