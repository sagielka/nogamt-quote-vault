import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useSyncStatus, SyncStatus } from '@/hooks/useSyncStatus';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const statusConfig: Record<SyncStatus, { icon: React.ElementType; color: string; label: string }> = {
  connected: {
    icon: Wifi,
    color: 'text-green-500',
    label: 'Real-time sync active',
  },
  connecting: {
    icon: Loader2,
    color: 'text-yellow-500 animate-spin',
    label: 'Connecting...',
  },
  disconnected: {
    icon: WifiOff,
    color: 'text-red-500',
    label: 'Sync disconnected',
  },
};

export const SyncStatusIndicator = () => {
  const status = useSyncStatus();
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50">
            <Icon className={`w-3.5 h-3.5 ${config.color}`} />
            <span className={`text-xs font-medium ${config.color}`}>
              {status === 'connected' ? 'Sync' : status === 'connecting' ? '...' : 'Offline'}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
