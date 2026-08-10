import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as XLSX from 'npm:xlsx@0.18.5';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_drive/drive/v3';

type Row = Record<string, unknown>;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

const pickColumn = (headers: string[], matcher: (h: string) => boolean) =>
  headers.find((h) => matcher(h.toUpperCase()));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // ---- Authorization: cron secret OR signed-in admin -------------------
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedSecret = req.headers.get('x-cron-secret');
    let authorized = !!cronSecret && providedSecret === cronSecret;

    if (!authorized) {
      const authHeader = req.headers.get('Authorization') ?? '';
      const token = authHeader.replace('Bearer ', '');
      if (!token) return json({ error: 'Unauthorized' }, 401);
      const { data: userData } = await admin.auth.getUser(token);
      const userId = userData?.user?.id;
      if (!userId) return json({ error: 'Unauthorized' }, 401);
      const { data: isAdmin } = await admin.rpc('has_role', { _user_id: userId, _role: 'admin' });
      if (!isAdmin) return json({ error: 'Admin access required' }, 403);
      authorized = true;
    }

    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const driveKey = Deno.env.get('GOOGLE_DRIVE_API_KEY');
    if (!lovableKey || !driveKey) {
      return json({ error: 'Google Drive connection is not configured' }, 500);
    }
    const gatewayHeaders = {
      Authorization: `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': driveKey,
    };

    // ---- Which file to sync ---------------------------------------------
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const { data: state } = await admin
      .from('catalog_sync_state')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    const fileId: string | undefined = body?.fileId ?? state?.drive_file_id;
    if (!fileId) return json({ error: 'No Google Drive file configured' }, 400);

    // ---- File metadata ---------------------------------------------------
    const metaRes = await fetch(
      `${GATEWAY_URL}/files/${fileId}?fields=id,name,modifiedTime,mimeType`,
      { headers: gatewayHeaders },
    );
    if (!metaRes.ok) {
      const details = await metaRes.text();
      console.error(`Drive metadata failed [${metaRes.status}]: ${details}`);
      return json({ error: 'Drive request failed', status: metaRes.status, details }, metaRes.status);
    }
    const meta = await metaRes.json();

    const force = body?.force === true;
    if (!force && state?.drive_modified_time && meta.modifiedTime &&
        new Date(meta.modifiedTime).getTime() <= new Date(state.drive_modified_time).getTime()) {
      await admin.from('catalog_sync_state').update({
        last_sync_at: new Date().toISOString(),
        last_status: 'up_to_date',
        last_error: null,
      }).eq('id', 'default');
      return json({ status: 'up_to_date', fileName: meta.name, added: 0, updated: 0 });
    }

    // ---- Download & parse -------------------------------------------------
    const fileRes = await fetch(`${GATEWAY_URL}/files/${fileId}?alt=media`, { headers: gatewayHeaders });
    if (!fileRes.ok) {
      const details = await fileRes.text();
      console.error(`Drive download failed [${fileRes.status}]: ${details}`);
      return json({ error: 'Drive download failed', status: fileRes.status, details }, fileRes.status);
    }
    const buf = new Uint8Array(await fileRes.arrayBuffer());
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null });
    if (!rows.length) throw new Error('The spreadsheet appears to be empty');

    const headers = Object.keys(rows[0]);
    const skuCol = pickColumn(headers, (h) => h.includes('SKU') || h.includes('P/N') || h.includes('ITEM'));
    const descCol = pickColumn(headers, (h) => h.includes('DESCRIPTION'));
    const bvCol = pickColumn(headers, (h) => h.includes('BV'));
    const euroCol = pickColumn(headers, (h) => h.includes('EURO') && !h.includes('BV'));
    const chinaCol = pickColumn(headers, (h) => h.includes('CHINA'));
    const dollarCol = pickColumn(headers, (h) => h.includes('DOLLAR') && !h.includes('CHINA'));
    const shekelCol = pickColumn(headers, (h) => h.includes('SHEKEL') || h.includes('NIS'));

    if (!skuCol) throw new Error(`Could not find a SKU column. Columns found: ${headers.join(', ')}`);

    const records = rows
      .map((r) => {
        const sku = String(r[skuCol] ?? '').trim();
        if (!sku || sku === 'nan' || sku.includes('…')) return null;
        return {
          sku: sku.toUpperCase(),
          description: descCol ? String(r[descCol] ?? '').trim() || null : null,
          euro: euroCol ? num(r[euroCol]) : null,
          dollar: dollarCol ? num(r[dollarCol]) : null,
          shekel: shekelCol ? num(r[shekelCol]) : null,
          noga_bv_euro: bvCol ? num(r[bvCol]) : null,
          china_dollar: chinaCol ? num(r[chinaCol]) : null,
          source_file: meta.name as string,
          updated_at: new Date().toISOString(),
        };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;

    if (!records.length) throw new Error('No valid product rows found in the spreadsheet');

    const { data: existing } = await admin.from('catalog_prices').select('sku');
    const existingSkus = new Set((existing ?? []).map((e: { sku: string }) => e.sku));
    const added = records.filter((r) => !existingSkus.has(r.sku as string)).length;
    const updated = records.length - added;

    for (let i = 0; i < records.length; i += 500) {
      const { error } = await admin
        .from('catalog_prices')
        .upsert(records.slice(i, i + 500), { onConflict: 'sku' });
      if (error) throw error;
    }

    await admin.from('catalog_sync_state').update({
      drive_file_id: fileId,
      drive_file_name: meta.name,
      drive_modified_time: meta.modifiedTime,
      last_sync_at: new Date().toISOString(),
      last_status: 'success',
      last_error: null,
      items_added: added,
      items_updated: updated,
    }).eq('id', 'default');

    return json({ status: 'success', fileName: meta.name, total: records.length, added, updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('sync-catalog-drive failed:', message);
    await admin.from('catalog_sync_state').update({
      last_sync_at: new Date().toISOString(),
      last_status: 'error',
      last_error: message,
    }).eq('id', 'default');
    return json({ error: message }, 500);
  }
});
