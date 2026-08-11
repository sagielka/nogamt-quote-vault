import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCustomerAccount } from '@/hooks/useCustomerAccount';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, KeyRound } from 'lucide-react';

export const PortalAccountSettings = () => {
  const { user } = useAuth();
  const { account, loading, refresh } = useCustomerAccount();
  const { toast } = useToast();

  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [saving, setSaving] = useState(false);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    setCompany(account?.company_name || '');
    setContact(account?.contact_name || '');
  }, [account?.company_name, account?.contact_name]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = company.trim();
    if (!name) {
      toast({ title: 'Company name is required', variant: 'destructive' });
      return;
    }
    if (name.length > 200 || contact.trim().length > 200) {
      toast({ title: 'Value too long', description: 'Keep entries under 200 characters.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await (supabase.rpc as any)('update_my_portal_account', {
      _company_name: name,
      _contact_name: contact.trim(),
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
      return;
    }
    await refresh();
    toast({ title: 'Account updated' });
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'Password too short', description: 'Use at least 6 characters.', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    setChanging(true);
    const { error } = await supabase.auth.updateUser({ password });
    setChanging(false);
    if (error) {
      toast({ title: 'Could not change password', description: error.message, variant: 'destructive' });
      return;
    }
    setPassword('');
    setConfirm('');
    toast({ title: 'Password updated' });
  };

  if (loading) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!account) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground">
          Account settings are only available on your own portal account.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <Label htmlFor="acc-company">Company name</Label>
              <Input id="acc-company" value={company} maxLength={200} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="acc-contact">Contact name</Label>
              <Input id="acc-contact" value={contact} maxLength={200} onChange={(e) => setContact(e.target.value)} />
            </div>
            <div>
              <Label>Sign-in email</Label>
              <Input value={account.email || user?.email || ''} disabled />
              <p className="text-xs text-muted-foreground mt-1">
                Contact your Noga representative to change your email address.
              </p>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={account.status === 'approved' ? 'secondary' : 'outline'}>{account.status}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Assigned price list</span>
              <Badge variant="outline">{account.price_list || 'Not assigned'}</Badge>
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              Your price list and approval status are managed by Noga.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={changePassword} className="space-y-4">
              <div>
                <Label htmlFor="acc-pass">New password</Label>
                <Input
                  id="acc-pass"
                  type="password"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="acc-pass2">Confirm password</Label>
                <Input
                  id="acc-pass2"
                  type="password"
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" variant="outline" disabled={changing}>
                {changing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
                Update password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
