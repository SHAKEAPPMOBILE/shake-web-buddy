import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { EVENT_CHAT_STICKER_SET } from "@/lib/eventChatStickers";
import { enqueuePendingEventChat } from "@/lib/pendingEventChat";
import {
  isEventChatMembershipExplicitlyExpired,
  resolveEventChatAccessExpiryForUi,
} from "@/lib/eventChatMembership";

/**
 * Event chat hook — no navigate() anywhere here.
 * Countdown uses setInterval(..., 30_000); first tick runs immediately (not ~3s).
 * No retry loop that redirects; loadChat can set status locked/expired/active only.
 */

export interface EventChatMessage {
  id: string;
  event_id: string;
  user_id: string;
  content: string;
  created_at: string;
  expires_at: string;
  message_type?: string | null;
  sender_name?: string;
  sender_avatar?: string;
}

export type ChatStatus = "loading" | "expired" | "locked" | "active" | "error";

function logEventChat(hook: string, message: string, data?: Record<string, unknown>) {
  console.log(`[useEventChat:${hook}] ${message}`, data ?? "");
}

interface UseEventChatOptions {
  eventId: string;
  eventName: string;
  eventStartsAt: string;
  /** False until the page has finished membership polling + meta; avoids duplicate access UI. */
  loadEnabled?: boolean;
}

interface UseEventChatReturn {
  status: ChatStatus;
  messages: EventChatMessage[];
  senderMap: Record<string, { name: string; avatar_url: string }>;
  memberCount: number | null;
  expiresAt: Date | null;
  minutesLeft: number | null;
  sendMessage: (content: string, messageType?: "text" | "sticker" | "video") => Promise<void>;
  unlockChat: () => Promise<{ success: boolean; error?: string }>;
  isSending: boolean;
}

