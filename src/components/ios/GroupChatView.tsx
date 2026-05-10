import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, User, BellOff, Bell, LogOut, Trash2, Plane, Images } from "lucide-react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useMessageReactionsForTable } from "@/hooks/useMessageReactionsForTable";
import { useMessageReactionBarState } from "@/hooks/useMessageReactionBarState";
import { MessageBubbleReactions } from "@/components/chat/MessageBubbleReactions";
import { aggregateReactionsByMessage, sortedReactionEntries } from "@/lib/eventChatReactions";
import { MinimalBackButton } from "@/components/MinimalBackButton";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfiles } from "@/hooks/useUserProfiles";
import { useActivityMute } from "@/hooks/useActivityMute";
import { useActivityJoins } from "@/hooks/useActivityJoins";
import { toast } from "@/lib/app-toast";
import { playNotificationSound } from "@/lib/notification-sound";
import { PremiumDialog } from "@/components/PremiumDialog";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { ParticipantsListDialog } from "@/components/ParticipantsListDialog";
import { useActivityVenue } from "@/contexts/VenueContext";
import { useTextMessageLimit } from "@/hooks/useTextMessageLimit";
import { LoadingSpinner } from "../LoadingSpinner";
import { getActivityById, getActivityLabel } from "@/data/activityTypes";
import { getVenueTypeForActivity, useVenuesForActivity } from "@/hooks/useDatabaseVenues";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getDisplayAvatarUrl } from "@/lib/avatar";
import { EventChatGiphyPickerModal } from "@/components/eventChat/EventChatGiphyPickerModal";
import { InlineChatGif } from "@/components/chat/InlineChatGif";

interface GroupChatViewProps {
  activityType: string;
  city: string;
  homeCity?: string;
  onBack: () => void;
  attendeeCount?: number;
  eventDate?: string | null;
}

interface Message {
  id: string;
  user_id: string;
  activity_type: string;
  city: string;
  message: string;
  message_type?: string | null;
  created_at: string;
}

const defaultSuggestions = [
    "Where should we meet?",
  "Count me in!",
  "See you there! 👋",
  "I'm running late!",
  "On my way! 🏃",
];

const chatSuggestions: Record<string, string[]> = {
  lunch: defaultSuggestions,
  dinner: [
    "What cuisine are we feeling?",
    "Should we make a reservation?",
    "Count me in!",
    "See you there! 👋",
    "I'm running late!",
    "Where should we meet?",
  ],
  drinks: [
    "Who's ready for happy hour? 🍻",
    "What time are we meeting up?",
    "Any bar suggestions?",
    "Count me in!",
    "See you there! 👋",
    "I'm running late!",
    "On my way! 🏃",
  ],
  surf: [
    "What's the wave forecast? 🌊",
    "Which beach are we hitting?",
    "Count me in!",
    "See you there! 👋",
    "On my way! 🏃",
  ],
  run: [
    "What pace are we thinking? 🏃",
    "Where's the starting point?",
    "Count me in!",
    "See you there! 👋",
    "On my way!",
  ],
  "co-working": [
    "Which cafe/space are we at? ☕",
    "What time are we starting?",
    "Count me in!",
    "See you there! 👋",
    "On my way! 💻",
  ],
  sunset: [
    "Best spot for sunset views? 🌅",
    "What time should we meet?",
    "Count me in!",
    "See you there! 👋",
  ],
  dance: [
    "Which club are we hitting? 💃",
    "What time does it start?",
    "Count me in!",
    "See you there! 👋",
  ],
};

// Curtain snap positions
const EXPANDED_HEIGHT = 300;
const COLLAPSED_HEIGHT = 88;
const SNAP_THRESHOLD = 80;

