import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PRICE_LISTS } from '@/data/product-catalog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, UserCheck, UserX } from 'lucide-react';

interface Row {
  id: string;
  email: string;
  company_name: string | null;
  contact_name: string | null;
  status: string;
  price_list: string | null;
  created_at: string;
}

export const CustomerAccountsAdmin = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase
      .from('customer_accounts' as any)
      .select('*')
      .order('created_at', { ascending: false }) as any);
    setRows((data || []) as Row[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (id: string, values: Record<string, any>) => {
    const { error } = await (supabase
      .from('customer_accounts' as any)
      .update(values as any)
      .eq('id', id) as any);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    await load();
  };

  const approve = (row: Row) => {
    if (!row.price_list) {
      toast({ title: 'Choose a price list first', description: 'Assign a price list before approving.', variant: 'destructive' });
      return;
    }
    patch(row.id, { status: 'approved', approved_by: user?.id, approved_at: new Date().toISOString() });
    toast({ title: 'Customer approved', description: `${row.email} can now see their prices.` });
  };

  const statusBadge = (status: string) => {
    if (status === 'approved') return <Badge className="bg-emerald-600 hover:bg-emerald-600">Approved</Badge>;
    if (status === 'rejected') return <Badge variant="destructive">Rejected</Badge>;
    return <Badge variant="secondary">Pending</Badge>;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h2 className="heading-display text-xl">Customer Portal Accounts</h2>
        <span className="text-xs text-muted-foreground ml-auto">{rows.length} accounts</span>
      </div>

      {rows.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            No customers have requested portal access yet.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {rows.map((row) => (
          <Card key={row.id}>
            <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{row.company_name || '—'}</span>
                  {statusBadge(row.status)}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {row.email}
                  {row.contact_name ? ` · ${row.contact_name}` : ''}
                </p>
              </div>

              <Select
                value={row.price_list || undefined}
                onValueChange={(v) => patch(row.id, { price_list: v })}
              >
                <SelectTrigger className="w-full md:w-56">
                  <SelectValue placeholder="Assign price list" />
                </SelectTrigger>
                <SelectContent>
                  {PRICE_LISTS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                {row.status !== 'approved' && (
                  <Button size="sm" onClick={() => approve(row)}>
                    <UserCheck className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                )}
                {row.status !== 'rejected' && (
                  <Button size="sm" variant="outline" onClick={() => patch(row.id, { status: 'rejected' })}>
                    <UserX className="w-4 h-4 mr-2" />
                    {row.status === 'approved' ? 'Revoke' : 'Reject'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default CustomerAccountsAdmin;
