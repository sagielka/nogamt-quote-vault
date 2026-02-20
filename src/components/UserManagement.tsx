import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Shield, ShieldOff, RefreshCw, Users, Eye, UserCog, Ban, CheckCircle, Circle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ManagedUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  role: string;
  display_name: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  banned: boolean;
  quotation_count: number;
}

export const UserManagement = () => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/admin-users?action=list`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch users');
      }
      
      const result = await res.json();
      setUsers(result.users || []);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to fetch users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const invokeAdminAction = async (action: string, body: object) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/admin-users?action=${action}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  };

  const handleRoleChange = async (userId: string, role: string) => {
    setActionLoading(userId);
    try {
      await invokeAdminAction('update-role', { userId, role });
      toast({ title: 'Role Updated', description: `User role changed to ${role}.` });
      await fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to update role', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleBan = async (userId: string, ban: boolean) => {
    setActionLoading(userId);
    try {
      await invokeAdminAction('toggle-ban', { userId, ban });
      toast({
        title: ban ? 'User Deactivated' : 'User Activated',
        description: ban ? 'User has been banned from signing in.' : 'User can now sign in again.',
      });
      await fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to update user', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isOnline = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    const diff = Date.now() - new Date(lastSeen).getTime();
    return diff < 5 * 60 * 1000; // Online if seen within 5 minutes
  };

  const roleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'viewer': return 'secondary';
      default: return 'outline';
    }
  };

  const roleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="w-3 h-3" />;
      case 'viewer': return <Eye className="w-3 h-3" />;
      default: return <UserCog className="w-3 h-3" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-muted-foreground" />
          <h2 className="heading-display text-2xl text-foreground">User Management</h2>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{users.length} user{users.length !== 1 ? 's' : ''}</p>
          <Button variant="outline" size="sm" onClick={fetchUsers}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {users.map((u) => (
          <div
            key={u.id}
            className={`card-elevated p-4 flex flex-col md:flex-row md:items-center gap-4 ${
              u.banned ? 'opacity-60' : ''
            }`}
          >
            {/* User Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {/* Online indicator */}
                {isOnline(u.last_seen_at) ? (
                  <Circle className="w-2.5 h-2.5 fill-green-500 text-green-500 shrink-0" />
                ) : (
                  <Circle className="w-2.5 h-2.5 fill-muted-foreground/30 text-muted-foreground/30 shrink-0" />
                )}
                <span className="font-medium text-foreground text-sm truncate">{u.email}</span>
                <Badge variant={roleBadgeVariant(u.role)} className="flex items-center gap-1 text-xs">
                  {roleIcon(u.role)}
                  {u.role}
                </Badge>
                {u.banned && (
                  <Badge variant="destructive" className="text-xs">
                    <Ban className="w-3 h-3 mr-1" />
                    Banned
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Joined: {formatDate(u.created_at)}</span>
                <span>Last login: {formatDate(u.last_sign_in_at)}</span>
                {u.last_seen_at && <span>Last seen: {formatDate(u.last_seen_at)}</span>}
                <span className="text-primary font-medium">{u.quotation_count} quotation{u.quotation_count !== 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Select
                value={u.role}
                onValueChange={(role) => handleRoleChange(u.id, role)}
                disabled={actionLoading === u.id}
              >
                <SelectTrigger className="w-28 h-8 text-xs bg-background/50 border-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant={u.banned ? 'outline' : 'destructive'}
                    size="sm"
                    className="h-8 text-xs"
                    disabled={actionLoading === u.id}
                  >
                    {u.banned ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Activate
                      </>
                    ) : (
                      <>
                        <ShieldOff className="w-3 h-3 mr-1" />
                        Deactivate
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {u.banned ? 'Activate User?' : 'Deactivate User?'}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {u.banned
                        ? `This will allow ${u.email} to sign in again.`
                        : `This will prevent ${u.email} from signing in. They will be logged out.`}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleToggleBan(u.id, !u.banned)}>
                      {u.banned ? 'Activate' : 'Deactivate'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
