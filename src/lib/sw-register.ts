import { registerSW } from "virtual:pwa-register";

const SW_URL = "/sw.js";

function isBlockedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  if (typeof window === "undefined") return true;
  if (window.self !== window.top) return true;

  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).has("sw")) {
    if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  }
  return false;
}

async function unregisterAppSW() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    regs
      .filter((r) => r.active?.scriptURL?.endsWith(SW_URL))
      .map((r) => r.unregister()),
  );
}

/**
 * Registers the service worker and keeps every browser on the newest build:
 * checks for a new version on load, every 15 minutes, and whenever the tab
 * regains focus. When a new build is found it activates and reloads once.
 */
export const UPDATE_AVAILABLE_EVENT = "app:update-available";
export const PENDING_UPDATE_KEY = "app:pending-update-version";

let applyUpdate: (() => Promise<void>) | null = null;

/** Activates the waiting service worker; the page reloads once it takes over. */
export function applyPendingUpdate() {
  try {
    sessionStorage.setItem(PENDING_UPDATE_KEY, String(import.meta.env.PACKAGE_VERSION ?? ""));
  } catch {
    /* storage unavailable — reload confirmation is best-effort */
  }
  void applyUpdate?.();
}

export function initAutoUpdate() {
  if (isBlockedContext()) {
    void unregisterAppSW();
    return;
  }
  if (!("serviceWorker" in navigator)) return;

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => {});
      };
      setInterval(check, 15 * 60 * 1000);
      window.addEventListener("focus", check);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    },
    onNeedRefresh() {
      applyUpdate = () => updateSW(true);
      window.dispatchEvent(new CustomEvent(UPDATE_AVAILABLE_EVENT));
    },
  });
}

