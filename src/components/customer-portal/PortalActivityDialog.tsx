import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Activity } from 'lucide-react';
import {
  usePortalActivity,
  PORTAL_EVENT_LABELS,
  type PortalActivityEntry,
} from '@/hooks/usePortalActivity';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  userIds: string[];
}

export const PortalActivityDialog = ({ open, onOpenChange, title, userIds }: Props) => {
  const { getActivity } = usePortalActivity();
  const [rows, setRows] = useState<PortalActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const ids = useMemo(() => userIds.filter(Boolean), [userIds]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getActivity(ids).then((r) => {
      setRows(r);
      setLoading(false);
    });
  }, [open, ids, getActivity]);

  const lastVisit = rows.find((r) => r.event === 'portal_visit');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="w-4 h-4" /> Portal activity — {title}
          </DialogTitle>
          <DialogDescription>
            {lastVisit
              ? `Last visit: ${new Date(lastVisit.created_at).toLocaleString()}`
              : 'Sign-ins, price views, downloads and quote requests.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No portal activity recorded yet for this account.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="flex items-start gap-3 border rounded-md p-3 text-sm">
                <Badge variant="outline" className="shrink-0">
                  {PORTAL_EVENT_LABELS[r.event] || r.event}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="break-all">{r.email || r.user_id}</p>
                  {r.details && Object.keys(r.details).length > 0 && (
                    <p className="text-xs text-muted-foreground break-all">
                      {Object.entries(r.details)
                        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
                        .join(' · ')}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(r.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
