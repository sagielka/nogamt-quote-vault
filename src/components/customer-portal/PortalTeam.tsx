import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Users, Trash2 } from 'lucide-react';

interface TeamMember {
  id: string;
  email: string;
  contact_name: string | null;
  status: string;
  created_at: string;
  is_owner: boolean;
}

export const PortalTeam = () => {
  const { toast } = useToast();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const invoke = useCallback(async (action: string, body?: object) => {
    const { data, error } = await supabase.functions.invoke(`portal-team?action=${action}`, {
      method: 'POST',
      body: body || {},
    });
    if (error) {
      const details = (error as any)?.context ? await (error as any).context.text() : error.message;
      let msg = details;
      try { msg = JSON.parse(details).error || details; } catch { /* keep text */ }
      throw new Error(msg);
    }
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await invoke('list');
      setTeam(res.team || []);
      setIsOwner(!!res.is_owner);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [invoke, toast]);

  useEffect(() => { load(); }, [load]);

  const addUser = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      const res = await invoke('add', { email: email.trim(), contactName: name.trim() });
      setTeam(res.team || []);
      setEmail('');
      setName('');
      toast({ title: 'User added', description: res.message });
    } catch (err: any) {
      toast({ title: 'Could not add user', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const removeUser = async (memberId: string) => {
    setBusy(true);
    try {
      const res = await invoke('remove', { memberId });
      setTeam(res.team || []);
      toast({ title: 'Access removed' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="py-10 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-medium">People with access to this account</h3>
          </div>
          <div className="rounded-lg border border-border overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Access</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {team.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-3 py-2">{m.email}</td>
                    <td className="px-3 py-2">{m.contact_name || '—'}</td>
                    <td className="px-3 py-2">
                      {m.is_owner ? (
                        <Badge variant="secondary">Main contact</Badge>
                      ) : m.status === 'approved' ? (
                        <Badge variant="outline">Team member</Badge>
                      ) : (
                        <Badge variant="destructive">Removed</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isOwner && !m.is_owner && m.status === 'approved' && (
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => removeUser(m.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-medium">Add a colleague</h3>
            <p className="text-xs text-muted-foreground">
              They get an email to set a password and see the same price list and quotations. No access to internal app data.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@company.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Name (optional)</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
              </div>
            </div>
            <Button onClick={addUser} disabled={busy || !email.trim()}>
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <UserPlus className="w-4 h-4 mr-1" />}
              Add user
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
