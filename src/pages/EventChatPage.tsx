import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock, Users } from "lucide-react";
import { useEventChat } from "@/hooks/useEventChat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

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

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!eventId) return;

    let cancelled = false;

    const loadMeta = async () => {
      setIsLoadingMeta(true);
      const { data } = await supabase
        .from("event_chats")
        .select("name, expires_at, created_at")
        .eq("event_id", eventId)
        .maybeSingle();

      if (cancelled) return;

      if (data) {
        setEventName(data.name);
        // Reconstruct start time as 12h before expires_at (matches webhook logic)
        const expires = new Date(data.expires_at);
        if (!isNaN(expires.getTime())) {
          const start = new Date(expires.getTime() - 12 * 60 * 60 * 1000);
          setEventStartsAt(start.toISOString());
        }
      }

      setIsLoadingMeta(false);
    };

    loadMeta();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

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

  const headerSubtitle = useMemo(() => {
    if (minutesLeft !== null && status === "active") {
      return `Chat closes in ${minutesLeft}m`;
    }
    if (status === "expired") {
      return "This chat ended 12h after the event 🎤";
    }
    return "Coordinate with other attendees";
  }, [minutesLeft, status]);

  if (!eventId) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => navigate(-1)}
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold text-foreground truncate max-w-[200px]">
                {eventName}
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold tracking-wide">
                EVENT
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{headerSubtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          <span>{memberCount}</span>
        </div>
      </div>

      {/* Chat content */}
      <div className="flex-1 flex flex-col px-4 py-3 gap-3 overflow-y-auto">
        {isLoadingMeta && (
          <p className="text-xs text-muted-foreground text-center">
            Setting up your event chat…
          </p>
        )}

        {status === "loading" && !isLoadingMeta && (
          <div className="flex items-center justify-center py-8">
            <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {status === "expired" && (
          <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
            <Clock className="w-5 h-5 mb-2" />
            <p>This chat ended 12 hours after the event.</p>
          </div>
        )}

        {(status === "active" || status === "locked" || status === "error") && messages.map((m) => (
          <div key={m.id} className="flex gap-2 mb-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 bg-primary/70">
              {senderMap[m.user_id]?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0">
              <div className="flex gap-2 items-center">
                <span className="text-primary/90 text-xs font-semibold">
                  {senderMap[m.user_id]?.name ?? "User"}
                </span>
                <span className="text-muted-foreground/80 text-[11px]">
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="text-foreground text-sm mt-0.5 break-words">{m.content}</p>
            </div>
          </div>
        ))}

        {status === "locked" && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            You don&apos;t have access to this chat. If you just paid, please wait a moment for the payment to be processed.
          </p>
        )}

        {status === "error" && (
          <p className="text-xs text-destructive text-center mt-4">
            Something went wrong loading this chat. Please try again later.
          </p>
        )}
      </div>

      {/* Input */}
      {status === "active" && (
        <div className="px-4 pb-4 pt-2 border-t border-border bg-background">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Message the group..."
              className="flex-1 rounded-xl px-4 py-2.5 text-sm text-foreground bg-card border border-border outline-none focus:ring-2 focus:ring-primary/30"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!inputValue.trim()) return;
                  void sendMessage(inputValue);
                  setInputValue("");
                }
              }}
            />
            <Button
              size="icon"
              className="w-10 h-10 rounded-xl shrink-0"
              disabled={isSending || !inputValue.trim()}
              onClick={async () => {
                if (!inputValue.trim()) return;
                await sendMessage(inputValue);
                setInputValue("");
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

