import { useState, useEffect, useRef } from "react";

interface Message {
  id: string;
  text: string;
  sender: "me" | "them";
  senderName?: string;
  time: string;
  isGroupStart?: boolean;
}

interface ChatUIProps {
  activityName?: string;
  activityEmoji?: string;
  date?: string;
  location?: string;
  members?: { avatar_url?: string; name: string }[];
  messages?: Message[];
  onSend?: (text: string) => void;
  onBack?: () => void;
}

export default function ChatUI({
  activityName = "Sunday Brunch",
  activityEmoji = "🥐",
  date = "Sun, Mar 2",
  location = "El Poblado, Medellín",
  members = [],
  messages: initialMessages = [],
  onSend,
  onBack,
}: ChatUIProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const now = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const send = (text: string) => {
    if (!text.trim()) return;
    const msg: Message = {
      id: Date.now().toString(),
      text,
      sender: "me",
      time: now(),
      isGroupStart: true,
    };
    setMessages((prev) => [...prev, msg]);
    onSend?.(text);
    setInput("");
  };

  return (
    <div className="flex flex-col h-screen max-w-[430px] mx-auto overflow-hidden"
      style={{ background: "#06060a" }}>

      <div className="fixed inset-0 pointer-events-none" style={{
        background: `radial-gradient(ellipse 70% 50% at 30% 20%, rgba(124,92,252,0.12) 0%, transparent 60%),
                     radial-gradient(ellipse 50% 40% at 80% 70%, rgba(240,90,126,0.
