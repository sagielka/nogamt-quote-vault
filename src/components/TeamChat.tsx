import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface ChatMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  display_name?: string;
  email?: string;
}

export const TeamChat = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [profiles, setProfiles] = useState<Record<string, { display_name: string | null; email: string }>>({});
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSeenRef = useRef<string | null>(null);

  // Load profiles for display names
  useEffect(() => {
    const loadProfiles = async () => {
      const { data } = await (supabase.from('profiles' as any).select('user_id, display_name') as any);
      if (data) {
        const map: Record<string, { display_name: string | null; email: string }> = {};
        data.forEach((p: any) => {
          map[p.user_id] = { display_name: p.display_name, email: '' };
        });
        setProfiles(map);
      }
    };
    loadProfiles();
  }, []);

  // Load messages
  useEffect(() => {
    const loadMessages = async () => {
      const { data } = await (supabase
        .from('messages' as any)
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100) as any);
      if (data) {
        setMessages(data);
        if (data.length > 0) {
          lastSeenRef.current = data[data.length - 1].id;
        }
      }
    };
    loadMessages();
  }, []);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('team-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as ChatMessage;
        setMessages((prev) => [...prev, msg]);
        if (!open && msg.user_id !== user?.id) {
          setUnread((u) => u + 1);
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        setMessages((prev) => prev.filter((m) => m.id !== (payload.old as any).id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, user?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  // Clear unread when opening
  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user) return;
    const content = newMessage.trim();
    setNewMessage('');
    await (supabase.from('messages' as any).insert({ user_id: user.id, content } as any) as any);
  };

  const getUserLabel = (userId: string) => {
    const profile = profiles[userId];
    if (profile?.display_name) return profile.display_name;
    if (userId === user?.id) return user?.email?.split('@')[0] || 'You';
    return userId.slice(0, 6);
  };

  const getInitials = (userId: string) => {
    const label = getUserLabel(userId);
    return label.slice(0, 2).toUpperCase();
  };

  if (!user) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 flex items-center justify-center transition-transform hover:scale-105 no-print"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 h-[28rem] bg-background border rounded-xl shadow-2xl flex flex-col no-print">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 rounded-t-xl">
            <h3 className="font-semibold text-sm text-foreground">Team Chat</h3>
            <span className="text-xs text-muted-foreground">{messages.length} messages</span>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
            {messages.length === 0 && (
              <p className="text-center text-xs text-muted-foreground pt-8">No messages yet. Say hello! 👋</p>
            )}
            {messages.map((msg) => {
              const isMe = msg.user_id === user.id;
              return (
                <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                      {getInitials(msg.user_id)}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`max-w-[75%] ${isMe ? 'text-right' : ''}`}>
                    <p className="text-[10px] text-muted-foreground mb-0.5">
                      {getUserLabel(msg.user_id)} · {format(new Date(msg.created_at), 'HH:mm')}
                    </p>
                    <div className={`px-3 py-1.5 rounded-xl text-sm ${isMe ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted rounded-tl-sm'}`}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <div className="px-3 py-2 border-t">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="text-sm h-9"
                autoFocus
              />
              <Button type="submit" size="sm" className="h-9 px-3" disabled={!newMessage.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
