import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Hand, MessageCircle, User, Bell } from "lucide-react";
import { useGreetings } from "@/hooks/useGreetings";
import { useAuth } from "@/contexts/AuthContext";
import { SayHiButton } from "./SayHiButton";
import { PrivateChatDialog } from "./PrivateChatDialog";
import { format } from "date-fns";

export function GreetingsIndicator() {
  const { user } = useAuth();
  const { pendingReceived, matches, isLoading } = useGreetings();
  const [showDialog, setShowDialog] = useState(false);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [selectedChatUser, setSelectedChatUser] = useState<{
    userId: string;
    userName: string | null;
    avatarUrl: string | null;
  } | null>(null);

  if (!user) return null;

  const totalNotifications = pendingReceived.length + matches.length;

  const handleOpenChat = (userId: string, userName: string | null, avatarUrl: string | null) => {
    setSelectedChatUser({ userId, userName, avatarUrl });
    setShowChatDialog(true);
  };

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl hover:bg-muted/50 transition-colors"
      >
        <Hand className="w-5 h-5 text-foreground" />
        <span className="text-[10px] font-medium text-foreground">Hi's</span>
        {totalNotifications > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 bg-shake-yellow text-shake-dark rounded-full border-2 border-background flex items-center justify-center text-[10px] font-bold animate-pulse">
            {totalNotifications}
          </span>
        )}
      </button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Hand className="w-5 h-5 text-shake-yellow" />
              Greetings
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="pending" className="relative">
                <Bell className="w-4 h-4 mr-1.5" />
                New
                {pendingReceived.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-shake-yellow text-shake-dark text-xs font-bold">
                    {pendingReceived.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="matches" className="relative">
                <MessageCircle className="w-4 h-4 mr-1.5" />
                Matches
                {matches.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-shake-yellow text-shake-dark text-xs font-bold">
                    {matches.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-shake-yellow border-t-transparent rounded-full animate-spin" />
                </div>
              ) : pendingReceived.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  No new greetings yet. 
                  <br />
                  <span className="text-xs">Say hi to someone first!</span>
                </p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {pendingReceived.map((greeting) => (
                    <div
                      key={greeting.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border">
                        {greeting.from_user?.avatar_url ? (
                          <img
                            src={greeting.from_user.avatar_url}
                            alt={greeting.from_user.name || "User"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {greeting.from_user?.name || "Shaker"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Said hi {format(new Date(greeting.created_at), "MMM d")}
                        </p>
                      </div>
                      <SayHiButton
                        targetUserId={greeting.from_user_id}
                        targetUserName={greeting.from_user?.name || null}
                        size="sm"
                        onMatch={() =>
                          handleOpenChat(
                            greeting.from_user_id,
                            greeting.from_user?.name || null,
                            greeting.from_user?.avatar_url || null
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="matches" className="mt-4">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-shake-yellow border-t-transparent rounded-full animate-spin" />
                </div>
              ) : matches.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  No matches yet.
                  <br />
                  <span className="text-xs">When someone says hi back, they'll appear here!</span>
                </p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {matches.map((match) => (
                    <button
                      key={match.id}
                      onClick={() =>
                        handleOpenChat(
                          match.from_user_id,
                          match.from_user?.name || null,
                          match.from_user?.avatar_url || null
                        )
                      }
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-shake-yellow">
                        {match.from_user?.avatar_url ? (
                          <img
                            src={match.from_user.avatar_url}
                            alt={match.from_user.name || "User"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="font-medium text-sm truncate">
                          {match.from_user?.name || "Shaker"}
                        </p>
                        <p className="text-xs text-shake-yellow">
                          Matched! Tap to chat 💬
                        </p>
                      </div>
                      <MessageCircle className="w-5 h-5 text-shake-yellow" />
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {selectedChatUser && (
        <PrivateChatDialog
          open={showChatDialog}
          onOpenChange={setShowChatDialog}
          otherUserId={selectedChatUser.userId}
          otherUserName={selectedChatUser.userName}
          otherUserAvatar={selectedChatUser.avatarUrl}
        />
      )}
    </>
  );
}
