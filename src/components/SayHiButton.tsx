import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Hand, MessageCircle, Check } from "lucide-react";
import { useGreetings } from "@/hooks/useGreetings";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "./LoadingSpinner";

interface SayHiButtonProps {
  targetUserId: string;
  targetUserName: string | null;
  onMatch?: () => void;
  size?: "sm" | "default";
  className?: string;
}

export function SayHiButton({
  targetUserId,
  targetUserName,
  onMatch,
  size = "default",
  className = "",
}: SayHiButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { sendGreeting, hasSentGreeting, hasReceivedGreeting, isMatched } = useGreetings();
  const [isSending, setIsSending] = useState(false);

  // Don't show button for own profile
  if (!user || user.id === targetUserId) {
    return null;
  }

  const alreadySent = hasSentGreeting(targetUserId);
  const receivedFromThem = hasReceivedGreeting(targetUserId);
  const matched = isMatched(targetUserId);

  const handleClick = async () => {
    setIsSending(true);
    try {
      const { error } = await sendGreeting(targetUserId);
      if (error) {
        toast({
          title: "Couldn't send hi",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      // Check if this creates a match
      if (receivedFromThem) {
        toast({
          title: "It's a match! 🎉",
          description: `You and ${targetUserName || "this user"} can now chat!`,
        });
        onMatch?.();
      } else {
        toast({
          title: "Hi sent! 👋",
          description: `${targetUserName || "They"} will be notified.`,
        });
      }
    } finally {
      setIsSending(false);
    }
  };

  // Already matched - show chat button
  if (matched) {
    return (
      <Button
        variant="default"
        size={size}
        className={`bg-shake-yellow text-shake-dark hover:bg-shake-yellow/90 ${className}`}
        onClick={onMatch}
      >
        <MessageCircle className="w-4 h-4 mr-1.5" />
        Chat
      </Button>
    );
  }

  // Already sent - show pending state
  if (alreadySent) {
    return (
      <Button
        variant="outline"
        size={size}
        disabled
        className={`border-shake-yellow/50 text-shake-yellow ${className}`}
      >
        <Check className="w-4 h-4 mr-1.5" />
        Hi Sent
      </Button>
    );
  }

  // Received from them - show "Say Hi Back"
  if (receivedFromThem) {
    return (
      <Button
        variant="default"
        size={size}
        onClick={handleClick}
        disabled={isSending}
        className={`bg-shake-yellow text-shake-dark hover:bg-shake-yellow/90 animate-pulse ${className}`}
      >
        {isSending ? (
          <LoadingSpinner size="sm" className="mr-1.5" />
        ) : (
          <Hand className="w-4 h-4 mr-1.5" />
        )}
        Say Hi Back!
      </Button>
    );
  }

  // Default - show "Say Hi"
  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleClick}
      disabled={isSending}
      className={`border-shake-yellow/50 text-shake-yellow hover:bg-shake-yellow/10 ${className}`}
    >
      {isSending ? (
        <LoadingSpinner size="sm" className="mr-1.5" />
      ) : (
        <Hand className="w-4 h-4 mr-1.5" />
      )}
      Say Hi
    </Button>
  );
}
