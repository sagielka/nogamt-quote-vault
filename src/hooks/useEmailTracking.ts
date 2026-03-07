import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface EmailTrackingRecord {
  id: string;
  tracking_id: string;
  quotation_id: string | null;
  recipient_email: string;
  email_type: string;
  sent_at: string;
  read_at: string | null;
  read_count: number;
}

export const useEmailTracking = () => {
  const [tracking, setTracking] = useState<EmailTrackingRecord[]>([]);
  const { user } = useAuth();

  const fetchTracking = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('email_tracking')
      .select('*')
      .order('sent_at', { ascending: false });

    if (!error && data) {
      setTracking(data as unknown as EmailTrackingRecord[]);
    }
  }, [user]);

  useEffect(() => {
    fetchTracking();
  }, [fetchTracking]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('email-tracking-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'email_tracking' },
        () => fetchTracking()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchTracking]);

  const getTrackingForQuotation = useCallback((quotationId: string) => {
    return tracking.filter(t => t.quotation_id === quotationId);
  }, [tracking]);

  const getLatestRead = useCallback((quotationId: string): EmailTrackingRecord | null => {
    const records = tracking
      .filter(t => t.quotation_id === quotationId && t.read_at)
      .sort((a, b) => new Date(b.read_at!).getTime() - new Date(a.read_at!).getTime());
    return records[0] || null;
  }, [tracking]);

  return { tracking, getTrackingForQuotation, getLatestRead, refreshTracking: fetchTracking };
};
