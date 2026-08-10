import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  fetchUpdateSettings,
  saveUpdateSettings,
  triggerForceUpdate,
  type AppUpdateSettings,
} from "@/lib/force-update";

/** Admin control: force every browser onto the newest build right away. */
export default function ForceUpdateSettings() {
  const [settings, setSettings] = useState<AppUpdateSettings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchUpdateSettings().then(setSettings);
  }, []);

  const toggle = async (enabled: boolean) => {
    setBusy(true);
    const error = await saveUpdateSettings({ force_update_enabled: enabled });
    setBusy(false);
    if (error) {
      toast.error("Could not save setting", { description: error.message });
      return;
    }
    setSettings((s) => ({ ...(s ?? { force_update_at: null }), force_update_enabled: enabled }));
    toast.success(enabled ? "Forced updates enabled" : "Forced updates disabled");
  };

  const pushNow = async () => {
    setBusy(true);
    const error = await triggerForceUpdate();
    setBusy(false);
    if (error) {
      toast.error("Could not push the update", { description: error.message });
      return;
    }
    setSettings(await fetchUpdateSettings());
    toast.success("Update pushed to all users");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="h-4 w-4 text-primary" />
          Force updates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor="force-updates" className="text-sm font-medium text-foreground">
              Force immediate updates for all users
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Active tabs reload right away when you push an update. Background tabs reload the
              next time they are focused.
            </p>
          </div>
          <Switch
            id="force-updates"
            checked={!!settings?.force_update_enabled}
            disabled={busy || !settings}
            onCheckedChange={toggle}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" disabled={busy || !settings?.force_update_enabled} onClick={pushNow}>
            Push update now
          </Button>
          <span className="text-xs text-muted-foreground">
            {settings?.force_update_at
              ? `Last pushed ${new Date(settings.force_update_at).toLocaleString()}`
              : "Never pushed"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
