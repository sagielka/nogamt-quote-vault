import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, Volume2, VolumeX, Mic, Square, Trash2, Loader2 } from 'lucide-react';
import { VoiceMessagePlayer } from '@/components/VoiceMessagePlayer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface ChatMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  display_name?: string;
  email?: string;
}

export const TeamChat = ({ userNameMap = {} }: { userNameMap?: Record<string, string> }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [profiles, setProfiles] = useState<Record<string, { display_name: string | null; email: string }>>({});
  const [unread, setUnread] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const stored = localStorage.getItem('chat-sound-enabled');
    return stored !== null ? stored === 'true' : true;
  });
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordStartRef = useRef<number | null>(null);
  const cancelRecordRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSeenRef = useRef<string | null>(null);
  const { toast } = useToast();

  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch {
      // Audio not supported
    }
  }, []);

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

  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);
  const soundRef = useRef(soundEnabled);
  useEffect(() => { soundRef.current = soundEnabled; }, [soundEnabled]);

  const mergeMessages = useCallback((incoming: ChatMessage[]) => {
    setMessages((prev) => {
      const map = new Map(prev.map((m) => [m.id, m]));
      incoming.forEach((m) => map.set(m.id, m));
      return Array.from(map.values()).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
  }, []);

  const fetchMessages = useCallback(async () => {
    const { data } = await (supabase
      .from('messages' as any)
      .select('*')
      .order('created_at', { ascending: true })
      .limit(200) as any);
    if (!data) return;
    mergeMessages(data as ChatMessage[]);
  }, [mergeMessages]);

  // Initial load + polling fallback (in case realtime is unavailable)
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 8000);
    const onFocus = () => fetchMessages();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchMessages]);

  // Notify on genuinely new messages from others
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (lastSeenRef.current === null) {
      lastSeenRef.current = last.id;
      return;
    }
    if (lastSeenRef.current === last.id) return;
    lastSeenRef.current = last.id;
    if (last.user_id !== user?.id) {
      if (soundRef.current) playNotificationSound();
      if (!openRef.current) setUnread((u) => u + 1);
    }
  }, [messages, user?.id, playNotificationSound]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('team-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        mergeMessages([payload.new as ChatMessage]);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        setMessages((prev) => prev.filter((m) => m.id !== (payload.old as any).id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mergeMessages]);

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
    const { data, error } = await (supabase
      .from('messages' as any)
      .insert({ user_id: user.id, content } as any)
      .select()
      .maybeSingle() as any);
    if (error) {
      setNewMessage(content);
      toast({ title: 'Message not sent', description: error.message, variant: 'destructive' });
      return;
    }
    if (data) mergeMessages([data as ChatMessage]);
  };

  const startRecording = async () => {
    if (!user) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const seconds = Math.max(1, Math.round((Date.now() - (recordStartRef.current || Date.now())) / 1000));
        const blob = new Blob(chunks, { type: mime });
        setRecording(false);
        setRecordSeconds(0);
        if (cancelRecordRef.current) {
          cancelRecordRef.current = false;
          return;
        }
        if (blob.size < 1500) {
          toast({ title: 'Recording too short', description: 'Hold the mic a bit longer.', variant: 'destructive' });
          return;
        }
        setUploading(true);
        const ext = mime === 'audio/webm' ? 'webm' : 'm4a';
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('voice-messages')
          .upload(path, blob, { contentType: mime, upsert: false });
        if (upErr) {
          setUploading(false);
          toast({ title: 'Voice message not sent', description: upErr.message, variant: 'destructive' });
          return;
        }
        const { data, error } = await (supabase
          .from('messages' as any)
          .insert({ user_id: user.id, content: `voice:${path}:${seconds}` } as any)
          .select()
          .maybeSingle() as any);
        setUploading(false);
        if (error) {
          toast({ title: 'Voice message not sent', description: error.message, variant: 'destructive' });
          return;
        }
        if (data) mergeMessages([data as ChatMessage]);
      };
      recorderRef.current = recorder;
      cancelRecordRef.current = false;
      recordStartRef.current = Date.now();
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = window.setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      toast({
        title: 'Microphone unavailable',
        description: 'Allow microphone access to record a voice message.',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = (cancel = false) => {
    cancelRecordRef.current = cancel;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    recorderRef.current?.state === 'recording' && recorderRef.current.stop();
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorderRef.current?.state === 'recording') {
        cancelRecordRef.current = true;
        recorderRef.current.stop();
      }
    };
  }, []);




  const getUserLabel = (userId: string) => {
    if (userNameMap[userId]) return userNameMap[userId];
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const next = !soundEnabled;
                  setSoundEnabled(next);
                  localStorage.setItem('chat-sound-enabled', String(next));
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title={soundEnabled ? 'Mute notifications' : 'Unmute notifications'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <span className="text-xs text-muted-foreground">{messages.length} messages</span>
            </div>
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
                      {msg.content.startsWith('voice:') ? (
                        (() => {
                          const rest = msg.content.slice(6);
                          const lastColon = rest.lastIndexOf(':');
                          const path = lastColon > 0 ? rest.slice(0, lastColon) : rest;
                          const dur = lastColon > 0 ? Number(rest.slice(lastColon + 1)) : undefined;
                          return <VoiceMessagePlayer path={path} duration={dur} isMe={isMe} />;
                        })()
                      ) : (
                        msg.content
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <div className="px-3 py-2 border-t">
            {recording ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-2 flex-1 text-sm text-destructive">
                  <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                  Recording {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, '0')}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-9 px-3"
                  onClick={() => stopRecording(true)}
                  aria-label="Cancel recording"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 px-3"
                  onClick={() => stopRecording(false)}
                  aria-label="Send voice message"
                >
                  <Square className="w-4 h-4" />
                </Button>
              </div>
            ) : (
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
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 px-3"
                  onClick={startRecording}
                  disabled={uploading}
                  aria-label="Record voice message"
                  title="Record voice message"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                </Button>
                <Button type="submit" size="sm" className="h-9 px-3" disabled={!newMessage.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            )}
          </div>

        </div>
      )}
    </>
  );
};