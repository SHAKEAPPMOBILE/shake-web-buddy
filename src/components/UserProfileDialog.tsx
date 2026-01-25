import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Calendar, MapPin, Instagram, Linkedin, Twitter, Flag, X, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { SayHiButton } from "./SayHiButton";
import { PrivateChatDialog } from "./PrivateChatDialog";
import { ReportUserDialog } from "./ReportUserDialog";
import { useGreetings } from "@/hooks/useGreetings";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";
import { normalizeInstagramUrl, normalizeTwitterUrl } from "@/lib/social-utils";
import { getActivityEmoji } from "@/data/activityTypes";
import { LoadingSpinner } from "./LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useStatusVideo } from "@/hooks/useStatusVideo";
import { StatusVideoRecorder } from "./StatusVideoRecorder";
import { StatusVideoViewer } from "./StatusVideoViewer";
import { cn } from "@/lib/utils";

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
  nationality: string | null;
  occupation: string | null;
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

export function UserProfileDialog({ 
  open, 
  onOpenChange, 
  userId, 
  userName, 
  avatarUrl 
}: UserProfileDialogProps) {
  const [activityHistory, setActivityHistory] = useState<ActivityJoin[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({ instagram_url: null, linkedin_url: null, twitter_url: null, nationality: null, occupation: null });
  const [userAge, setUserAge] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showEnlargedAvatar, setShowEnlargedAvatar] = useState(false);
  const [showStatusRecorder, setShowStatusRecorder] = useState(false);
  const [showStatusViewer, setShowStatusViewer] = useState(false);
  const { isMatched } = useGreetings();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { statusVideo, hasActiveStatus } = useStatusVideo(userId);
  const [statusRefreshKey, setStatusRefreshKey] = useState(0);
  
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
          .select("instagram_url, linkedin_url, twitter_url, nationality, occupation")
          .eq("user_id", userId)
          .maybeSingle();

        if (profileError) {
          console.error("Error fetching profile:", profileError);
        } else if (profileData) {
          setSocialLinks({
            instagram_url: profileData.instagram_url,
            linkedin_url: profileData.linkedin_url,
            twitter_url: profileData.twitter_url,
            nationality: profileData.nationality,
            occupation: profileData.occupation,
          });
        }

        // Fetch user age using the secure RPC function
        const { data: ageData } = await supabase
          .rpc("get_user_age", { target_user_id: userId });

        if (ageData) {
          setUserAge(ageData);
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
  const isOwnProfile = user?.id === userId;

  const handleMatch = () => {
    setShowChatDialog(true);
  };

  const handleAvatarClick = () => {
    if (hasActiveStatus && statusVideo) {
      setShowStatusViewer(true);
    } else if (avatarUrl) {
      setShowEnlargedAvatar(true);
    }
  };

  const handleStatusVideoUploaded = () => {
    setStatusRefreshKey((prev) => prev + 1);
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
            {/* Avatar with Status Ring */}
            <div className="relative">
              <button
                onClick={handleAvatarClick}
                className={cn(
                  "w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden shadow-lg transition-transform hover:scale-105 cursor-pointer",
                  hasActiveStatus
                    ? "ring-4 ring-shake-green ring-offset-2 ring-offset-background"
                    : "border-4 border-border"
                )}
                disabled={!avatarUrl && !hasActiveStatus}
              >
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt={userName || "User"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-muted-foreground" />
                )}
              </button>

              {/* Status Camera Button - only for own profile */}
              {isOwnProfile && (
                <button
                  onClick={() => setShowStatusRecorder(true)}
                  className={cn(
                    "absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center border-2 border-background transition-colors",
                    hasActiveStatus
                      ? "bg-shake-green hover:bg-shake-green/90"
                      : "bg-primary hover:bg-primary/90"
                  )}
                >
                  <Video className="w-4 h-4 text-white" />
                </button>
              )}

              {/* Status indicator for other users */}
              {!isOwnProfile && hasActiveStatus && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-shake-green flex items-center justify-center border-2 border-background">
                  <Video className="w-3 h-3 text-white" />
                </div>
              )}
            </div>

            {/* Status label for own profile */}
            {isOwnProfile && (
              <button
                onClick={() => setShowStatusRecorder(true)}
                className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {hasActiveStatus ? "View Status" : "Add Status"}
              </button>
            )}

            <h3 className={cn("text-xl font-semibold text-foreground", isOwnProfile ? "mt-2" : "mt-4")}>
              {userName || "Shaker"}{userAge ? `, ${userAge}` : ''}
            </h3>
            
            {/* Nationality and Occupation */}
            {(socialLinks.nationality || socialLinks.occupation) && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                {socialLinks.nationality && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-sm">
                    <span>🌍</span>
                    <span className="text-foreground">{socialLinks.nationality}</span>
                  </span>
                )}
                {socialLinks.occupation && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-sm">
                    <span>💼</span>
                    <span className="text-foreground">{socialLinks.occupation}</span>
                  </span>
                )}
              </div>
            )}
            
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
                    href={normalizeInstagramUrl(socialLinks.instagram_url) || '/'}
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
                    href={normalizeTwitterUrl(socialLinks.twitter_url) || '/'}
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
                <LoadingSpinner size="md" />
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
                      {getActivityEmoji(activity.activity_type)}
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

          {/* Report User Button - only show for other users */}
          {!isOwnProfile && (
            <div className="border-t border-border/50 pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReportDialog(true)}
                className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <Flag className="w-4 h-4 mr-2" />
                Report User
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Enlarged Avatar Modal */}
      {showEnlargedAvatar && avatarUrl && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowEnlargedAvatar(false)}
        >
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setShowEnlargedAvatar(false);
          }}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
        >
          <X className="w-6 h-6 text-white" />
        </button>
          <img 
            src={avatarUrl} 
            alt={userName || "User"}
            className="max-w-[90vw] max-h-[90vh] rounded-2xl shadow-2xl object-contain animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <PrivateChatDialog
        open={showChatDialog}
        onOpenChange={setShowChatDialog}
        otherUserId={userId}
        otherUserName={userName}
        otherUserAvatar={avatarUrl}
      />

      <ReportUserDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        reportedUserId={userId}
        reportedUserName={userName}
      />

      {/* Status Video Recorder - only for own profile */}
      {isOwnProfile && user && (
        <StatusVideoRecorder
          open={showStatusRecorder}
          onOpenChange={setShowStatusRecorder}
          userId={user.id}
          existingVideoUrl={hasActiveStatus ? statusVideo?.video_url : null}
          onVideoUploaded={handleStatusVideoUploaded}
        />
      )}

      {/* Status Video Viewer - for viewing other users' status */}
      {statusVideo && (
        <StatusVideoViewer
          open={showStatusViewer}
          onOpenChange={setShowStatusViewer}
          videoUrl={statusVideo.video_url}
          userName={userName || undefined}
        />
      )}
    </>
  );
}
