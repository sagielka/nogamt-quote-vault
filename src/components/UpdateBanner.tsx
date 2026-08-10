import { useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  UPDATE_AVAILABLE_EVENT,
  PENDING_UPDATE_KEY,
  applyPendingUpdate,
} from "@/lib/sw-register";
import { isForceUpdateEnabled } from "@/lib/force-update";

const AUTO_APPLY_SECONDS = 20;

/**
 * Shows a banner when a newer build is available, applies it automatically
 * after a short countdown (or immediately on click), and confirms the update
 * with a toast once the page has reloaded onto the new version.
 */
export default function UpdateBanner() {
  const [available, setAvailable] = useState(false);
  const [seconds, setSeconds] = useState(AUTO_APPLY_SECONDS);
  const [updating, setUpdating] = useState(false);

  // Confirm the update after the reload
  useEffect(() => {
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(PENDING_UPDATE_KEY);
      if (pending !== null) sessionStorage.removeItem(PENDING_UPDATE_KEY);
    } catch {
      /* ignore */
    }
    if (pending === null) return;
    const version = import.meta.env.PACKAGE_VERSION;
    toast.success(version ? `Updated to version ${version}` : "App updated", {
      description: "You're now on the latest prices and features.",
      duration: 5000,
    });
  }, []);

  useEffect(() => {
    const onAvailable = () => setAvailable(true);
    window.addEventListener(UPDATE_AVAILABLE_EVENT, onAvailable);
    return () => window.removeEventListener(UPDATE_AVAILABLE_EVENT, onAvailable);
  }, []);

  useEffect(() => {
    if (!available || updating) return;
    if (seconds <= 0 || isForceUpdateEnabled()) {
      setUpdating(true);
      applyPendingUpdate();
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [available, seconds, updating]);

  if (!available) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex justify-center p-3 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-primary/40 bg-card/95 px-4 py-2.5 shadow-lg backdrop-blur">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <div className="text-sm">
          <span className="font-medium text-foreground">A new version is available</span>
          <span className="ml-2 text-muted-foreground">
            {updating ? "Updating..." : `Updating automatically in ${seconds}s`}
          </span>
        </div>
        <Button
          size="sm"
          disabled={updating}
          onClick={() => {
            setUpdating(true);
            applyPendingUpdate();
          }}
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${updating ? "animate-spin" : ""}`} />
          Update now
        </Button>
      </div>
    </div>
  );
}
