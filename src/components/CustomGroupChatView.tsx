import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, Camera, MoreVertical, MapPin, UserPlus, Users, Trash2, LogOut, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/app-toast";
import { format } from "date-fns";
import { MinimalBackButton } from "@/components/MinimalBackButton";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { LocationBubble } from "@/components/LocationBubble";
import { AddPersonDialog } from "@/components/AddPersonDialog";
import { ShakeGlassDialog } from "@/components/ShakeGlassDialog";
import { ChatMoreMenu } from "@/components/ChatMoreMenu";
import { getCurrentLatLng, encodeLocation } from "@/lib/location";
import { getDisplayAvatarUrl } from "@/lib/avatar";
import { uploadChatMedia, getMediaMessageType, CHAT_MEDIA_MAX_SIZE_MB } from "@/lib/chatMediaUpload";
import { useFloatingBubbles, isDenseText, estimateTextHeight } from "@/hooks/useFloatingBubbles";
import { useChatKeyboardScroll } from "@/hooks/useChatKeyboardScroll";

// The group-chat tables are newer than the generated Supabase types.
const db = supabase as any;

interface Member { user_id: string; name: string | null; avatar_url: string | null }
interface GroupMessage { id: string; user_id: string; message: string; message_type: string | null; created_at: string }

/** Full-page chat for a custom group: anyone can add people, only the creator
 *  removes members or deletes it. Same floating-bubble look as the DMs. */
