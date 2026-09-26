import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const LS_KEY = "known-emails-extra";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let cache: string[] | null = null;
let pending: Promise<string[]> | null = null;
const listeners = new Set<(l: string[]) => void>();

function readLocal(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}

function addTo(set: Set<string>, raw: string | null | undefined) {
  (raw || "").split(/[;,\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)).forEach((e) => set.add(e));
}

async function load(): Promise<string[]> {
  const set = new Set<string>();
  const [{ data: customers }, { data: sent }] = await Promise.all([
    supabase.from("customers").select("email").limit(5000),
    supabase.from("sent_emails").select("recipient_emails, cc_emails").order("sent_at", { ascending: false }).limit(2000),
  ]);
  (customers || []).forEach((r: { email: string | null }) => addTo(set, r.email));
  (sent || []).forEach((r: { recipient_emails: string[] | null; cc_emails: string[] | null }) => {
    (r.recipient_emails || []).forEach((e) => addTo(set, e));
    (r.cc_emails || []).forEach((e) => addTo(set, e));
  });
  readLocal().forEach((e) => addTo(set, e));
  return Array.from(set).sort();
}

/** Save a manually added email so it is suggested next time. */
export function addKnownEmail(email: string) {
  const e = email.trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return;
  const local = readLocal();
  if (!local.includes(e)) {
    try { localStorage.setItem(LS_KEY, JSON.stringify([...local, e])); } catch { /* ignore */ }
  }
  if (cache && !cache.includes(e)) {
    cache = [...cache, e].sort();
    listeners.forEach((l) => l(cache!));
  }
}

/** Known email addresses (customers, past recipients, manually added) for autocomplete. */
export function useKnownEmails(enabled = true) {
  const [emails, setEmails] = useState<string[]>(cache || []);
  useEffect(() => {
    listeners.add(setEmails);
    return () => { listeners.delete(setEmails); };
  }, []);
  useEffect(() => {
    if (!enabled || cache) return;
    pending = pending || load();
    pending.then((list) => { cache = list; setEmails(list); }).catch(() => { pending = null; });
  }, [enabled]);
  return emails;
}