export function useEventChat({
  eventId,
  eventName,
  eventStartsAt,
  loadEnabled = true,
}: UseEventChatOptions): UseEventChatReturn {
  const { user } = useAuth();
  const [status, setStatus] = useState<ChatStatus>("loading");
  const [messages, setMessages] = useState<EventChatMessage[]>([]);
  const [senderMap, setSenderMap] = useState<Record<string, { name: string; avatar_url: string }>>({});
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);
  const [isSending, setIsSending] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Bumped on effect cleanup (Strict Mode) and before each load; stale async must not flip status. */
  const loadGenerationRef = useRef(0);
  const senderMapRef = useRef(senderMap);
  senderMapRef.current = senderMap;

  const setChatStatus = useCallback((next: ChatStatus, reason: string) => {
    logEventChat("setStatus", reason, { next, eventId });
    setStatus(next);
  }, [eventId]);

  useEffect(() => {
    setStatus("loading");
    setMessages([]);
    setSenderMap({});
    setMemberCount(null);
    setExpiresAt(null);
    setMinutesLeft(null);
  }, [eventId]);

  // Must be stable across renders: a new Date() each tick was changing loadChat’s identity and
  // re-running the fetch + realtime effect every frame (flicker).
  const computedExpiresAt = useMemo(
    () => new Date(new Date(eventStartsAt).getTime() + 12 * 60 * 60 * 1000),
    [eventStartsAt]
  );

  const enforceTimerExpiryRef = useRef(true);

  const startCountdown = useCallback((expiry: Date, enforceTimerExpiry: boolean) => {
    enforceTimerExpiryRef.current = enforceTimerExpiry;
    if (timerRef.current) clearInterval(timerRef.current);
    const tick = () => {
      const diff = Math.max(0, expiry.getTime() - Date.now());
      setMinutesLeft(Math.floor(diff / 60000));
      if (diff <= 0 && enforceTimerExpiryRef.current) {
        clearInterval(timerRef.current!);
        logEventChat("countdown", "Timer reached zero → expired", {
          eventId,
          expiry: expiry.toISOString(),
        });
        setChatStatus("expired", "countdown tick: access window ended");
      }
    };
    tick();
    timerRef.current = setInterval(tick, 30_000);
  }, [eventId, setChatStatus]);

  const loadChatWithGeneration = useCallback(
    async (gen: number) => {
    const stale = () => gen !== loadGenerationRef.current;

    if (!user) {
      if (stale()) return;
      setChatStatus("locked", "loadChat: no user");
      return;
    }

    if (stale()) return;
    setChatStatus("loading", "loadChat: start (membership check first; no early isChatExpired on props)");

    const { data: member, error: memberError } = await supabase
      .from("event_chat_members")
      .select("event_id, user_id, expires_at, paid_at")
      .eq("user_id", user.id)
      .eq("event_id", eventId)
      .maybeSingle();

    if (stale()) {
      logEventChat("loadChat", "aborted after membership fetch (stale generation)", { gen, eventId });
      return;
    }

    if (memberError) {
      console.warn("[useEventChat] event_chat_members query failed", memberError);
    }
    if (!member) {
      logEventChat("loadChat", "No membership row → locked", { eventId, userId: user.id });
      if (stale()) return;
      setChatStatus("locked", "loadChat: no event_chat_members row");
      return;
    }

    if (isEventChatMembershipExplicitlyExpired(member)) {
      logEventChat("loadChat", "expires_at set and in past → expired", {
        eventId,
        expires_at: member.expires_at,
      });
      if (stale()) return;
      setChatStatus("expired", "loadChat: membership expires_at in past");
      return;
    }

    const { expiryForCountdown, enforceTimerExpiry } = resolveEventChatAccessExpiryForUi(member, computedExpiresAt);
    logEventChat("loadChat", "access window for UI", {
      eventId,
      expiryForCountdown: expiryForCountdown.toISOString(),
      enforceTimerExpiry,
      memberExpiresAt: member.expires_at ?? null,
    });

    if (stale()) return;
    setExpiresAt(expiryForCountdown);
    startCountdown(expiryForCountdown, enforceTimerExpiry);
    // Let the user compose immediately; message/history fetch can lag without blocking UI.
    setChatStatus("active", "loadChat: member valid, chat active");
    enqueuePendingEventChat({
      event_id: eventId,
      event_name: eventName?.trim() || "Event chat",
      event_starts_at: eventStartsAt,
      expires_at: expiryForCountdown.toISOString(),
    });

    try {
      const { data: msgs, error: msgsError } = await supabase
        .from("event_chat_messages")
        .select("*")
        .eq("event_id", eventId)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true })
        .limit(200);

      if (stale()) return;
      if (msgsError) {
        console.warn("[useEventChat] event_chat_messages load failed", msgsError);
        setMessages([]);
      } else {
        setMessages(
          (msgs ?? []).map((row) => ({
            ...row,
            message_type: row.message_type ?? "text",
          }))
        );

        const uniqueIds = [...new Set((msgs ?? []).map((m) => m.user_id))];
        if (uniqueIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, name, avatar_url")
            .in("user_id", uniqueIds);
          if (stale()) return;
          if (profiles) {
            const map: Record<string, { name: string; avatar_url: string }> = {};
            profiles.forEach((p) => {
              map[p.user_id] = { name: p.name ?? "User", avatar_url: p.avatar_url ?? "" };
            });
            setSenderMap(map);
          }
        }
      }
    } catch (err) {
      console.warn("[useEventChat] event_chat_messages load threw", err);
      if (!stale()) setMessages([]);
    }

    try {
      const { count, error: countError } = await supabase
        .from("event_chat_members")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId);
      if (stale()) return;
      if (countError) {
        console.warn("[useEventChat] event_chat_members count query failed; hiding count", countError);
        setMemberCount(null);
      } else {
        setMemberCount(count ?? 0);
      }
    } catch (err) {
      console.warn("[useEventChat] event_chat_members count query threw; hiding count", err);
      if (!stale()) setMemberCount(null);
    }
  },
    [user, eventId, eventName, eventStartsAt, computedExpiresAt, startCountdown, setChatStatus],
  );

  const loadChat = useCallback(async () => {
    loadGenerationRef.current += 1;
    const gen = loadGenerationRef.current;
    await loadChatWithGeneration(gen);
  }, [loadChatWithGeneration]);

  const subscribeRealtime = useCallback(() => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase.channel(`event-chat-${eventId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "event_chat_messages", filter: `event_id=eq.${eventId}` },
        async (payload) => {
          const raw = payload.new as EventChatMessage;
          const newMsg: EventChatMessage = {
            ...raw,
            message_type: raw.message_type ?? "text",
          };
          if (new Date(newMsg.expires_at) > new Date()) {
            setMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
            if (!senderMapRef.current[newMsg.user_id]) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("user_id, name, avatar_url")
                .eq("user_id", newMsg.user_id)
                .maybeSingle();
              if (profile) {
                setSenderMap((prev) => ({
                  ...prev,
                  [newMsg.user_id]: { name: profile.name ?? "User", avatar_url: profile.avatar_url ?? "" },
                }));
              }
            }
          }
        }).subscribe();
    channelRef.current = channel;
  }, [eventId]);

  useEffect(() => {
    if (!loadEnabled) {
      logEventChat("effect", "loadChat skipped: loadEnabled=false", { eventId });
      return;
    }
    loadGenerationRef.current += 1;
    const gen = loadGenerationRef.current;
    logEventChat("effect", "loadChat effect run", { eventId, loadEnabled, gen });
    void loadChatWithGeneration(gen);
    return () => {
      loadGenerationRef.current += 1;
      logEventChat("effect cleanup", "invalidate load generation + clear channel + countdown timer", { eventId });
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loadEnabled, loadChatWithGeneration, eventId]);

  useEffect(() => {
    if (!loadEnabled || status !== "active") return;
    logEventChat("effect", "subscribeRealtime", { eventId, status });
    subscribeRealtime();
    return () => {
      logEventChat("effect cleanup", "remove realtime channel", { eventId });
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [loadEnabled, status, subscribeRealtime, eventId]);

  const sendMessage = useCallback(
    async (content: string, messageType: "text" | "sticker" | "video" = "text") => {
      if (!user || status !== "active") return;
      const trimmed = content.trim();
      if (!trimmed) return;
      if (messageType === "video") {
        if (!/^https?:\/\//i.test(trimmed)) return;
      } else if (messageType === "sticker") {
        if (!EVENT_CHAT_STICKER_SET.has(trimmed)) return;
      }
      setIsSending(true);
      try {
        const { data: row, error } = await supabase
          .from("event_chat_messages")
          .insert({
            event_id: eventId,
            user_id: user.id,
            content: trimmed,
            expires_at: computedExpiresAt.toISOString(),
            message_type: messageType,
          })
          .select()
          .single();

        if (error) {
          console.error("[useEventChat] sendMessage insert failed", error);
          throw error;
        }
        if (!row) return;

        const newMsg: EventChatMessage = {
          ...(row as EventChatMessage),
          message_type: (row as EventChatMessage).message_type ?? messageType,
        };

        setMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));

        if (!senderMapRef.current[user.id]) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_id, name, avatar_url")
            .eq("user_id", user.id)
            .maybeSingle();
          if (profile) {
            setSenderMap((prev) => ({
              ...prev,
              [user.id]: { name: profile.name ?? "User", avatar_url: profile.avatar_url ?? "" },
            }));
          }
        }
      } finally {
        setIsSending(false);
      }
    },
    [user, status, eventId, computedExpiresAt]
  );

  const unlockChat = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: "Not signed in" };
    if (new Date() > computedExpiresAt) {
      logEventChat("unlockChat", "blocked: event window over (computed from eventStartsAt)", {
        eventStartsAt,
        computedExpiresAt: computedExpiresAt.toISOString(),
      });
      return { success: false, error: "Event has ended" };
    }
    const paidAtIso = new Date().toISOString();
    const parsedStart = eventStartsAt ? new Date(eventStartsAt) : null;
    const hasValidStart = parsedStart && !isNaN(parsedStart.getTime());
    const expiresAtIso = hasValidStart
      ? new Date(parsedStart.getTime() + 12 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from("event_chat_members").upsert({
      user_id: user.id,
      event_id: eventId,
      paid_at: paidAtIso,
      expires_at: expiresAtIso,
      event_name: eventName,
      event_starts_at: eventStartsAt,
      amount_cents: 100,
    }, { onConflict: "event_id,user_id" });
    if (error) {
      if (error.code === "23505") { await loadChat(); return { success: true }; }
      return { success: false, error: error.message };
    }
    enqueuePendingEventChat({
      event_id: eventId,
      event_name: eventName?.trim() || "Event chat",
      event_starts_at: eventStartsAt,
      expires_at: expiresAtIso,
    });
    await loadChat();
    return { success: true };
  }, [user, eventId, eventName, eventStartsAt, computedExpiresAt, loadChat]);

  return { status, messages, senderMap, memberCount, expiresAt, minutesLeft, sendMessage, unlockChat, isSending };
}
