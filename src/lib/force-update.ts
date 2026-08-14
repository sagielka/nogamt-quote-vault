import { supabase } from "@/integrations/supabase/client";

const APPLIED_KEY = "app:force-update-applied-at";
const PENDING_KEY = "app:force-update-pending";
const POLL_MS = 60 * 1000;

export interface AppUpdateSettings {
  force_update_enabled: boolean;
  force_update_at: string | null;
}

let forceEnabled = false;

/** True when the admin has enabled forced immediate updates for everyone. */
export const isForceUpdateEnabled = () => forceEnabled;

export const fetchUpdateSettings = async (): Promise<AppUpdateSettings | null> => {
  const { data } = await supabase
    .from("app_settings")
    .select("force_update_enabled, force_update_at")
    .eq("id", "global")
    .maybeSingle();
  if (data) forceEnabled = !!data.force_update_enabled;
  return (data as AppUpdateSettings) ?? null;
};

export const saveUpdateSettings = async (patch: Partial<AppUpdateSettings>) => {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("app_settings")
    .update({ ...patch, updated_by: userData.user?.id ?? null })
    .eq("id", "global");
  return error;
};

/** Admin action: push an immediate update to every connected browser. */
export const triggerForceUpdate = () =>
  saveUpdateSettings({ force_update_at: new Date().toISOString() });

const reloadNow = () => {
  window.location.reload();
};

const markPending = () => {
  try {
    sessionStorage.setItem(PENDING_KEY, "1");
  } catch {
    /* storage unavailable */
  }
};

const consumePending = () => {
  try {
    if (sessionStorage.getItem(PENDING_KEY) === "1") {
      sessionStorage.removeItem(PENDING_KEY);
      return true;
    }
  } catch {
    /* storage unavailable */
  }
  return false;
};

const readApplied = () => {
  try {
    return localStorage.getItem(APPLIED_KEY);
  } catch {
    return null;
  }
};

const writeApplied = (value: string) => {
  try {
    localStorage.setItem(APPLIED_KEY, value);
  } catch {
    /* storage unavailable */
  }
};

/**
 * Watches the admin update setting. When a force-update is triggered the tab
 * reloads immediately if visible; otherwise it reloads on the next focus.
 */
export function initForceUpdateWatcher(): () => void {
  let stopped = false;

  const handle = (settings: AppUpdateSettings | null) => {
    if (stopped || !settings) return;
    forceEnabled = !!settings.force_update_enabled;
    const at = settings.force_update_at;
    if (!settings.force_update_enabled || !at) return;

    const applied = readApplied();
    if (applied === at) return;
    // First run on this browser: remember the marker without reloading.
    if (applied === null) {
      writeApplied(at);
      return;
    }
    writeApplied(at);
    if (document.visibilityState === "visible" && document.hasFocus()) {
      reloadNow();
    } else {
      markPending();
    }
  };

  const poll = () => void fetchUpdateSettings().then(handle).catch(() => {});
  poll();
  const interval = window.setInterval(poll, POLL_MS);

  const onVisible = () => {
    if (document.visibilityState !== "visible") return;
    if (consumePending()) {
      reloadNow();
      return;
    }
    poll();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);

  const channel = supabase
    .channel("app-settings-force-update")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "app_settings" },
      (payload) => handle(payload.new as AppUpdateSettings),
    )
    .subscribe();

  return () => {
    stopped = true;
    window.clearInterval(interval);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onVisible);
    void supabase.removeChannel(channel);
  };
}
