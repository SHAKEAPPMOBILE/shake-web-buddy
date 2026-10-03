import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFriends } from "@/hooks/useFriends";

export interface ShareContact {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
}

/**
 * The people to offer first in the share sheet: whoever the user has most
 * recently exchanged private messages with, then their remaining friends.
 *
 * iOS never tells an app who someone shared to in the system share sheet, so
 * "recent" can't mean that — it means recent conversations inside SHAKE, which
 * are also the only people the sheet can actually message directly.
 */
export function useShareContacts(limit = 12) {
  const { user } = useAuth();
  const { friends } = useFriends();
  const [recents, setRecents] = useState<ShareContact[]>([]);
  const [loadedRecents, setLoadedRecents] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: msgs }, { data: hidden }, { data: blocks }] = await Promise.all([
        supabase
          .from("private_messages")
          .select("sender_id, receiver_id")
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .order("created_at", { ascending: false })
          .limit(120),
        supabase.from("private_conversation_hidden").select("other_user_id").eq("user_id", user.id),
        supabase
          .from("user_blocks")
          .select("blocker_id, blocked_id")
          .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`),
      ]);

      const skip = new Set<string>([user.id]);
      (hidden ?? []).forEach((h) => skip.add(h.other_user_id));
      (blocks ?? []).forEach((b) => skip.add(b.blocker_id === user.id ? b.blocked_id : b.blocker_id));

      const ids: string[] = [];
      for (const m of msgs ?? []) {
        const other = m.sender_id === user.id ? m.receiver_id : m.sender_id;
        if (other && !skip.has(other) && !ids.includes(other)) ids.push(other);
        if (ids.length >= limit) break;
      }

      let profiles: ShareContact[] = [];
      if (ids.length) {
        const { data } = await supabase.from("profiles").select("user_id, name, avatar_url").in("user_id", ids);
        const byId = new Map((data ?? []).map((p) => [p.user_id, p]));
        // Keep message-recency order; drop anyone with no profile row (deleted accounts).
        profiles = ids.flatMap((id) => {
          const p = byId.get(id);
          return p ? [{ user_id: p.user_id, name: p.name, avatar_url: p.avatar_url }] : [];
        });
      }
      if (!cancelled) {
        setRecents(profiles);
        setLoadedRecents(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, limit]);

  const contacts = useMemo(() => {
    const seen = new Set(recents.map((r) => r.user_id));
    const rest = friends
      .filter((f) => !seen.has(f.user_id))
      .map((f) => ({ user_id: f.user_id, name: f.name, avatar_url: f.avatar_url }));
    return [...recents, ...rest].slice(0, limit);
  }, [recents, friends, limit]);

  return { contacts, isLoading: !loadedRecents };
}
