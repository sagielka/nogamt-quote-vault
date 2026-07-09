import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Listens for Electron auto-update events and surfaces them as toasts.
 * No-op in the web build.
 */
export default function DesktopUpdater() {
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.isElectron || !api.onUpdateStatus) return;

    const unsubscribe = api.onUpdateStatus(({ status, data }) => {
      switch (status) {
        case "available":
          toast.info(`Update ${data?.version ?? ""} available — downloading...`);
          break;
        case "downloaded":
          toast.success(`Update ${data?.version ?? ""} ready`, {
            duration: Infinity,
            action: {
              label: "Restart & install",
              onClick: () => api.installUpdateNow?.(),
            },
          });
          break;
        case "error":
          console.error("Updater error:", data?.message);
          break;
        default:
          break;
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  return null;
}