export function CustomGroupChatView({ chatId, onClose }: { chatId: string; onClose: () => void }) {
  const { user } = useAuth();
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [confirm, setConfirm] = useState<null | "delete" | "leave">(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isCreator = !!user && creatorId === user.id;

  const loadMembers = useCallback(async () => {
    const { data: rows } = await db.from("group_chat_members").select("user_id").eq("chat_id", chatId);
    const ids: string[] = (rows ?? []).map((r: { user_id: string }) => r.user_id);
    if (!user || !ids.includes(user.id)) { onClose(); return; } // removed from the group
    const { data: profiles } = await supabase.from("profiles").select("user_id, name, avatar_url").in("user_id", ids);
    const map = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    setMembers(ids.map((id) => ({ user_id: id, name: map.get(id)?.name ?? null, avatar_url: map.get(id)?.avatar_url ?? null })));
  }, [chatId, user, onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: chat } = await db.from("group_chats").select("creator_id").eq("id", chatId).maybeSingle();
      if (cancelled) return;
      if (!chat) { onClose(); return; } // deleted
      setCreatorId(chat.creator_id);
      await loadMembers();
      const { data: msgs } = await db.from("group_chat_messages").select("id, user_id, message, message_type, created_at").eq("chat_id", chatId).order("created_at", { ascending: true }).limit(500);
      if (cancelled) return;
      setMessages(msgs ?? []);
      setIsLoading(false);
    })();

    const channel = supabase
      .channel(`group-chat:${chatId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_chat_messages", filter: `chat_id=eq.${chatId}` }, (payload) => {
        const m = payload.new as GroupMessage;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "group_chat_messages", filter: `chat_id=eq.${chatId}` }, (payload) => {
        const id = (payload.old as { id?: string }).id;
        if (id) setMessages((prev) => prev.filter((x) => x.id !== id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_chat_members", filter: `chat_id=eq.${chatId}` }, () => { void loadMembers(); })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "group_chats", filter: `id=eq.${chatId}` }, () => { toast.info("This group was deleted"); onClose(); })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // Opening the group (and receiving messages while it's open) counts as reading it.
  useEffect(() => {
    if (!user) return;
    void db.rpc("mark_group_chat_read", { p_chat: chatId });
  }, [chatId, user, messages.length]);

  const memberById = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);
  const title = useMemo(() => {
    const others = members.filter((m) => m.user_id !== user?.id).map((m) => (m.name || "Shaker").split(" ")[0]);
    return others.length ? others.join(", ") : "Group";
  }, [members, user?.id]);

  const floatItems = useMemo(() => messages.map((msg) => {
    const isLocation = msg.message_type === "location";
    const isMedia = isLocation || (["gif", "image", "video"].includes(msg.message_type ?? "") && /^https?:\/\//i.test(msg.message));
    const dense = !isMedia && isDenseText(msg.message);
    return { id: msg.id, isMedia, isStatic: dense || isMedia, alignRight: msg.user_id === user?.id, estHeight: isMedia ? 200 : dense ? estimateTextHeight(msg.message) : undefined };
  }), [messages, user?.id]);
  const { canvasHeight, isPinned, getBubbleProps, getClickHandler, calmDown } = useFloatingBubbles(floatItems, scrollRef);

  const scrollToBottom = useCallback(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, []);
  useEffect(() => { const id = requestAnimationFrame(scrollToBottom); return () => cancelAnimationFrame(id); }, [messages, scrollToBottom]);
  useChatKeyboardScroll(scrollToBottom);

  const send = useCallback(async (message: string, type: string = "text") => {
    if (!user) return { error: new Error("no user") };
    return db.from("group_chat_messages").insert({ chat_id: chatId, user_id: user.id, message, message_type: type });
  }, [user, chatId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || isSending) return;
    setIsSending(true);
    const { error } = await send(t);
    setIsSending(false);
    if (error) toast.error("Failed to send"); else setText("");
  };

  const sharingLocationRef = useRef(false);
  const handleShareLocation = async () => {
    if (sharingLocationRef.current) return; // ignore double taps
    sharingLocationRef.current = true;
    try {
      const pos = await getCurrentLatLng();
      const { error } = await send(encodeLocation(pos), "location");
      if (error) throw error;
    } catch (err) {
      console.error("Share location failed:", err);
      toast.error("Couldn't get your location. Check location permission and try again.");
    } finally {
      sharingLocationRef.current = false;
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = "";
    if (file.size > CHAT_MEDIA_MAX_SIZE_MB * 1024 * 1024) { toast.error(`File too large. Maximum size is ${CHAT_MEDIA_MAX_SIZE_MB}MB.`); return; }
    setIsUploading(true);
    try {
      const url = await uploadChatMedia(file, user.id);
      const { error } = await send(url, getMediaMessageType(file));
      if (error) throw error;
    } catch { toast.error("Failed to send media"); } finally { setIsUploading(false); }
  };

  const handleAdd = async (p: { user_id: string; name: string | null }) => {
    setShowAdd(false);
    const { error } = await db.rpc("add_group_chat_member", { p_chat: chatId, p_user: p.user_id });
    if (error) toast.error("Couldn't add them"); else toast.success(`${p.name || "They"} joined the group`);
  };

  const handleKick = async (userId: string) => {
    const { error } = await db.rpc("remove_group_chat_member", { p_chat: chatId, p_user: userId });
    if (error) toast.error("Couldn't remove them");
  };

  const handleConfirm = async () => {
    const which = confirm;
    setConfirm(null);
    if (which === "delete") {
      const { error } = await db.from("group_chats").delete().eq("id", chatId);
      if (error) { toast.error("Couldn't delete the group"); return; }
      onClose();
    } else if (which === "leave") {
      const { error } = await db.rpc("leave_group_chat", { p_chat: chatId });
      if (error) { toast.error("Couldn't leave the group"); return; }
      onClose();
    }
  };

  const menuItems = [
    { key: "loc", label: "Share location", icon: <MapPin className="w-4 h-4" />, onSelect: () => void handleShareLocation() },
    { key: "add", label: "Add someone", icon: <UserPlus className="w-4 h-4" />, onSelect: () => setShowAdd(true) },
    { key: "members", label: "Members", icon: <Users className="w-4 h-4" />, onSelect: () => setShowMembers(true) },
    isCreator
      ? { key: "delete", label: "Delete group", icon: <Trash2 className="w-4 h-4" />, danger: true, onSelect: () => setConfirm("delete") }
      : { key: "leave", label: "Leave group", icon: <LogOut className="w-4 h-4" />, danger: true, onSelect: () => setConfirm("leave") },
  ];

  return (
    <>
      <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: "hsl(50,40%,92%)" }}>
        <div className="flex items-center gap-3 px-4 pb-3 border-b shrink-0" style={{ borderColor: "rgba(0,0,0,0.08)", paddingTop: "env(safe-area-inset-top)" }}>
          <MinimalBackButton onClick={onClose} className="shrink-0 text-gray-900" aria-label="Back" iconClassName="w-6 h-6" />
          <button type="button" onClick={() => setShowMembers(true)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
            <span className="flex -space-x-2 shrink-0">
              {members.filter((m) => m.user_id !== user?.id).slice(0, 3).map((m) => (
                <span key={m.user_id} className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
                  {m.avatar_url ? <img src={getDisplayAvatarUrl(m.avatar_url) ?? m.avatar_url} alt="" className="w-full h-full object-cover" /> : (m.name || "S").charAt(0).toUpperCase()}
                </span>
              ))}
            </span>
            <span className="min-w-0">
              <h2 className="font-display text-lg text-gray-900 truncate leading-tight">{title}</h2>
              <p className="text-[11px] text-gray-500 leading-tight">{members.length} people</p>
            </span>
          </button>
          <ChatMoreMenu items={menuItems} />
        </div>

        <div className="relative flex-1 min-h-0 overflow-y-auto py-4" ref={scrollRef}>
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><LoadingSpinner size="lg" /></div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">No messages yet.</p>
              <p className="text-xs mt-1 text-gray-400">Say hi to the group!</p>
            </div>
          ) : (
            <div className="relative" style={{ height: canvasHeight }} onClick={(e) => { if (e.target === e.currentTarget) calmDown(); }}>
              {messages.map((msg) => {
                const isMe = msg.user_id === user?.id;
                const isLocation = msg.message_type === "location";
                const isImage = msg.message_type === "image" && /^https?:\/\//i.test(msg.message);
                const isVideo = msg.message_type === "video" && /^https?:\/\//i.test(msg.message);
                const isGif = msg.message_type === "gif" && /^https?:\/\//i.test(msg.message);
                const isMedia = isLocation || isImage || isVideo || isGif;
                const pinned = isPinned(msg.id);
                const sender = memberById.get(msg.user_id);
                const { style: floatStyle, ...floatProps } = getBubbleProps(msg.id);
                return (
                  <div key={msg.id} {...floatProps} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`} style={{ ...floatStyle, zIndex: pinned ? 10 : 1 }}>
                    {!isMe && <span className="text-[10px] font-semibold text-gray-500 px-2 mb-0.5">{(sender?.name || "Shaker").split(" ")[0]}</span>}
                    <div
                      className={`max-w-[min(78vw,320px)] w-fit min-w-0 cursor-pointer ${isMedia ? "shrink-0 overflow-visible" : "px-3 py-2 rounded-2xl"}`}
                      style={{
                        ...(isMedia ? undefined : isMe ? { background: "#00C6B6", border: "1px solid rgba(0,198,182,0.4)" } : { background: "white", border: "1px solid rgba(0,0,0,0.08)" }),
                        boxShadow: pinned ? "0 0 0 3px rgba(255,178,56,0.55), 0 4px 14px rgba(0,0,0,0.18)" : undefined,
                      }}
                      onClick={getClickHandler(msg.id)}
                    >
                      {isLocation ? <LocationBubble message={msg.message} />
                        : isImage || isGif ? <img src={msg.message} alt="shared" className="rounded-2xl max-w-[260px] w-full object-cover" onLoad={scrollToBottom} />
                        : isVideo ? <video src={msg.message} controls playsInline preload="metadata" className="rounded-2xl max-w-[260px] w-full bg-black/30" onLoadedMetadata={scrollToBottom} />
                        : <p className={`text-sm break-words ${isMe ? "text-white" : "text-gray-900"}`}>{msg.message}</p>}
                      {pinned && !isMedia && <p className={`text-[10px] mt-1 ${isMe ? "text-white/70" : "text-gray-400"}`}>{format(new Date(msg.created_at), "HH:mm")}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <input ref={fileRef} type="file" accept="video/*,image/*" className="hidden" onChange={handleFile} />
        <form onSubmit={handleSend} className="px-4 pb-4 pt-2 border-t shrink-0" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="icon" className="shrink-0 h-9 w-9 hover:bg-black/10 text-gray-500" onClick={() => fileRef.current?.click()} disabled={isUploading} aria-label="Attach photo or video">
              {isUploading ? <LoadingSpinner size="sm" /> : <Camera className="w-5 h-5" />}
            </Button>
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message..." className="flex-1 rounded-full bg-white/80 border-black/10" />
            <Button type="submit" size="icon" disabled={!text.trim() || isSending} className="shrink-0 rounded-full h-10 w-10" style={{ background: "#F8D44C" }} aria-label="Send">
              <Send className="w-4 h-4 text-gray-900" />
            </Button>
          </div>
        </form>
      </div>

      {showAdd && <AddPersonDialog excludeIds={members.map((m) => m.user_id)} onPick={handleAdd} onClose={() => setShowAdd(false)} />}

      {showMembers && (
        <ShakeGlassDialog onClose={() => setShowMembers(false)} zIndex={20001}>
          <h2 className="text-lg font-bold text-gray-900">Members</h2>
          <div className="max-h-72 overflow-y-auto text-left -mx-1">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-3 px-2 py-2">
                <span className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center shrink-0 text-sm font-semibold text-gray-600">
                  {m.avatar_url ? <img src={getDisplayAvatarUrl(m.avatar_url) ?? m.avatar_url} alt="" className="w-full h-full object-cover" /> : (m.name || "S").charAt(0).toUpperCase()}
                </span>
                <span className="text-sm font-medium text-gray-900 truncate flex-1">
                  {m.user_id === user?.id ? "You" : m.name || "Shaker"}
                  {m.user_id === creatorId && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-gray-500">Admin</span>}
                </span>
                {isCreator && m.user_id !== user?.id && (
                  <button type="button" onClick={() => handleKick(m.user_id)} className="p-1.5 rounded-full hover:bg-red-50 text-red-500" aria-label={`Remove ${m.name || "member"}`}>
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setShowMembers(false)} className="w-full text-sm text-muted-foreground hover:text-foreground py-1">Close</button>
        </ShakeGlassDialog>
      )}

      {confirm && (
        <ShakeGlassDialog zIndex={20001} onClose={() => setConfirm(null)} icon={confirm === "delete" ? "🗑️" : "👋"}>
          <h2 className="text-lg font-bold text-gray-900">{confirm === "delete" ? "Delete this group?" : "Leave this group?"}</h2>
          <p className="text-sm text-gray-600">
            {confirm === "delete" ? "It disappears for everyone and can't be undone." : "You'll stop seeing this chat. Someone in the group can add you back."}
          </p>
          <button type="button" onClick={handleConfirm} className="w-full h-11 rounded-full font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors">
            {confirm === "delete" ? "Delete group" : "Leave group"}
          </button>
          <button type="button" onClick={() => setConfirm(null)} className="w-full text-sm text-muted-foreground hover:text-foreground py-1">Cancel</button>
        </ShakeGlassDialog>
      )}
    </>
  );
}
