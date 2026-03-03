import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Users, User, BellOff, Bell, LogOut, Globe, MapPin, Trash2, Plane } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfiles } from "@/hooks/useUserProfiles";
import { useActivityMute } from "@/hooks/useActivityMute";
import { useActivityJoins } from "@/hooks/useActivityJoins";
import { useOnlinePresence } from "@/hooks/useOnlinePresence";
import { toast } from "sonner";
import { playNotificationSound } from "@/lib/notification-sound";
import { PremiumDialog } from "@/components/PremiumDialog";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { ParticipantsListDialog } from "@/components/ParticipantsListDialog";
import { useActivityVenue } from "@/contexts/VenueContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";
import { useTextMessageLimit } from "@/hooks/useTextMessageLimit";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { LoadingSpinner } from "./LoadingSpinner";
import { useTranslation } from "react-i18next";
import { VenueSuggestionCarousel } from "./VenueSuggestionCarousel";
import { DbVenue } from "@/hooks/useDatabaseVenues";
interface GroupChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityType: string;
  onBack: () => void;
  onLeaveActivity?: () => void;
  attendeeCount?: number;
  city?: string;
  homeCity?: string;
}

interface Message {
  id: string;
  user_id: string;
  activity_type: string;
  city: string;
  message: string;
  created_at: string;
}

import { getActivityEmoji, getActivityDay, getNextOccurrenceDate } from "@/data/activityTypes";
import { getTranslatedActivityLabel, getTranslatedActivityDay } from "@/lib/activity-translations";

// Helper function to get activity-specific suggestions using translations
function useActivitySuggestions(activityType: string) {
  const { t } = useTranslation();
  
  return useMemo(() => {
    const defaultSuggestions = [
      t('chat.suggestions.whatTime', 'What time works best?'),
      t('chat.suggestions.whereMeet', 'Where should we meet?'),
      t('chat.suggestions.countMeIn', 'Count me in!'),
      t('chat.suggestions.seeYouThere', 'See you there! 👋'),
      t('chat.suggestions.runningLate', "I'm running late!"),
      t('chat.suggestions.onMyWay', 'On my way! 🏃'),
    ];

    const activitySuggestions: Record<string, string[]> = {
      lunch: defaultSuggestions,
      dinner: [
        t('chat.suggestions.whatCuisine', 'What cuisine are we feeling?'),
        t('chat.suggestions.makeReservation', 'Should we make a reservation?'),
        t('chat.suggestions.countMeIn', 'Count me in!'),
        t('chat.suggestions.seeYouThere', 'See you there! 👋'),
        t('chat.suggestions.runningLate', "I'm running late!"),
        t('chat.suggestions.whereMeet', 'Where should we meet?'),
      ],
      drinks: [
        t('chat.suggestions.happyHour', "Who's ready for happy hour? 🍻"),
        t('chat.suggestions.whatTimeMeeting', 'What time are we meeting up?'),
        t('chat.suggestions.barSuggestions', 'Any bar suggestions?'),
        t('chat.suggestions.countMeIn', 'Count me in!'),
        t('chat.suggestions.seeYouThere', 'See you there! 👋'),
        t('chat.suggestions.runningLate', "I'm running late!"),
        t('chat.suggestions.onMyWay', 'On my way! 🏃'),
      ],
      hike: [
        t('chat.suggestions.readyForTrail', 'Morning everyone! Ready to hit the trail?'),
        t('chat.suggestions.meetingPoint', "Where's the meeting point?"),
        t('chat.suggestions.whatToBring', 'What should I bring?'),
        t('chat.suggestions.countMeIn', 'Count me in!'),
        t('chat.suggestions.seeYouThere', 'See you there! 👋'),
        t('chat.suggestions.runningLate', "I'm running late!"),
        t('chat.suggestions.onMyWay', 'On my way! 🏃'),
      ],
      surf: [
        t('chat.suggestions.waveForecast', "What's the wave forecast? 🌊"),
        t('chat.suggestions.whichBeach', 'Which beach are we hitting?'),
        t('chat.suggestions.countMeIn', 'Count me in!'),
        t('chat.suggestions.seeYouThere', 'See you there! 👋'),
        t('chat.suggestions.onMyWay', 'On my way! 🏃'),
      ],
      run: [
        t('chat.suggestions.whatPace', 'What pace are we thinking? 🏃'),
        t('chat.suggestions.startingPoint', "Where's the starting point?"),
        t('chat.suggestions.countMeIn', 'Count me in!'),
        t('chat.suggestions.seeYouThere', 'See you there! 👋'),
        t('chat.suggestions.onMyWay', 'On my way!'),
      ],
      "co-working": [
        t('chat.suggestions.whichCafe', 'Which cafe/space are we at? ☕'),
        t('chat.suggestions.whatTimeStarting', 'What time are we starting?'),
        t('chat.suggestions.countMeIn', 'Count me in!'),
        t('chat.suggestions.seeYouThere', 'See you there! 👋'),
        t('chat.suggestions.onMyWay', 'On my way! 💻'),
      ],
      sunset: [
        t('chat.suggestions.sunsetSpot', 'Best spot for sunset views? 🌅'),
        t('chat.suggestions.whatTimeMeet', 'What time should we meet?'),
        t('chat.suggestions.countMeIn', 'Count me in!'),
        t('chat.suggestions.seeYouThere', 'See you there! 👋'),
      ],
      dance: [
        t('chat.suggestions.whichClub', 'Which club are we hitting? 💃'),
        t('chat.suggestions.whatTimeStart', 'What time does it start?'),
        t('chat.suggestions.countMeIn', 'Count me in!'),
        t('chat.suggestions.seeYouThere', 'See you there! 👋'),
      ],
    };

    return activitySuggestions[activityType] || defaultSuggestions;
  }, [activityType, t]);
}

