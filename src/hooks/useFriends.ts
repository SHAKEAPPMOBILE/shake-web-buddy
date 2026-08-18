import { useState, useEffect, useCallback } from "react";
import { Contacts } from "@capacitor-community/contacts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/app-toast";
import { hashContactValues } from "@/lib/contactMatching";

export interface ContactMatch {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  friendship_status: "pending" | "accepted" | "declined" | null;
  friendship_direction: "sent" | "received" | null;
  friendship_id: string | null;
}

export interface Friend {
  friendship_id: string;
  user_id: string;
  name: string | null;
  avatar_url: string | null;
}

export function useFriends() {
  const { user } = useAuth();
  const [isImporting, setIsImporting] = useState(false);
  const [matches, setMatches] = useState<ContactMatch[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingReceived, setPendingReceived] = useState<Friend[]>([]);
  const [pendingSent, setPendingSent] = useState<Friend[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);

  const fetchFriends = useCallback(async () => {
    if (!user) {
      setIsLoadingFriends(false);
      return;
    }
    setIsLoadingFriends(true);
    const { data } = await supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    const rows = data ?? [];
    const accepted = rows.filter((f) => f.status === "accepted");
    const received = rows.filter((f) => f.status === "pending" && f.addressee_id === user.id);
    const sent = rows.filter((f) => f.status === "pending" && f.requester_id === user.id);

    const friendUserIds = accepted.map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id));
    const receivedUserIds = received.map((f) => f.requester_id);
    const sentUserIds = sent.map((f) => f.addressee_id);
    const allIds = Array.from(new Set([...friendUserIds, ...receivedUserIds, ...sentUserIds]));

    const { data: profiles } = allIds.length
      ? await supabase.from("profiles").select("user_id, name, avatar_url").in("user_id", allIds)
      : { data: [] as { user_id: string; name: string | null; avatar_url: string | null }[] };
    const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

    setFriends(
      accepted.map((f) => {
        const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
        const p = profileMap.get(otherId);
        return { friendship_id: f.id, user_id: otherId, name: p?.name ?? null, avatar_url: p?.avatar_url ?? null };
      })
    );
    setPendingReceived(
      received.map((f) => {
        const p = profileMap.get(f.requester_id);
        return { friendship_id: f.id, user_id: f.requester_id, name: p?.name ?? null, avatar_url: p?.avatar_url ?? null };
      })
    );
    setPendingSent(
      sent.map((f) => {
        const p = profileMap.get(f.addressee_id);
        return { friendship_id: f.id, user_id: f.addressee_id, name: p?.name ?? null, avatar_url: p?.avatar_url ?? null };
      })
    );
    setIsLoadingFriends(false);
  }, [user]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  /** Reads device contacts, hashes them locally, and matches against registered users. */
  const importContactsAndMatch = useCallback(async (): Promise<{ success: boolean; matches: ContactMatch[] }> => {
    setIsImporting(true);
    try {
      const current = await Contacts.checkPermissions();
      let status = current.contacts;
      if (status !== "granted" && status !== "limited") {
        const requested = await Contacts.requestPermissions();
        status = requested.contacts;
      }
      if (status !== "granted" && status !== "limited") {
        toast.error("Contacts permission is needed to find friends already on SHAKE.");
        return { success: false, matches: [] };
      }

      const { contacts } = await Contacts.getContacts({
        projection: { emails: true, phones: true },
      });

      const extracted = contacts.map((c) => ({
        emails: (c.emails ?? []).map((e) => e.address).filter((a): a is string => !!a),
        phones: (c.phones ?? []).map((p) => p.number).filter((n): n is string => !!n),
      }));

      const hashes = await hashContactValues(extracted);
      if (hashes.length === 0) {
        setMatches([]);
        return { success: true, matches: [] };
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Please sign in to continue.");
        return { success: false, matches: [] };
      }

      const { data, error } = await supabase.functions.invoke("match-contacts", {
        body: { hashes },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      const found: ContactMatch[] = data?.matches ?? [];
      setMatches(found);
      return { success: true, matches: found };
    } catch (err) {
      console.error("[useFriends] importContactsAndMatch failed", err);
      toast.error("Couldn't check contacts. Try again.");
      return { success: false, matches: [] };
    } finally {
      setIsImporting(false);
    }
  }, []);

  /** Looks up the current user's friendship state with one specific other user. */
  const getFriendshipStatus = useCallback(async (
    otherUserId: string
  ): Promise<{ status: "pending" | "accepted" | "declined"; direction: "sent" | "received"; friendshipId: string } | null> => {
    if (!user) return null;
    const { data } = await supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status")
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${user.id})`)
      .maybeSingle();
    if (!data) return null;
    return {
      status: data.status as "pending" | "accepted" | "declined",
      direction: data.requester_id === user.id ? "sent" : "received",
      friendshipId: data.id,
    };
  }, [user]);

  /** Looks up users by display name, with each result's friendship status attached. */
  const searchUsersByName = useCallback(async (query: string): Promise<ContactMatch[]> => {
    if (!user || !query.trim()) return [];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, avatar_url")
      .ilike("name", `%${query.trim()}%`)
      .neq("user_id", user.id)
      .limit(20);

    const results = profiles ?? [];
    if (results.length === 0) return [];

    const ids = results.map((p) => p.user_id);
    const { data: friendshipRows } = await supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .in("requester_id", [user.id, ...ids])
      .in("addressee_id", [user.id, ...ids]);

    const friendshipMap = new Map<string, { id: string; status: string; direction: "sent" | "received" }>();
    (friendshipRows ?? []).forEach((f) => {
      const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
      if (!ids.includes(otherId)) return;
      friendshipMap.set(otherId, {
        id: f.id,
        status: f.status,
        direction: f.requester_id === user.id ? "sent" : "received",
      });
    });

    return results.map((p) => {
      const f = friendshipMap.get(p.user_id);
      return {
        user_id: p.user_id,
        name: p.name,
        avatar_url: p.avatar_url,
        friendship_status: (f?.status as ContactMatch["friendship_status"]) ?? null,
        friendship_direction: f?.direction ?? null,
        friendship_id: f?.id ?? null,
      };
    });
  }, [user]);

  const sendFriendRequest = useCallback(async (addresseeId: string): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase.from("friendships").insert({ requester_id: user.id, addressee_id: addresseeId });
    // REQUEST_ALREADY_SENT / ALREADY_FRIENDS from the DB trigger just mean
    // client state was stale — not a real failure, so don't surface an error.
    if (error && !error.message?.includes("REQUEST_ALREADY_SENT") && !error.message?.includes("ALREADY_FRIENDS")) {
      toast.error("Couldn't send friend request");
      return false;
    }
    setMatches((prev) =>
      prev.map((m) => (m.user_id === addresseeId ? { ...m, friendship_status: "pending", friendship_direction: "sent" } : m))
    );
    fetchFriends();
    return true;
  }, [user, fetchFriends]);

  /** Sends requests to every given user at once — the default "add all" action. */
  const sendFriendRequests = useCallback(async (addresseeIds: string[]): Promise<void> => {
    await Promise.all(addresseeIds.map((id) => sendFriendRequest(id)));
  }, [sendFriendRequest]);

  /** Withdraws a request you sent, or unfriends someone — either side may call this on a shared row. */
  const cancelFriendRequest = useCallback(async (friendshipId: string): Promise<boolean> => {
    const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
    if (error) {
      toast.error("Couldn't cancel");
      return false;
    }
    setMatches((prev) =>
      prev.map((m) => (m.friendship_id === friendshipId ? { ...m, friendship_status: null, friendship_direction: null, friendship_id: null } : m))
    );
    setFriends((prev) => prev.filter((f) => f.friendship_id !== friendshipId));
    setPendingReceived((prev) => prev.filter((f) => f.friendship_id !== friendshipId));
    return true;
  }, []);

  const acceptFriendRequest = useCallback(async (friendshipId: string): Promise<boolean> => {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", friendshipId);
    if (error) {
      toast.error("Couldn't accept request");
      return false;
    }
    await fetchFriends();
    return true;
  }, [fetchFriends]);

  const declineFriendRequest = useCallback(async (friendshipId: string): Promise<boolean> => {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("id", friendshipId);
    if (error) {
      toast.error("Couldn't decline request");
      return false;
    }
    await fetchFriends();
    return true;
  }, [fetchFriends]);

  return {
    isImporting,
    matches,
    friends,
    pendingReceived,
    pendingSent,
    isLoadingFriends,
    importContactsAndMatch,
    searchUsersByName,
    getFriendshipStatus,
    sendFriendRequest,
    sendFriendRequests,
    cancelFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    refetchFriends: fetchFriends,
  };
}
