import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const LAST_REPORTED_KEY = "app:last-reported-version";

/**
 * Records, once per browser per version, the moment this browser started
 * running a new app version. Silent on failure — never blocks the UI.
 */
export function useVersionReporter() {
  useEffect(() => {
    const version = String(import.meta.env.PACKAGE_VERSION ?? "");
    if (!version) return;

    let previous: string | null = null;
    try {
      previous = localStorage.getItem(LAST_REPORTED_KEY);
      if (previous === version) return;
    } catch {
      return;
    }

    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId || cancelled) return;

      const { error } = await supabase.from("app_version_events").insert({
        user_id: userId,
        version,
        previous_version: previous,
        user_agent: navigator.userAgent.slice(0, 300),
      });

      if (!error) {
        try {
          localStorage.setItem(LAST_REPORTED_KEY, version);
        } catch {
          /* ignore */
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
