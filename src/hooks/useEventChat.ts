import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { EVENT_CHAT_STICKER_SET } from "@/lib/eventChatStickers";

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

interface UseEventChatOptions {
  eventId: string;
  eventName: string;
  eventStartsAt: string;
}

interface UseEventChatReturn {
  status: ChatStatus;
  messages: EventChatMessage[];
  senderMap: Record<string, { name: string; avatar_url: string }>;
  memberCount: number | null;
  expiresAt: Date | null;
  minutesLeft: number | null;
  sendMessage: (content: string, messageType?: "text" | "sticker") => Promise<void>;
  unlockChat: () => Promise<{ success: boolean; error?: string }>;
  isSending: boolean;
}

export function useEventChat({ eventId, eventName, eventStartsAt }: UseEventChatOptions): UseEventChatReturn {
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
  const senderMapRef = useRef(senderMap);
  senderMapRef.current = senderMap;

  // Must be stable across renders: a new Date() each tick was changing loadChat’s identity and
  // re-running the fetch + realtime effect every frame (flicker).
  const computedExpiresAt = useMemo(
    () => new Date(new Date(eventStartsAt).getTime() + 12 * 60 * 60 * 1000),
    [eventStartsAt]
  );
  const isChatExpired = () => new Date() > computedExpiresAt;
  const resolveMembershipExpiry = (membership: { expires_at?: string | null; paid_at?: string | null }) => {
    if (membership.expires_at) {
      const expires = new Date(membership.expires_at);
      if (!isNaN(expires.getTime())) return expires;
    }
    if (membership.paid_at) {
      const paidAt = new Date(membership.paid_at);
      if (!isNaN(paidAt.getTime())) return new Date(paidAt.getTime() + 24 * 60 * 60 * 1000);
    }
    return null;
  };

  const startCountdown = useCallback((expiry: Date) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const tick = () => {
      const diff = Math.max(0, expiry.getTime() - Date.now());
      setMinutesLeft(Math.floor(diff / 60000));
      if (diff <= 0) { clearInterval(timerRef.current!); setStatus("expired"); }
    };
    tick();
    timerRef.current = setInterval(tick, 30_000);
  }, []);

  const loadChat = useCallback(async () => {
    if (!user) { setStatus("locked"); return; }
    if (isChatExpired()) { setStatus("expired"); return; }

    let member: { id?: string; expires_at?: string | null; paid_at?: string | null } | null = null;
    try {
      const { data, error: memberError } = await supabase
        .from("event_chat_members").select("event_id, user_id, expires_at, paid_at")
        .eq("user_id", user.id).eq("event_id", eventId).maybeSingle();
      if (memberError) {
        console.warn("[useEventChat] event_chat_members membership query failed; defaulting to locked", memberError);
        setStatus("locked");
        return;
      }
      member = data;
    } catch (err) {
      console.warn("[useEventChat] event_chat_members membership query threw; defaulting to locked", err);
      setStatus("locked");
      return;
    }
    if (!member) { setStatus("locked"); return; }
    const memberExpiry = resolveMembershipExpiry(member);
    if (memberExpiry && memberExpiry.getTime() <= Date.now()) {
      setStatus("expired");
      return;
    }

    const effectiveExpiry = memberExpiry ?? computedExpiresAt;
    setExpiresAt(effectiveExpiry);
    startCountdown(effectiveExpiry);

    const { data: msgs } = await supabase
      .from("event_chat_messages").select("*")
      .eq("event_id", eventId).gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true }).limit(200);

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
      if (profiles) {
        const map: Record<string, { name: string; avatar_url: string }> = {};
        profiles.forEach((p) => {
          map[p.user_id] = { name: p.name ?? "User", avatar_url: p.avatar_url ?? "" };
        });
        setSenderMap(map);
      }
    }

    try {
      const { count, error: countError } = await supabase
        .from("event_chat_members").select("*", { count: "exact", head: true })
        .eq("event_id", eventId).gt("expires_at", new Date().toISOString());
      if (countError) {
        console.warn("[useEventChat] event_chat_members count query failed; hiding count", countError);
        setMemberCount(null);
      } else {
        setMemberCount(count ?? 0);
      }
    } catch (err) {
      console.warn("[useEventChat] event_chat_members count query threw; hiding count", err);
      setMemberCount(null);
    }
    setStatus("active");
  }, [user, eventId, computedExpiresAt, startCountdown]);

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
    loadChat();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loadChat]);

  useEffect(() => {
    if (status === "active") subscribeRealtime();
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [status, subscribeRealtime]);

  const sendMessage = useCallback(
    async (content: string, messageType: "text" | "sticker" = "text") => {
      if (!user || status !== "active") return;
      const trimmed = content.trim();
      if (!trimmed) return;
      if (messageType === "sticker" && !EVENT_CHAT_STICKER_SET.has(trimmed)) return;
      setIsSending(true);
      try {
        await supabase.from("event_chat_messages").insert({
          event_id: eventId,
          user_id: user.id,
          content: trimmed,
          expires_at: computedExpiresAt.toISOString(),
          message_type: messageType,
        });
      } finally {
        setIsSending(false);
      }
    },
    [user, status, eventId, computedExpiresAt]
  );

  const unlockChat = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: "Not signed in" };
    if (isChatExpired()) return { success: false, error: "Event has ended" };
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
    await loadChat();
    return { success: true };
  }, [user, eventId, eventName, eventStartsAt, loadChat]);

  return { status, messages, senderMap, memberCount, expiresAt, minutesLeft, sendMessage, unlockChat, isSending };
}
