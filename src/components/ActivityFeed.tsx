import { useState, useEffect } from 'react';
import { useActivityLog, ActivityLogEntry } from '@/hooks/useActivityLog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, FileText, User, Pencil, Trash2, Copy, Send, CheckCircle, Ban, RotateCcw } from 'lucide-react';

interface ActivityFeedProps {
  entityType?: string;
  entityId?: string;
  userNameMap?: Record<string, string>;
  limit?: number;
  compact?: boolean;
}

const ACTION_ICONS: Record<string, typeof Activity> = {
  created: FileText,
  updated: Pencil,
  deleted: Trash2,
  duplicated: Copy,
  status_changed: Send,
  accepted: CheckCircle,
  finished: Ban,
  restored: RotateCcw,
  archived: Trash2,
};

const ACTION_COLORS: Record<string, string> = {
  created: 'text-emerald-500',
  updated: 'text-blue-500',
  deleted: 'text-destructive',
  duplicated: 'text-amber-500',
  status_changed: 'text-primary',
  accepted: 'text-emerald-500',
  finished: 'text-orange-500',
  restored: 'text-blue-500',
  archived: 'text-muted-foreground',
};

export const ActivityFeed = ({ entityType, entityId, userNameMap = {}, limit = 100, compact = false }: ActivityFeedProps) => {
  const { getActivities } = useActivityLog();
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await getActivities(entityType, entityId, limit);
      setActivities(data);
      setLoading(false);
    };
    load();
  }, [entityType, entityId, limit, getActivities]);

  const getUserName = (userId: string) => userNameMap[userId] || userId.slice(0, 6);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No activity recorded yet</p>
      </div>
    );
  }

  const content = (
    <div className="space-y-1">
      {activities.map((activity) => {
        const Icon = ACTION_ICONS[activity.action] || Activity;
        const colorClass = ACTION_COLORS[activity.action] || 'text-muted-foreground';

        return (
          <div key={activity.id} className="flex items-start gap-3 py-2 px-3 rounded-md hover:bg-muted/50 transition-colors">
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${colorClass}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium text-foreground">{getUserName(activity.user_id)}</span>
                {' '}
                <span className="text-muted-foreground">{activity.action.replace(/_/g, ' ')}</span>
                {' '}
                {activity.entity_label && (
                  <span className="font-medium text-foreground">{activity.entity_label}</span>
                )}
              </p>
              {activity.details && !compact && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {typeof activity.details === 'object'
                    ? Object.entries(activity.details as Record<string, any>)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ')
                    : String(activity.details)}
                </p>
              )}
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatTime(activity.created_at)}
            </span>
          </div>
        );
      })}
    </div>
  );

  if (compact) return content;

  return (
    <Card className="card-elevated">
      <CardHeader className="border-b border-primary/10 pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Activity Log
          <Badge variant="secondary" className="ml-auto text-xs">
            {activities.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-96">
          <div className="p-2">{content}</div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