export function GroupChatDialog({ 
  open, 
  onOpenChange, 
  activityType, 
  onBack, 
  onLeaveActivity,
  attendeeCount = 0,
  city = "New York City",
  homeCity,
}: GroupChatDialogProps) {
  const { t } = useTranslation();
  const isCrossCity = homeCity && city !== homeCity;
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [showParticipantsList, setShowParticipantsList] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState<{
    userId: string;
    userName: string | null;
    avatarUrl: string | null;
  } | null>(null);
  const [participants, setParticipants] = useState<{ user_id: string; name: string | null; avatar_url: string | null }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user, isPremium } = useAuth();
  const { isMuted, toggleMute } = useActivityMute(city, activityType);
  const { leaveActivity } = useActivityJoins(city);
  const { onlineCount } = useOnlinePresence();
  const isMobile = useIsMobile();
  const hasVenues = activityType === "lunch" || activityType === "dinner" || activityType === "brunch" || activityType === "drinks";
  const [showVenueSuggestions, setShowVenueSuggestions] = useState(hasVenues);
  
  const { canSendText, addCharacters } = useTextMessageLimit();
  
  // Get translated suggestions for this activity type
  const chatSuggestions = useActivitySuggestions(activityType);
  
  // Get user's own profile for venue suggestion messages
  const { profiles: ownProfiles } = useUserProfiles(user ? [user.id] : []);
  const ownProfile = user ? ownProfiles[user.id] : null;
  
  const swipeHandlers = useSwipeToClose({
    onClose: () => onOpenChange(false),
    threshold: 80,
    enabled: isMobile,
  });
  
  // Get unique user IDs from messages for profile fetching
  const userIds = useMemo(() => {
    return [...new Set(messages.map((msg) => msg.user_id))];
  }, [messages]);
  
  const { profiles } = useUserProfiles(userIds);

  // Fetch participants when dialog opens
  useEffect(() => {
    if (!open) return;

    const fetchParticipants = async () => {
      const { data: joins, error: joinsError } = await supabase
        .from("activity_joins")
        .select("user_id")
        .eq("activity_type", activityType)
        .eq("city", city)
        .gt("expires_at", new Date().toISOString());

      if (joinsError || !joins?.length) {
        setParticipants([]);
        return;
      }

      const uniqueUserIds = [...new Set(joins.map((j) => j.user_id))];

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url")
        .in("user_id", uniqueUserIds);

      const participantsList = uniqueUserIds.map((userId) => {
        const profile = profilesData?.find((p) => p.user_id === userId);
        return {
          user_id: userId,
          name: profile?.name || null,
          avatar_url: profile?.avatar_url || null,
        };
      });

      setParticipants(participantsList);
    };

    fetchParticipants();
  }, [open, activityType, city]);

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Clear messages when activity type changes
  useEffect(() => {
    setMessages([]);
  }, [activityType, city]);

  // Fetch messages when dialog opens
  useEffect(() => {
    if (!open || !activityType) return;

    const fetchMessages = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("activity_messages")
        .select("*")
        .eq("activity_type", activityType)
        .eq("city", city)
        .gte("created_at", today.toISOString())
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
        return;
      }

      setMessages(data || []);
    };

    fetchMessages();

    // Subscribe to message changes with a unique channel name per activity/city
    const channelName = `activity-messages-${city}-${activityType}`.replace(/\s+/g, '-').toLowerCase();
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_messages',
        },
        (payload) => {
          const newMessage = payload.new as Message;
          if (newMessage.activity_type === activityType && newMessage.city === city) {
            setMessages(prev => [...prev, newMessage]);
            // Play notification sound for messages from others (if not muted)
            if (newMessage.user_id !== user?.id && !isMuted) {
              playNotificationSound();
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'activity_messages',
        },
        (payload) => {
          const deletedMessage = payload.old as Message;
          if (deletedMessage.activity_type === activityType && deletedMessage.city === city) {
            setMessages(prev => prev.filter(msg => msg.id !== deletedMessage.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, activityType, city, isMuted]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    // Handle text message
    if (!message.trim() || !user) {
      if (!user) {
        toast.error("Please sign in to send messages");
      }
      return;
    }

    // Check text character limit for free users
    if (!isPremium && !canSendText) {
      setShowPremiumDialog(true);
      toast.error("You've reached the 100K character limit. Upgrade to Super-Human for unlimited messaging!");
      return;
    }

    setIsSending(true);

    const { error } = await supabase
      .from("activity_messages")
      .insert({
        user_id: user.id,
        activity_type: activityType,
        city: city,
        message: message.trim(),
      });

    if (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } else {
      addCharacters(message.trim().length);
      setMessage("");
    }

    setIsSending(false);
  };

  const handleDeleteMessage = async (messageId: string) => {
    const { error } = await supabase
      .from("activity_messages")
      .delete()
      .eq("id", messageId);

    if (error) {
      console.error("Error deleting message:", error);
      toast.error("Failed to delete message");
    } else {
      toast.success("Message deleted");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleLeaveActivity = async () => {
    const success = await leaveActivity(activityType);
    if (success) {
      onLeaveActivity?.();
      onOpenChange(false);
    }
  };

  const handleMuteToggle = async () => {
    const success = await toggleMute();
    if (success) {
      toast.success(isMuted ? "Notifications unmuted" : "Notifications muted");
    }
  };

  const handleSuggestVenue = async (venue: DbVenue) => {
    if (!user) {
      toast.error("Please sign in to suggest venues");
      return;
    }

    const userName = ownProfile?.name || "Someone";
    const suggestionMessage = `📍 ${userName} suggested: ${venue.name}, ${venue.address}`;

    setIsSending(true);
    const { error } = await supabase
      .from("activity_messages")
      .insert({
        user_id: user.id,
        activity_type: activityType,
        city: city,
        message: suggestionMessage,
      });

    if (error) {
      console.error("Error sending venue suggestion:", error);
      toast.error("Failed to suggest venue");
    } else {
      addCharacters(suggestionMessage.length);
      setShowVenueSuggestions(false);
      toast.success(`Suggested ${venue.name}!`);
    }
    setIsSending(false);
  };

  const title = `${getTranslatedActivityLabel(t, activityType)} ${getActivityEmoji(activityType)}`;
  const { location, mapsUrl } = useActivityVenue(city, activityType);
  const formattedDate = format(currentTime, "EEEE, MMMM d");
  const formattedTime = format(currentTime, "h:mm a");

  // Only show attendees if there are any today
  const showAttendees = attendeeCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={`sm:max-w-lg flex flex-col p-0 relative bg-[#06060a] overflow-hidden backdrop-blur-xl border-white/10 [&>button.dialog-close]:text-white transition-all duration-300 ${isChatExpanded ? 'h-[600px]' : 'h-auto'}`}
        {...(isMobile ? swipeHandlers : {})}
      >
        <div className="absolute inset-0 pointer-events-none z-0" style={{ background: 'radial-gradient(ellipse 80% 60% at 20% 10%, rgba(124,92,252,0.22) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(240,90,126,0.18) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 60% 20%, rgba(240,192,96,0.12) 0%, transparent 50%)' }} aria-hidden />
        {isMobile && (
          <div className="flex justify-center py-2 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
        )}
        {/* Welcome view when not expanded - centered like confirmation dialog */}
        {!isChatExpanded ? (
          <div className="flex flex-col items-center py-6 px-4 space-y-4">
            {/* Activity emoji - minimal */}
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <span className="text-3xl">{getActivityEmoji(activityType)}</span>
            </div>

            {/* Activity name and details */}
            <div className="text-center space-y-1">
              <p className="text-lg font-semibold text-white">
                {getTranslatedActivityLabel(t, activityType)}
              </p>
              {getTranslatedActivityDay(t, activityType) && (
                <p className="text-sm text-purple-300/90">
                  {getTranslatedActivityDay(t, activityType)}
                </p>
              )}
              {isCrossCity && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-purple-300/90">
                  <Plane className="w-3 h-3" />
                  <span>in {city}</span>
                </div>
              )}
              {(activityType === "lunch" || activityType === "dinner" || activityType === "brunch" || activityType === "drinks") && (
                <div className="mt-1">
                  {mapsUrl ? (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-purple-300/90 hover:text-purple-200 flex items-center justify-center gap-1"
                    >
                      <MapPin className="w-3 h-3" />
                      {location}
                    </a>
                  ) : (
                    <span className="text-xs text-white/50 flex items-center justify-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {location}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Attendees */}
            {showAttendees ? (
              <button
                onClick={() => setShowParticipantsList(true)}
                className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
              >
                <div className="flex -space-x-2">
                  {participants.slice(0, 4).map((p) => (
                    <div
                      key={p.user_id}
                      className="w-7 h-7 rounded-full bg-white/10 border border-white/20 overflow-hidden"
                    >
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-3.5 h-3.5 text-white/40" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <span>{t('chat.joinedToday', '{{count}} joined today', { count: attendeeCount })}</span>
              </button>
            ) : (
              <p className="text-sm text-white/50">
                {t('chat.beFirstToJoin', 'Be the first to join today!')}
              </p>
            )}

            <div className="flex flex-col gap-2 w-full max-w-xs">
              <Button
                onClick={() => setIsChatExpanded(true)}
                className="w-full bg-[#7c5cfc] hover:bg-[#8b6dfc] text-white border-0"
              >
                {t('chat.openChat', 'Open Chat')}
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMuteToggle}
                  className="flex-1 text-white/70 hover:text-white hover:bg-white/10"
                >
                  {isMuted ? <BellOff className="w-4 h-4 mr-1" /> : <Bell className="w-4 h-4 mr-1" />}
                  {isMuted ? t('chat.unmute', 'Unmute') : t('chat.mute', 'Mute')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLeaveActivity}
                  className="flex-1 text-white/60 hover:text-red-400 hover:bg-white/5"
                >
                  <LogOut className="w-4 h-4 mr-1" />
                  {t('chat.leave', 'Leave')}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Expanded Chat Header - minimal */}
            <div className="flex items-center justify-between px-4 py-2.5 shrink-0 border-b border-white/5">
              <div className="flex items-center gap-2">
                <button onClick={() => setIsChatExpanded(false)} className="p-1.5 text-white/80 hover:text-white" title="Back">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h3 className="font-medium text-white text-sm">{title}</h3>
                {isCrossCity && (
                  <span className="text-xs text-purple-300/80 flex items-center gap-0.5">
                    <Plane className="w-3 h-3" /> {city}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {showAttendees && (
                  <button
                    onClick={() => setShowParticipantsList(true)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-white/70 hover:text-white rounded-full hover:bg-white/5"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>{attendeeCount}</span>
                  </button>
                )}
                {(activityType === "lunch" || activityType === "dinner" || activityType === "brunch" || activityType === "drinks") && (
                  <button
                    onClick={() => setShowVenueSuggestions(!showVenueSuggestions)}
                    className={`p-1.5 rounded-md ${showVenueSuggestions ? 'text-purple-300 bg-purple-500/20' : 'text-white/60 hover:text-white'}`}
                    title={t('chat.suggestVenue', 'Suggest a venue')}
                  >
                    <MapPin className="w-4 h-4" />
                  </button>
                )}
                <button onClick={handleMuteToggle} className="p-1.5 text-white/60 hover:text-white rounded-md" title={isMuted ? "Unmute" : "Mute"}>
                  {isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Venue Suggestion Carousel */}
            {showVenueSuggestions && (
              <VenueSuggestionCarousel
                city={city}
                activityType={activityType}
                onSuggestVenue={handleSuggestVenue}
              />
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-white/40">
                  <p className="text-center text-sm">
                    {t('chat.startTheConversation', 'Start the conversation!')}<br />
                    <span className="text-xs">{t('chat.messagesFromToday', 'Messages from today will appear here.')}</span>
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwnMessage = msg.user_id === user?.id;
                  const profile = profiles[msg.user_id];
                  const displayName = isOwnMessage 
                    ? t('chat.you', 'You') 
                    : profile?.name || t('chat.shaker', 'Shaker');
                  const avatarUrl = profile?.avatar_url;
                  
                  return (
                    <div 
                      key={msg.id} 
                      className={`group flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''} ${!user ? 'blur-sm select-none pointer-events-none' : ''}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-white/5 shrink-0 overflow-hidden border border-white/10">
                        {avatarUrl ? (
                          <img 
                            src={avatarUrl} 
                            alt={displayName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-4 h-4 text-white/40" />
                        )}
                      </div>
                      <div className={`flex-1 max-w-[70%] ${isOwnMessage ? 'text-right' : ''}`}>
                        <div className={`flex items-baseline gap-2 ${isOwnMessage ? 'justify-end' : ''}`}>
                          <button 
                            className={`font-semibold text-sm text-white ${!isOwnMessage ? 'hover:text-purple-300 cursor-pointer' : ''}`}
                            onClick={() => {
                              if (!isOwnMessage) {
                                setSelectedUserProfile({
                                  userId: msg.user_id,
                                  userName: profile?.name || null,
                                  avatarUrl: profile?.avatar_url || null,
                                });
                              }
                            }}
                            disabled={isOwnMessage}
                          >
                            {displayName}
                          </button>
                          <span className="text-xs text-white/35">
                            {format(new Date(msg.created_at), 'h:mm a')}
                          </span>
                        </div>
                        <div className={`flex items-center gap-1 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                          <div className={`text-sm mt-0.5 px-3 py-2 rounded-xl inline-block ${
                            isOwnMessage 
                              ? 'bg-[#7c5cfc] text-white'
                              : 'bg-white/10 text-white border border-white/10'
                          }`}>
                            <span>{msg.message}</span>
                          </div>
                          {isOwnMessage && (
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100 p-1 text-white/50 hover:text-red-400 transition-all"
                              title="Delete message"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {user && !message.trim() && (
              <div className="px-4 pb-2 overflow-x-auto scrollbar-hide">
                <div className="flex gap-1.5 w-max">
                  {chatSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => setMessage(suggestion)}
                      className="text-xs px-2.5 py-1 rounded-full bg-white/5 text-purple-200 hover:bg-white/10 border border-white/10 whitespace-nowrap shrink-0"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3 border-t border-white/5">
              <div className="flex items-center gap-2">
                {showAttendees && participants.length > 0 && (
                  <div className="flex -space-x-2">
                    {participants.slice(0, 3).map((p) => (
                      <div
                        key={p.user_id}
                        className="w-6 h-6 rounded-full bg-white/5 border border-white/10 overflow-hidden shrink-0"
                        title={p.name || 'Participant'}
                      >
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="w-2.5 h-2.5 text-white/40" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <Input
                  placeholder={canSendText ? t('chat.typeMessage', 'Type a message...') : t('chat.characterLimitReached', 'Character limit reached')}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1 bg-white/5 border-white/10 focus-visible:ring-[#7c5cfc]/50 text-white placeholder:text-white/40 min-h-9"
                  disabled={isSending || (!isPremium && !canSendText)}
                />
                <Button
                  size="icon"
                  onClick={handleSendMessage}
                  disabled={isSending || !message.trim()}
                  className="shrink-0 h-9 w-9 bg-[#7c5cfc] hover:bg-[#8b6dfc] text-white border-0"
                >
                  {isSending ? <LoadingSpinner size="sm" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Premium Dialog */}
        <PremiumDialog open={showPremiumDialog} onOpenChange={setShowPremiumDialog} />

        {/* User Profile Dialog */}
        <UserProfileDialog 
          open={!!selectedUserProfile} 
          onOpenChange={(open) => !open && setSelectedUserProfile(null)}
          userId={selectedUserProfile?.userId || ""}
          userName={selectedUserProfile?.userName || null}
          avatarUrl={selectedUserProfile?.avatarUrl || null}
        />

        {/* Participants List Dialog */}
        <ParticipantsListDialog
          open={showParticipantsList}
          onOpenChange={setShowParticipantsList}
          activityType={activityType}
          city={city}
          onViewProfile={(userId, userName, avatarUrl) => {
            setShowParticipantsList(false);
            setSelectedUserProfile({ userId, userName, avatarUrl });
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
