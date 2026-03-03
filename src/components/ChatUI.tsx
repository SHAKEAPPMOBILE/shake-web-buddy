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
                     radial-gradient(ellipse 50% 40% at 80% 70%, rgba(240,90,126,0.08) 0%, transparent 60%)`
      }} />

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
              msg.sender === "me" 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted text-foreground"
            }`}>
              {msg.isGroupStart && msg.senderName && (
                <p className="text-xs font-medium opacity-70 mb-1">{msg.senderName}</p>
              )}
              <p>{msg.text}</p>
              <p className="text-[10px] opacity-50 mt-1 text-right">{msg.time}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-border/30">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Type a message..."
            className="flex-1 bg-muted/50 rounded-full px-4 py-2 text-sm outline-none"
          />
          <button
            onClick={() => send(input)}
            className="bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-medium"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
