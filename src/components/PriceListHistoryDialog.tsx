import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, History, Loader2 } from 'lucide-react';

interface HistoryRow {
  id: string;
  previous_price_list: string | null;
  new_price_list: string | null;
  changed_by: string | null;
  changed_at: string;
}

interface Props {
  customerId: string | null;
  customerName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceListOptions: { value: string; label: string }[];
}

export function PriceListHistoryDialog({ customerId, customerName, open, onOpenChange, priceListOptions }: Props) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const labelFor = (value: string | null) => {
    if (!value) return 'No price list';
    return priceListOptions.find((p) => p.value === value)?.label || value;
  };

  useEffect(() => {
    if (!open || !customerId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await (supabase
        .from('customer_price_list_history' as any)
        .select('*')
        .eq('customer_id', customerId)
        .order('changed_at', { ascending: false }) as any);
      if (cancelled) return;
      const list = (data as HistoryRow[]) || [];
      setRows(list);

      const ids = Array.from(new Set(list.map((r) => r.changed_by).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: profiles } = await (supabase
          .from('profiles' as any)
          .select('user_id, display_name')
          .in('user_id', ids) as any);
        if (!cancelled) {
          const map: Record<string, string> = {};
          ((profiles as any[]) || []).forEach((p) => {
            const raw = (p.display_name || '').trim();
            const prefix = raw.includes('@') ? raw.split('@')[0] : raw;
            if (prefix) map[p.user_id] = prefix.charAt(0).toUpperCase() + prefix.slice(1);
          });
          setNames(map);
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, customerId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Price list history
          </DialogTitle>
          <DialogDescription>
            {customerName ? `All price list assignments for ${customerName}, newest first.` : 'All price list assignments over time.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground text-center">No price list has been assigned yet.</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
            {rows.map((r) => (
              <div key={r.id} className="rounded-md border border-border p-3 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <Badge variant="outline">{labelFor(r.previous_price_list)}</Badge>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                  <Badge>{labelFor(r.new_price_list)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.changed_at).toLocaleString()}
                  {r.changed_by ? ` · by ${names[r.changed_by] || 'Unknown'}` : ' · by System'}
                </p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
