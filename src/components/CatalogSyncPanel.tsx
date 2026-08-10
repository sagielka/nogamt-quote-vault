import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { RefreshCw, CloudDownload, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface SyncState {
  drive_file_name: string | null;
  drive_modified_time: string | null;
  last_sync_at: string | null;
  last_status: string | null;
  last_error: string | null;
  items_added: number;
  items_updated: number;
}

export const CatalogSyncPanel = () => {
  const [state, setState] = useState<SyncState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  const load = async () => {
    const [{ data }, { count: total }] = await Promise.all([
      supabase
        .from('catalog_sync_state')
        .select('drive_file_name, drive_modified_time, last_sync_at, last_status, last_error, items_added, items_updated')
        .eq('id', 'default')
        .maybeSingle(),
      supabase.from('catalog_prices').select('sku', { count: 'exact', head: true }),
    ]);
    setState(data as SyncState | null);
    setCount(total ?? 0);
  };

  useEffect(() => {
    load();
  }, []);

  const runSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-catalog-drive', {
        body: { force: true },
      });
      if (error) throw error;
      if (data?.status === 'up_to_date') {
        toast.success('Price list already up to date');
      } else {
        toast.success(`Synced ${data?.total ?? 0} items (${data?.added ?? 0} new, ${data?.updated ?? 0} updated)`);
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString() : '—');

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CloudDownload className="h-5 w-5" />
            Google Drive price sync
          </CardTitle>
          <CardDescription>
            Items and prices are pulled automatically every night from{' '}
            <span className="font-medium">{state?.drive_file_name ?? 'the master price list'}</span>.
          </CardDescription>
        </div>
        <Button onClick={runSync} disabled={syncing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync now'}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
        <div>Items in catalog: <span className="font-medium">{count ?? '—'}</span></div>
        <div>Last sync: <span className="font-medium">{fmt(state?.last_sync_at ?? null)}</span></div>
        <div>File last changed: <span className="font-medium">{fmt(state?.drive_modified_time ?? null)}</span></div>
        <div className="flex items-center gap-2">
          Status:
          {state?.last_status === 'error' ? (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> Error
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> {state?.last_status ?? 'never run'}
            </Badge>
          )}
        </div>
        {state?.last_status === 'error' && state.last_error && (
          <div className="sm:col-span-2 text-destructive">{state.last_error}</div>
        )}
        {(state?.items_added ?? 0) + (state?.items_updated ?? 0) > 0 && (
          <div className="sm:col-span-2 text-muted-foreground">
            Last run: {state?.items_added} added, {state?.items_updated} updated
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CatalogSyncPanel;
