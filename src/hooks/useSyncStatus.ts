import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type SyncStatus = 'connected' | 'connecting' | 'disconnected';

export const useSyncStatus = () => {
  const [status, setStatus] = useState<SyncStatus>('disconnected');
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setStatus('disconnected');
      return;
    }

    setStatus('connecting');

    const channel = supabase
      .channel('sync-status-monitor')
      .on('presence', { event: 'sync' }, () => {
        setStatus('connected');
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setStatus('disconnected');
        } else if (status === 'TIMED_OUT') {
          setStatus('disconnected');
        }
      });

    // Track presence to keep channel alive
    channel.track({ user_id: user.id, online_at: new Date().toISOString() });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return status;
};
