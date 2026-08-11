import { useEffect, useState } from 'react';
import { Mic } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface VoiceMessagePlayerProps {
  path: string;
  duration?: number;
  isMe?: boolean;
}

export const VoiceMessagePlayer = ({ path, duration, isMe }: VoiceMessagePlayerProps) => {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error: err } = await supabase.storage
        .from('voice-messages')
        .createSignedUrl(path, 3600);
      if (cancelled) return;
      if (err || !data?.signedUrl) {
        setError(true);
        return;
      }
      setUrl(data.signedUrl);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (error) {
    return <span className="text-xs text-muted-foreground">Voice message unavailable</span>;
  }

  return (
    <div className={`flex items-center gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
      <Mic className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
      {url ? (
        <audio controls src={url} className="h-8 max-w-[200px]" preload="none" />
      ) : (
        <span className="text-xs text-muted-foreground">Loading…</span>
      )}
      {duration ? (
        <span className="text-[10px] text-muted-foreground">
          {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
        </span>
      ) : null}
    </div>
  );
};
