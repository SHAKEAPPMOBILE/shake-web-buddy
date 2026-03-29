import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  /** FK to event_chats.id (uuid). */
  event_chat_id: string;
  /** Ticketmaster / route id (for UI); not stored on message rows. */
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

/** PostgREST / Supabase errors: log every common field plus a JSON attempt. */
function logSupabaseError(context: string, error: unknown) {
  if (error && typeof error === "object") {
    const e = error as {
      message?: string;
      code?: string;
      details?: string;
      hint?: string;
    };
    console.error(`[useEventChat] ${context}`, {
      message: e.message,
      code: e.code,
      details: e.details,
      hint: e.hint,
    });
    try {
      console.error(`[useEventChat] ${context} (JSON)`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    } catch {
      console.error(`[useEventChat] ${context} (raw object)`, error);
    }
  } else {
    console.error(`[useEventChat] ${context}`, error);
  }
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
  sendMessage: (content: string, messageType?: "text" | "video" | "gif") => Promise<void>;
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
  const [eventChatUuid, setEventChatUuid] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Bumped on effect cleanup (Strict Mode) and before each load; stale async must not flip status. */
  const loadGenerationRef = useRef(0);
  /** Same as eventChatUuid; available synchronously for send before next paint. */
  const eventChatUuidRef = useRef<string | null>(null);
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
    setEventChatUuid(null);
    eventChatUuidRef.current = null;
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
    setChatStatus("loading", "loadChat: start");

    logEventChat("loadChat", "event chats free for logged-in users → active immediately", {
      eventId,
      userId: user.id,
    });

    if (stale()) return;
    const computedExpiresAt = new Date(new Date(eventStartsAt).getTime() + 12 * 60 * 60 * 1000);
    const { expiryForCountdown, enforceTimerExpiry } = resolveEventChatAccessExpiryForUi(
      { expires_at: computedExpiresAt.toISOString(), paid_at: null },
      computedExpiresAt,
    );

    logEventChat("loadChat", "access window for UI", {
      eventId,
      expiryForCountdown: expiryForCountdown.toISOString(),
      enforceTimerExpiry,
    });

    if (stale()) return;
    setExpiresAt(expiryForCountdown);
    startCountdown(expiryForCountdown, enforceTimerExpiry);
    // Let the user compose immediately; message/history fetch can lag without blocking UI.
    setChatStatus("active", "loadChat: logged-in user, chat active");
    enqueuePendingEventChat({
      event_id: eventId,
      event_name: eventName?.trim() || "Event chat",
      event_starts_at: eventStartsAt,
      expires_at: expiryForCountdown.toISOString(),
    });

    const chatRowExpiresIso = expiryForCountdown.toISOString();
    const { data: chatRow, error: chatEnsureError } = await supabase
      .from("event_chats")
      .upsert(
        {
          event_id: eventId,
          name: eventName?.trim() || eventId,
          expires_at: chatRowExpiresIso,
        },
        { onConflict: "event_id" },
      )
      .select("id")
      .single();

    if (stale()) return;

    if (chatEnsureError || !chatRow?.id) {
      logSupabaseError("loadChat: event_chats upsert/select id failed", chatEnsureError ?? new Error("no id"));
      eventChatUuidRef.current = null;
      setEventChatUuid(null);
      setMessages([]);
    } else {
      eventChatUuidRef.current = chatRow.id;
      setEventChatUuid(chatRow.id);
    }

    try {
      if (!chatRow?.id) {
        if (!stale()) setMessages([]);
      } else {
      const { data: msgs, error: msgsError } = await supabase
        .from("event_chat_messages")
        .select("*")
        .eq("event_chat_id", chatRow.id)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true })
        .limit(200);

      if (stale()) return;
      if (msgsError) {
        logSupabaseError("event_chat_messages load failed", msgsError);
        setMessages([]);
      } else {
        setMessages(
          (msgs ?? []).map((row) => ({
            ...row,
            event_id: eventId,
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

  /** Message + list filters use expires_at; must stay in the future until the chat window ends (not raw event+12h if that is past). */
  const getMessageExpiresAtIso = useCallback((): string => {
    const minFuture = Date.now() + 60_000;
    if (expiresAt && !isNaN(expiresAt.getTime())) {
      return new Date(Math.max(expiresAt.getTime(), minFuture)).toISOString();
    }
    const c = computedExpiresAt.getTime();
    if (!isNaN(c)) {
      return new Date(Math.max(c, minFuture)).toISOString();
    }
    return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }, [expiresAt, computedExpiresAt]);

  const subscribeRealtime = useCallback(() => {
    if (!eventChatUuid) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel(`event-chat-${eventId}-${eventChatUuid}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "event_chat_messages",
          filter: `event_chat_id=eq.${eventChatUuid}`,
        },
        async (payload) => {
          const raw = payload.new as Record<string, unknown>;
          const newMsg: EventChatMessage = {
            ...(raw as unknown as EventChatMessage),
            event_id: eventId,
            message_type: (raw.message_type as string) ?? "text",
          };
          // Include slight clock skew; avoid dropping rows whose expires_at equals "now"
          if (new Date(newMsg.expires_at).getTime() > Date.now() - 5000) {
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
        },
      )
      .subscribe();
    channelRef.current = channel;
  }, [eventId, eventChatUuid]);

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
    if (!loadEnabled || status !== "active" || !eventChatUuid) return;
    logEventChat("effect", "subscribeRealtime", { eventId, status, eventChatUuid });
    subscribeRealtime();
    return () => {
      logEventChat("effect cleanup", "remove realtime channel", { eventId });
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [loadEnabled, status, subscribeRealtime, eventId, eventChatUuid]);

  const sendMessage = useCallback(
    async (content: string, messageType: "text" | "video" | "gif" = "text") => {
      if (!user) {
        console.warn("[useEventChat] sendMessage skipped: no user");
        return;
      }
      if (status !== "active") {
        console.warn("[useEventChat] sendMessage skipped: status is not active", { status, eventId });
        return;
      }
      if (!eventId?.trim()) {
        console.error("[useEventChat] sendMessage aborted: eventId missing", { eventId });
        return;
      }
      const trimmed = content.trim();
      if (!trimmed) return;
      if (messageType === "video" || messageType === "gif") {
        if (!/^https?:\/\//i.test(trimmed)) return;
      }

      const messageExpiresAtIso = getMessageExpiresAtIso();
      console.log("[event-chat-send]", {
        route_event_id: eventId,
        event_chat_id: eventChatUuidRef.current,
        user_id: user.id,
        messageExpiresAtIso,
        hookExpiresAt: expiresAt?.toISOString() ?? null,
        eventStartsAt,
      });

      setIsSending(true);
      try {
        const { data: chatUpsert, error: chatRowError } = await supabase
          .from("event_chats")
          .upsert(
            {
              event_id: eventId,
              name: eventName?.trim() || eventId,
              expires_at: messageExpiresAtIso,
            },
            { onConflict: "event_id" },
          )
          .select("id")
          .single();

        if (chatRowError) {
          logSupabaseError("sendMessage: event_chats upsert/select id failed", chatRowError);
          throw chatRowError;
        }
        if (!chatUpsert?.id) {
          const err = new Error("event_chats upsert returned no id");
          logSupabaseError("sendMessage: missing event_chats.id", err);
          throw err;
        }

        eventChatUuidRef.current = chatUpsert.id;
        setEventChatUuid(chatUpsert.id);

        const { data: row, error } = await supabase
          .from("event_chat_messages")
          .insert({
            event_chat_id: chatUpsert.id,
            user_id: user.id,
            content: trimmed,
            expires_at: messageExpiresAtIso,
            message_type: messageType,
          })
          .select()
          .single();

        if (error) {
          logSupabaseError("sendMessage: event_chat_messages insert failed", error);
          throw error;
        }
        if (!row) {
          console.error("[useEventChat] sendMessage: insert returned no row", {
            route_event_id: eventId,
            event_chat_id: chatUpsert.id,
          });
          return;
        }

        const newMsg: EventChatMessage = {
          ...(row as EventChatMessage),
          event_id: eventId,
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
      } catch (err) {
        console.error("[useEventChat] sendMessage failed (full error)", err);
        throw err;
      } finally {
        setIsSending(false);
      }
    },
    [user, status, eventId, eventName, eventStartsAt, expiresAt, getMessageExpiresAtIso]
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

    const { error: ensureChatErr } = await supabase
      .from("event_chats")
      .upsert(
        {
          event_id: eventId,
          name: eventName?.trim() || eventId,
          expires_at: expiresAtIso,
        },
        { onConflict: "event_id" },
      );
    if (ensureChatErr) {
      logSupabaseError("unlockChat: event_chats upsert failed", ensureChatErr);
      return { success: false, error: ensureChatErr.message };
    }

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
