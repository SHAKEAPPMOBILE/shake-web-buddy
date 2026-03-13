import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Users, Clock, Bell, BellOff, LogOut } from "lucide-react";
import { useEventChat } from "@/hooks/useEventChat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface EventChatPageParams {
  eventId?: string;
}

export default function EventChatPage() {
  const { eventId } = useParams<EventChatPageParams>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [eventName, setEventName] = useState<string>("Event chat");
  const [eventStartsAt, setEventStartsAt] = useState<string>(new Date().toISOString());
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!eventId) return;

    let cancelled = false;
    let attempts = 0;
    const MAX_RETRIES = 3;

    const loadMeta = async () => {
      if (cancelled) return;
      setIsLoadingMeta(true);
      try {
        const { data, error } = await supabase
          .from("event_chats")
          .select("name, expires_at, created_at")
          .eq("event_id", eventId)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.log("[EventChatPage] Error loading event_chats", error);
        }

        if (data) {
          setEventName(data.name);
          const expires = new Date(data.expires_at as string);
          if (!isNaN(expires.getTime())) {
            const start = new Date(expires.getTime() - 12 * 60 * 60 * 1000);
            setEventStartsAt(start.toISOString());
          }
          setIsLoadingMeta(false);
          return;
        }

        if (user) {
          const { data: member, error: memberError } = await supabase
            .from("event_chat_members")
            .select("event_id")
            .eq("event_id", eventId)
            .eq("user_id", user.id)
            .maybeSingle();

          if (memberError) {
            console.log("[EventChatPage] Error checking event_chat_members", memberError);
          }

          if (member) {
            const fallbackExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            const { error: insertError } = await supabase
              .from("event_chats")
              .insert({
                event_id: eventId,
                name: eventName,
                expires_at: fallbackExpiresAt,
              });

            if (insertError) {
              console.log("[EventChatPage] Error creating fallback event_chats row", insertError);
            } else {
              setEventStartsAt(new Date().toISOString());
              setIsLoadingMeta(false);
              return;
            }
          }
        }

        if (attempts < MAX_RETRIES) {
          attempts += 1;
          console.log("[EventChatPage] event_chats missing, retrying...", { attempts });
          setTimeout(loadMeta, 3000);
          return;
        }
      } catch (e) {
        console.log("[EventChatPage] Unexpected error loading metadata", e);
      } finally {
        if (!cancelled) {
          setIsLoadingMeta(false);
        }
      }
    };

    loadMeta();

    return () => {
      cancelled = true;
    };
  }, [eventId, user, eventName]);

  const {
    status,
    messages,
    senderMap,
    memberCount,
    minutesLeft,
    sendMessage,
    isSending,
  } = useEventChat({
    eventId: eventId ?? "",
    eventName,
    eventStartsAt,
  });

  const [inputValue, setInputValue] = useState("");

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const headerSubtitle = useMemo(() => {
    if (minutesLeft !== null && status === "active") {
      return `Chat closes in ${minutesLeft}m`;
    }
    if (status === "expired") {
      return "This chat ended 12h after the event 🎤";
    }
    return "Messages from this event will appear here.";
  }, [minutesLeft, status]);

  if (!eventId) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[#06060a] z-50">
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(circle at 8% 0%, rgba(139,92,246,0.65) 0%, transparent 55%), radial-gradient(circle at 92% 18%, rgba(236,72,153,0.6) 0%, transparent 55%), radial-gradient(circle at 50% 100%, rgba(56,189,248,0.5) 0%, transparent 60%)",
        }}
        aria-hidden
      />
      <div className="relative z-10 flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 pt-[calc(0.75rem+env(safe-area-inset-top))] border-b border-white/5">
          <button
            onClick={() => navigate(-1)}
            className="shrink-0 p-1.5 text-white/80 hover:text-white"
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-medium text-white flex items-center gap-2">
              <span className="truncate max-w-[200px]">{eventName}</span>
              <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-orange-200 rounded-full shrink-0 bg-white/5">
                EVENT
              </span>
            </h1>
            <p className="text-xs text-white/50 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{headerSubtitle}</span>
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-white/60">
            <Users className="w-3.5 h-3.5" />
            <span>{memberCount}</span>
          </div>
          <div className="flex items-center gap-0.5 ml-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMuted((prev) => !prev)}
              className="shrink-0 text-white/60 hover:text-white hover:bg-white/5 h-8 w-8"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                if (!user) return;
                await supabase
                  .from("event_chat_members")
                  .delete()
                  .eq("event_id", eventId)
                  .eq("user_id", user.id);
                navigate(-1);
              }}
              className="shrink-0 text-white/50 hover:text-red-400 hover:bg-white/5 h-8 w-8"
              title="Leave chat"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Chat body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoadingMeta && (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          )}

          {!isLoadingMeta && messages.length === 0 && status !== "error" && status !== "locked" && (
            <div className="flex flex-col items-center justify-center h-full text-white/40">
              <p className="text-center text-sm">
                Start the conversation!<br />
                <span className="text-xs">Messages from today will appear here.</span>
              </p>
            </div>
          )}

          {messages.map((m) => {
            const profile = senderMap[m.user_id];
            const displayName = profile?.name || "User";
            const avatarUrl = profile?.avatar_url;
            const isOwn = user?.id === m.user_id;

            return (
              <div key={m.id} className={`group flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}>
                <Avatar className="w-8 h-8 shrink-0 rounded-full border border-white/10 bg-white/5">
                  <AvatarImage src={avatarUrl || undefined} alt={displayName} className="object-cover" />
                  <AvatarFallback className="bg-white/5 flex items-center justify-center">
                    <span className="text-xs text-white/40">
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  </AvatarFallback>
                </Avatar>
                <div className={`flex-1 max-w-[70%] ${isOwn ? "text-right" : ""}`}>
                  <div className={`flex items-baseline gap-2 ${isOwn ? "justify-end" : ""}`}>
                    <span className="font-semibold text-sm text-white">
                      {isOwn ? "You" : displayName}
                    </span>
                    <span className="text-xs text-white/35">
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className={`flex items-center gap-1 ${isOwn ? "flex-row-reverse" : ""}`}>
                    <div
                      className={`text-sm mt-0.5 px-3 py-2 rounded-xl inline-block ${
                        isOwn ? "bg-[#7c5cfc] text-white" : "bg-white/10 text-white border border-white/10"
                      }`}
                    >
                      <span>{m.content}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {status === "locked" && (
            <p className="text-xs text-white/50 text-center mt-4">
              You don&apos;t have access to this chat yet. If you just paid, please wait a moment for the
              payment to be processed.
            </p>
          )}

          {status === "error" && (
            <p className="text-xs text-red-400 text-center mt-4">
              Something went wrong loading this chat. Please try again later.
            </p>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        {status === "active" && (
          <div className="p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-white/5">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Type a message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!inputValue.trim()) return;
                    void sendMessage(inputValue);
                    setInputValue("");
                  }
                }}
                className="flex-1 bg-white/5 border-white/10 focus-visible:ring-[#7c5cfc]/50 text-white placeholder:text-white/40 min-h-9"
                disabled={isSending}
              />
              <Button
                size="icon"
                onClick={async () => {
                  if (!inputValue.trim()) return;
                  await sendMessage(inputValue);
                  setInputValue("");
                }}
                disabled={isSending || !inputValue.trim()}
                className="shrink-0 h-9 w-9 bg-[#7c5cfc] hover:bg-[#8b6dfc] text-white border-0"
              >
                {isSending ? <LoadingSpinner size="sm" /> : <span className="text-xs font-semibold">➤</span>}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

