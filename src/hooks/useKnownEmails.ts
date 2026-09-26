import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

let cache: string[] | null = null;
let pending: Promise<string[]> | null = null;

async function load(): Promise<string[]> {
  const { data } = await supabase.from("customers").select("email").limit(5000);
  const set = new Set<string>();
  (data || []).forEach((row: { email: string | null }) => {
    (row.email || "")
      .split(/[;,\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      .forEach((e) => set.add(e));
  });
  return Array.from(set).sort();
}

/** Known email addresses (from customers) for autocomplete suggestions. */
export function useKnownEmails(enabled = true) {
  const [emails, setEmails] = useState<string[]>(cache || []);
  useEffect(() => {
    if (!enabled || cache) return;
    pending = pending || load();
    pending.then((list) => {
      cache = list;
      setEmails(list);
    }).catch(() => { pending = null; });
  }, [enabled]);
  return emails;
}
