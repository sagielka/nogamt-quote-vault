import { useEffect } from "react";
import { toast } from "sonner";

const TOAST_ID = "desktop-updater";

/**
 * Listens for Electron auto-update events and surfaces them as a single
 * evolving sonner toast (checking → available → downloading → ready).
 * No-op in the web build.
 */
export default function DesktopUpdater() {
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.isElectron || !api.onUpdateStatus) return;

    const unsubscribe = api.onUpdateStatus(({ status, data }) => {
      switch (status) {
        case "checking":
          toast.loading("Checking for updates...", { id: TOAST_ID });
          break;

        case "up-to-date":
          toast.success("You're on the latest version", {
            id: TOAST_ID,
            duration: 2500,
          });
          break;

        case "available":
          toast.loading(`Update ${data?.version ?? ""} available — starting download...`, {
            id: TOAST_ID,
          });
          break;

        case "downloading": {
          const pct = typeof data?.percent === "number" ? data.percent : 0;
          toast.loading(`Downloading update... ${pct}%`, {
            id: TOAST_ID,
            description: "You can keep working — it'll install on restart.",
          });
          break;
        }

        case "downloaded":
          toast.success(`Update ${data?.version ?? ""} ready to install`, {
            id: TOAST_ID,
            duration: Infinity,
            description: "Restart the app to finish updating.",
            action: {
              label: "Restart & install",
              onClick: () => api.installUpdateNow?.(),
            },
          });
          break;

        case "error":
          toast.error("Update failed", {
            id: TOAST_ID,
            description: data?.message ?? "Unknown error",
            duration: 6000,
          });
          break;
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  return null;
}
