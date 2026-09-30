import { supabase } from '@/integrations/supabase/client';

export const splitEmails = (raw: string | null | undefined): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of (raw || '').split(/[,;\s]+/)) {
    const e = part.replace(/^mailto:/i, '').trim();
    if (!e || !e.includes('@')) continue;
    const lc = e.toLowerCase();
    if (seen.has(lc)) continue;
    seen.add(lc);
    out.push(lc);
  }
  return out;
};

/** Find a customer by name (case-insensitive) and merge emails; insert only when none exists. */
export async function syncCustomer(userId: string, name: string, email: string, address?: string | null) {
  const cleanName = name.trim();
  const emails = splitEmails(email);
  if (!cleanName || emails.length === 0) return;
  const { data: matches } = await supabase
    .from('customers')
    .select('id, email, address, name')
    .order('created_at', { ascending: true });
  const existing = (matches || []).find(c => c.name.trim().toLowerCase() === cleanName.toLowerCase())
    || (matches || []).find(c => splitEmails(c.email).some(e => emails.includes(e)));
  if (existing) {
    const merged = splitEmails([existing.email, ...emails].join(','));
    const next = merged.join(', ');
    if (next.length <= 500 && next !== existing.email) {
      await supabase.from('customers').update({
        email: next,
        address: existing.address || address?.trim() || null,
      }).eq('id', existing.id);
    }
    return;
  }
  await supabase.from('customers').insert({
    user_id: userId, name: cleanName, email: emails.join(', '), address: address?.trim() || null,
  });
}