export function GroupChatView({
  activityType,
  city,
  homeCity,
  onBack,
  attendeeCount = 0,
  eventDate,
}: GroupChatViewProps) {
  const isCrossCity = homeCity && city !== homeCity;
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [giphyPickerOpen, setGiphyPickerOpen] = useState(false);
  const [showParticipantsList, setShowParticipantsList] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState<{
    userId: string;
    userName: string | null;
    avatarUrl: string | null;
  } | null>(null);
  const [participants, setParticipants] = useState<{ user_id: string; name: string | null; avatar_url: string | null }[]>([]);
  const [currentVenueIndex, setCurrentVenueIndex] = useState(0);
  const weekVenueInitialized = useRef(false);
  const MAX_CHAT_CAPACITY = 7;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Curtain drag state
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragDelta, setDragDelta] = useState(0);
  const isDraggingHeader = useRef(false);
  const dragStartY = useRef(0);
  const dragDeltaRef = useRef(0);

  const { user, isPremium } = useAuth();
  const { isMuted, toggleMute } = useActivityMute(city, activityType);
  const { leaveActivity } = useActivityJoins(city);
  const { venue: assignedVenue, location, mapsUrl } = useActivityVenue(city, activityType);
  const { t } = useTranslation();

  const { canSendText, addCharacters } = useTextMessageLimit();

  const messageIds = useMemo(() => messages.map((msg) => msg.id), [messages]);
  const reactionsEnabled = Boolean(user && activityType && city);
  const { rows: reactionRows, toggleReaction } = useMessageReactionsForTable({
    table: "activity_message_reactions",
    realtimeChannelId: `activity-msg-reactions:${activityType}:${city}`,
    messageIds,
    userId: user?.id,
    enabled: reactionsEnabled,
  });
  const reactionsByMessage = useMemo(
    () => aggregateReactionsByMessage(reactionRows, user?.id),
    [reactionRows, user?.id]
  );
  const { reactionBarMessageId, mobileReactionBarRef, onMessagePointerDown, onMessagePointerEnd } =
    useMessageReactionBarState(reactionsEnabled);

  // Get unique user IDs from messages for profile fetching (include current user)
  const userIds = useMemo(() => {
    const ids = new Set(messages.map((msg) => msg.user_id));
    if (user?.id) ids.add(user.id);
    return [...ids];
  }, [messages, user?.id]);

  const { profiles } = useUserProfiles(userIds);

  // Get own profile for venue suggestions
  const ownProfile = user ? profiles[user.id] : null;

  // Get the assigned venue (from weekly rotation) and all venues for this city/activity
  const venueType = getVenueTypeForActivity(activityType);
  const { data: filteredVenues = [] } = useVenuesForActivity(city, activityType);

  const cityVenues = useMemo(() => {
    if (!venueType) return [];
    const allVenues = filteredVenues;

    // Ensure assigned venue is first in the list
    if (assignedVenue) {
      const withoutAssigned = allVenues.filter(v => v.id !== assignedVenue.id);
      return [assignedVenue, ...withoutAssigned];
    }
    return allVenues;
  }, [filteredVenues, venueType, assignedVenue]);

  const currentVenue = cityVenues[currentVenueIndex];
  const hasVenues = cityVenues.length > 0;
  const isCurrentVenueAssigned = assignedVenue ? currentVenue?.id === assignedVenue.id : false;

  useEffect(() => {
    console.log('chat header venue:', {
      assignedVenue,
      activityType,
      city,
      venueType,
      cityVenuesCount: cityVenues.length,
    });
  }, [assignedVenue, activityType, city, venueType, cityVenues.length]);

  // Set initial venue index using weekly rotation formula (once, when venues first load)
  useEffect(() => {
    if (cityVenues.length > 0 && !weekVenueInitialized.current) {
      weekVenueInitialized.current = true;
      const weekVenueIndex = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) % cityVenues.length;
      setCurrentVenueIndex(weekVenueIndex);
    }
  }, [cityVenues.length]);

  // Fetch participants
  useEffect(() => {
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
  }, [activityType, city]);

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

  // Fetch messages
  useEffect(() => {
    if (!activityType) return;

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

    // Subscribe to new messages
    const channel = supabase
      .channel(`activity-messages-${activityType}-${city}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_messages",
          filter: `activity_type=eq.${activityType}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          if (newMessage.city === city) {
            setMessages((prev) => [...prev, newMessage]);
            if (newMessage.user_id !== user?.id && !isMuted) {
              playNotificationSound();
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "activity_messages",
        },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activityType, city, user?.id, isMuted]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Update read status
  useEffect(() => {
    if (!user || !activityType) return;

    const updateReadStatus = async () => {
      await supabase
        .from("activity_read_status")
        .upsert({
          user_id: user.id,
          activity_type: activityType,
          city: city,
          last_read_at: new Date().toISOString(),
        }, {
          onConflict: "user_id,activity_type,city"
        });
    };

    updateReadStatus();

    // Update when leaving
    return () => {
      updateReadStatus();
    };
  }, [user, activityType, city]);

  // ── Curtain drag handlers ──────────────────────────────────────────────────

  const handleTouchStart = (e: React.TouchEvent) => {
    isDraggingHeader.current = true;
    setIsDragging(true);
    dragStartY.current = e.touches[0].clientY;
    dragDeltaRef.current = 0;
    setDragDelta(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingHeader.current) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    dragDeltaRef.current = delta;
    setDragDelta(delta);
  };

  const handleTouchEnd = () => {
    if (!isDraggingHeader.current) return;
    isDraggingHeader.current = false;
    setIsDragging(false);
    const delta = dragDeltaRef.current;
    setIsCollapsed(prev => {
      if (!prev && delta < -SNAP_THRESHOLD) return true;
      if (prev && delta > SNAP_THRESHOLD) return false;
      return prev;
    });
    setDragDelta(0);
    dragDeltaRef.current = 0;
  };

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingHeader.current = true;
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragDeltaRef.current = 0;
    setDragDelta(0);

    const onMouseMove = (me: MouseEvent) => {
      if (!isDraggingHeader.current) return;
      const delta = me.clientY - dragStartY.current;
      dragDeltaRef.current = delta;
      setDragDelta(delta);
    };

    const onMouseUp = () => {
      isDraggingHeader.current = false;
      setIsDragging(false);
      const delta = dragDeltaRef.current;
      setIsCollapsed(prev => {
        if (!prev && delta < -SNAP_THRESHOLD) return true;
        if (prev && delta > SNAP_THRESHOLD) return false;
        return prev;
      });
      setDragDelta(0);
      dragDeltaRef.current = 0;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // ── Message handlers ───────────────────────────────────────────────────────

  const handleSendMessage = useCallback(async () => {
    if (!user || isSending) return;

    // Check if there's something to send
    if (!message.trim()) return;

    // Check text limit for non-premium users
    if (!isPremium && !canSendText) {
      setShowPremiumDialog(true);
      return;
    }

    setIsSending(true);

    try {
      const messageText = message.trim();

      // Track character usage for free users
      if (!isPremium) {
        addCharacters(messageText.length);
      }

      const { error } = await supabase.from("activity_messages").insert({
        user_id: user.id,
        activity_type: activityType,
        city: city,
        message: messageText,
      });

      if (error) throw error;

      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  }, [user, isSending, message, isPremium, canSendText, activityType, city, addCharacters]);

  const handleDeleteMessage = async (messageId: string) => {
    const { error } = await supabase
      .from("activity_messages")
      .delete()
      .eq("id", messageId);

    if (error) {
      toast.error("Failed to delete message");
    }
  };

  const handleLeaveActivity = async () => {
    await leaveActivity(activityType);
    toast.success("Left the activity");
    onBack();
  };

  const handleMuteToggle = async () => {
    await toggleMute();
    toast.success(isMuted ? "Notifications unmuted" : "Notifications muted");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleGifSelect = useCallback(
    async (url: string) => {
      if (!user || isSending) return;
      const trimmed = url.trim();
      if (!/^https?:\/\//i.test(trimmed)) return;

      if (!isPremium && !canSendText) {
        setShowPremiumDialog(true);
        throw new Error("Character limit reached");
      }

      setIsSending(true);
      try {
        const { error } = await supabase.from("activity_messages").insert({
          user_id: user.id,
          activity_type: activityType,
          city: city,
          message: trimmed,
          message_type: "gif",
        });
        if (error) throw error;
      } catch (error) {
        console.error("Error sending GIF:", error);
        toast.error("Failed to send GIF");
        throw error;
      } finally {
        setIsSending(false);
      }
    },
    [user, isSending, isPremium, canSendText, activityType, city]
  );

  const handleSuggestVenue = async (venue: DbVenue) => {
    if (!user) return;

    const suggestionMessage = `${ownProfile?.name || "Someone"} suggested: ${venue.name}, ${venue.address}`;

    const { error } = await supabase.from("activity_messages").insert({
      user_id: user.id,
      activity_type: activityType,
      city: city,
      message: suggestionMessage,
    });

    if (error) {
      toast.error("Failed to suggest venue");
    } else {
      toast.success(t('chat.venueSuggested', 'Venue suggested!'));
    }
  };

  const title = getActivityLabel(activityType);
  const activityMeta = getActivityById(activityType);
  const activityTime = activityType === "lunch" ? "12:30 PM" : activityType === "dinner" ? "7:00 PM" : activityType === "drinks" ? "8:00 PM" : activityType === "brunch" ? "11:00 AM" : activityType === "hike" ? "9:00 AM" : null;
  // Compute split header date parts (day / date / time on separate lines)
  const { headerDay, headerDateOnly } = (() => {
    if (eventDate) {
      const d = new Date(eventDate);
      const today = new Date();
      const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
      const isToday = d.toDateString() === today.toDateString();
      const isTomorrow = d.toDateString() === tomorrow.toDateString();
      if (isToday) return { headerDay: "Today", headerDateOnly: null };
      if (isTomorrow) return { headerDay: "Tomorrow", headerDateOnly: null };
      return {
        headerDay: d.toLocaleDateString('en-US', { weekday: 'long' }),
        headerDateOnly: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };
    }
    const defaultDay: Record<string, number> = { lunch: 6, dinner: 6, drinks: 5, brunch: 0, hike: 0 };
    const targetDay = defaultDay[activityType];
    if (targetDay === undefined) return { headerDay: city, headerDateOnly: null };
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const todayDay = today.getDay();
    const daysUntil = (targetDay - todayDay + 7) % 7;
    const next = new Date(today);
    next.setDate(today.getDate() + daysUntil);
    const isToday2 = next.toDateString() === today.toDateString();
    const isTomorrow2 = next.toDateString() === tomorrow.toDateString();
    return {
      headerDay: isToday2 ? "Today" : isTomorrow2 ? "Tomorrow" : next.toLocaleDateString('en-US', { weekday: 'long' }),
      headerDateOnly: null,
    };
  })();
  const showAttendees = attendeeCount > 0;

  // Curtain live height: clamp between snap positions during drag
  const baseHeight = isCollapsed ? COLLAPSED_HEIGHT : EXPANDED_HEIGHT;
  const liveHeaderHeight = isDragging
    ? Math.max(COLLAPSED_HEIGHT, Math.min(EXPANDED_HEIGHT, baseHeight + dragDelta))
    : baseHeight;

  return (
    <div className="fixed inset-0 flex flex-col bg-white z-50">
      <div className="absolute inset-0 pointer-events-none z-0" style={{ background: 'radial-gradient(circle at 8% 0%, rgba(139,92,246,0.65) 0%, transparent 55%), radial-gradient(circle at 92% 18%, rgba(236,72,153,0.6) 0%, transparent 55%), radial-gradient(circle at 50% 100%, rgba(56,189,248,0.5) 0%, transparent 60%)' }} aria-hidden />
      <div className="relative z-10 flex flex-col flex-1 min-h-0">

        {/* ── COLLAPSIBLE HEADER CURTAIN ────────────────────────────────── */}
        <div
          className="relative z-30 shrink-0 overflow-hidden"
          style={{
            height: liveHeaderHeight,
            transition: isDragging ? 'none' : 'height 0.3s ease',
          }}
        >
          {/* Full expanded content — fades out when collapsed */}
          <div
            style={{
              opacity: isCollapsed ? 0 : 1,
              transition: 'opacity 0.2s ease',
              pointerEvents: isCollapsed ? 'none' : 'auto',
            }}
          >
            {/* Header — centered flow layout; action buttons float as an overlay in the top corners */}
            <div
              className="relative z-30 shrink-0 border-b border-white/5 bg-transparent px-4 pb-5"
              style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
            >
              {/* Back + action buttons overlay */}
              <div
                className="absolute inset-x-0 flex items-center justify-between px-4 pointer-events-none"
                style={{ top: 'calc(0.75rem + env(safe-area-inset-top))' }}
              >
                <div className="pointer-events-auto">
                  <MinimalBackButton
                    onClick={onBack}
                    className="shrink-0 text-gray-900 hover:text-gray-700 bg-white/10 border-white/30"
                    aria-label="Back"
                    iconClassName="w-6 h-6"
                  />
                </div>
                <div className="flex items-center gap-0.5 pointer-events-auto">
                  <Button variant="ghost" size="icon" onClick={handleMuteToggle} className="shrink-0 text-gray-900 hover:text-gray-700 hover:bg-black/5 h-8 w-8" title={isMuted ? "Unmute" : "Mute"}>
                    {isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleLeaveActivity} className="shrink-0 text-gray-900 hover:text-red-500 hover:bg-black/5 h-8 w-8" title="Leave">
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Centered stacked content — drives the header height */}
              <div
                className="flex flex-col items-center gap-0.5"
                style={{ marginTop: 'calc(2.25rem + env(safe-area-inset-top))' }}
              >
                {/* Activity image / emoji */}
                <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center mb-1">
                  {activityMeta?.icon ? (
                    <img src={activityMeta.icon} alt={activityType} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <span className="text-4xl">{activityMeta?.emoji ?? "📍"}</span>
                  )}
                </div>

                {/* Activity name */}
                <h1 className="text-lg font-bold text-gray-900 text-center leading-tight">
                  {title}
                  {isCrossCity && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs text-gray-900 rounded-full bg-white/10">
                      <Plane className="w-3 h-3" />{city}
                    </span>
                  )}
                </h1>

                {/* Day / date / time */}
                <p className="text-sm text-gray-700 leading-tight">{headerDay}</p>
                {headerDateOnly && <p className="text-sm text-gray-500 leading-tight">{headerDateOnly}</p>}
                {activityTime && <p className="text-sm text-gray-500 leading-tight">{activityTime}</p>}

                {/* Venue pill */}
                {hasVenues && currentVenue && assignedVenue && (
                  <div className="flex items-center justify-center gap-1.5 mt-2 min-w-0">
                    <button
                      onClick={() => {
                        const venueUrl = currentVenue.latitude && currentVenue.longitude
                          ? `https://www.google.com/maps/search/?api=1&query=${currentVenue.latitude},${currentVenue.longitude}`
                          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${currentVenue.name}, ${currentVenue.address}`)}`;
                        window.location.href = venueUrl;
                      }}
                      className="text-base hover:scale-110 transition-transform shrink-0"
                      title="Open in Google Maps"
                    >
                      📍
                    </button>
                    {isCurrentVenueAssigned ? (
                      <span className="inline-flex items-center px-3 py-1.5 bg-white text-green-600 rounded-full text-sm font-semibold border border-green-500/30 max-w-[200px] truncate">
                        {currentVenue.name}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSuggestVenue(currentVenue)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-gray-900 rounded-full text-sm font-semibold border border-white/20 hover:bg-white/20 max-w-[200px]"
                      >
                        <span className="truncate">{currentVenue.name}</span>
                        <span className="text-xs text-gray-500 shrink-0">({t('chat.suggest', 'Suggest')})</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Capacity indicator */}
                {(() => {
                  const memberCount = participants.length;
                  const isFull = memberCount >= MAX_CHAT_CAPACITY;
                  return (
                    <p className={`text-xs mt-1 leading-tight ${isFull ? 'text-red-400' : 'text-gray-400'}`}>
                      {isFull
                        ? `Group full · ${memberCount}/${MAX_CHAT_CAPACITY}`
                        : `${memberCount}/${MAX_CHAT_CAPACITY} joined`}
                    </p>
                  );
                })()}
              </div>
            </div>

            {showAttendees ? (
              <div className="w-full px-4 py-2.5 border-b border-white bg-white">
                <button onClick={() => setShowParticipantsList(true)} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <div className="flex -space-x-2 overflow-hidden">
                    {participants.slice(0, 6).map((participant) => (
                      <Avatar key={participant.user_id} className="w-8 h-8 rounded-full border border-gray-200 bg-gray-100 shrink-0">
                        <AvatarImage src={getDisplayAvatarUrl(participant.avatar_url)} alt={participant.name || "User"} className="object-cover" />
                        <AvatarFallback className="bg-gray-100 flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-400" />
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {participants.length > 6 && (
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 text-xs font-medium text-gray-500 shrink-0">
                        +{participants.length - 6}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {attendeeCount} {attendeeCount === 1 ? 'person' : 'people'} joined
                  </p>
                </button>
              </div>
            ) : (
              <div className="w-full px-4 py-2.5 border-b border-white bg-white">
                <p className="text-sm text-gray-400">You're the first one here today!</p>
              </div>
            )}
          </div>

          {/* Collapsed thin bar — shown when header is collapsed */}
          <div
            className="absolute inset-0 flex items-end justify-between px-4 pb-3"
            style={{
              paddingTop: 'env(safe-area-inset-top)',
              opacity: isCollapsed ? 1 : 0,
              transition: 'opacity 0.2s ease',
              pointerEvents: isCollapsed ? 'auto' : 'none',
            }}
          >
            <MinimalBackButton
              onClick={onBack}
              className="shrink-0 text-gray-900 hover:text-gray-700 bg-white/10 border-white/30"
              aria-label="Back"
              iconClassName="w-5 h-5"
            />
            <span className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
              {activityMeta?.icon ? (
                <img src={activityMeta.icon} alt={activityType} className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <span className="text-base">{activityMeta?.emoji ?? "📍"}</span>
              )}
              {title}
            </span>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" onClick={handleMuteToggle} className="shrink-0 text-gray-900 hover:text-gray-700 hover:bg-black/5 h-8 w-8" title={isMuted ? "Unmute" : "Mute"}>
                {isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLeaveActivity} className="shrink-0 text-gray-900 hover:text-red-500 hover:bg-black/5 h-8 w-8" title="Leave">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* ── DRAG HANDLE PILL ─────────────────────────────────────────────── */}
        <div
          className="shrink-0 flex items-center justify-center bg-white border-t border-gray-100 select-none"
          style={{ height: 28, cursor: isDragging ? 'grabbing' : 'grab' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleHeaderMouseDown}
        >
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* ── CHAT MESSAGES ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto px-4 pb-4 pt-2 space-y-3 bg-white">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <p className="text-center text-sm">
                Start the conversation!<br />
                <span className="text-xs">Messages from today will appear here.</span>
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwnMessage = msg.user_id === user?.id;
              const profile = profiles[msg.user_id];
              const displayName = isOwnMessage ? 'You' : profile?.name || 'Shaker';
              const avatarUrl = isOwnMessage ? (ownProfile?.avatar_url ?? profile?.avatar_url) : profile?.avatar_url;
              const msgReactions = reactionsByMessage[msg.id];
              const reactionChips = msgReactions ? sortedReactionEntries(msgReactions) : [];
              const isGif =
                (msg.message_type ?? "text") === "gif" && /^https?:\/\//i.test(msg.message);
              return (
                <div key={msg.id} className={`group flex gap-3 items-end ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                  <Avatar className="w-8 h-8 shrink-0 rounded-full border border-gray-200 bg-gray-100">
                    <AvatarImage src={getDisplayAvatarUrl(avatarUrl)} alt={displayName} className="object-cover" />
                    <AvatarFallback className="bg-gray-100 flex items-center justify-center">
                      <User className="w-4 h-4 text-gray-400" />
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`min-w-0 max-w-[70%] ${isGif ? "shrink-0 overflow-visible" : ""} ${isOwnMessage ? "text-right" : "text-left"}`}
                  >
                    <MessageBubbleReactions
                      variant="dark"
                      isOwn={isOwnMessage}
                      messageId={msg.id}
                      enabled={reactionsEnabled}
                      reactionBarMessageId={reactionBarMessageId}
                      mobileReactionBarRef={mobileReactionBarRef}
                      reactionChips={reactionChips}
                      onToggleReaction={toggleReaction}
                      onPointerDown={onMessagePointerDown(msg.id)}
                      onPointerUp={onMessagePointerEnd}
                      onPointerCancel={onMessagePointerEnd}
                      onPointerLeave={onMessagePointerEnd}
                      header={
                        <div className={`flex items-baseline gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                          <button
                            type="button"
                            className={`font-semibold text-sm ${isOwnMessage ? 'text-white' : 'text-gray-900'} ${!isOwnMessage ? 'hover:text-primary cursor-pointer' : ''}`}
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
                          <span className={`text-xs ${isOwnMessage ? 'text-white/70' : 'text-gray-400'}`}>{format(new Date(msg.created_at), 'h:mm a')}</span>
                        </div>
                      }
                    >
                      <div className={`flex items-center gap-1 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                        {isGif ? (
                          <InlineChatGif
                            src={msg.message}
                            variant="dark"
                            onLoad={() =>
                              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
                            }
                          />
                        ) : (
                          <div
                            className="text-sm px-3 py-2 inline-block"
                            style={isOwnMessage ? {
                              background: "rgba(139, 92, 246, 0.55)",
                              backdropFilter: "blur(12px)",
                              WebkitBackdropFilter: "blur(12px)",
                              border: "1px solid rgba(255,255,255,0.3)",
                              borderRadius: "18px 18px 4px 18px",
                              color: "white",
                            } : {
                              background: "rgba(0,0,0,0.06)",
                              border: "1px solid rgba(0,0,0,0.08)",
                              borderRadius: "18px 18px 18px 4px",
                              color: "#111",
                            }}
                          >
                            <span>{msg.message}</span>
                          </div>
                        )}
                        {isOwnMessage && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100 p-1 text-gray-300 hover:text-red-400 transition-all"
                            title="Delete message"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </MessageBubbleReactions>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {user && !message.trim() && (
          <div className="px-4 pb-2 overflow-x-auto scrollbar-hide bg-white">
            <div className="flex gap-1.5 w-max">
              {(chatSuggestions[activityType] || defaultSuggestions).map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => setMessage(suggestion)}
                  className="text-xs px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 whitespace-nowrap shrink-0"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 h-9 w-9 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              onClick={() => setGiphyPickerOpen(true)}
              disabled={isSending || giphyPickerOpen}
              aria-label="GIFs"
              title="GIFs"
            >
              <Images className="w-5 h-5" />
            </Button>
            <Input
              placeholder={canSendText ? "Type a message..." : "Character limit reached"}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 bg-gray-50 border-gray-200 focus-visible:ring-primary/50 text-gray-900 placeholder:text-gray-400 min-h-9"
              disabled={isSending || (!isPremium && !canSendText) || giphyPickerOpen}
            />
            <Button
              size="icon"
              onClick={handleSendMessage}
              disabled={isSending || !message.trim() || giphyPickerOpen}
              className="shrink-0 h-9 w-9 bg-[#7c5cfc] hover:bg-[#8b6dfc] text-white border-0"
            >
              {isSending ? <LoadingSpinner size="sm" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {user ? (
          <EventChatGiphyPickerModal
            open={giphyPickerOpen}
            onOpenChange={setGiphyPickerOpen}
            onGifSelect={handleGifSelect}
          />
        ) : null}

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
      </div>
    </div>
  );
}
