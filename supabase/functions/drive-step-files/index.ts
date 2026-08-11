import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_drive/drive/v3';

/**
 * Lists STEP (.stp/.step) files inside a Google Drive folder and streams a
 * single file's bytes back (base64) so the browser can convert it to GLB + PNG.
 */
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
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return json({ error: 'Unauthorized' }, 401);
    const { data: userData } = await admin.auth.getUser(token);
    const userId = userData?.user?.id;
    if (!userId) return json({ error: 'Unauthorized' }, 401);
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: userId, _role: 'admin' });
    if (!isAdmin) return json({ error: 'Admin access required' }, 403);

    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const driveKey = Deno.env.get('GOOGLE_DRIVE_API_KEY');
    if (!lovableKey || !driveKey) {
      return json({ error: 'Google Drive connection is not configured' }, 500);
    }
    const gatewayHeaders = {
      Authorization: `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': driveKey,
    };

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? 'list');

    if (action === 'list') {
      const folderId = String(body?.folderId ?? '').trim();
      if (!/^[A-Za-z0-9_-]{10,}$/.test(folderId)) return json({ error: 'Invalid folder id' }, 400);

      const files: { id: string; name: string; size?: string }[] = [];
      let pageToken: string | undefined;
      do {
        const params = new URLSearchParams({
          q: `'${folderId}' in parents and trashed = false`,
          fields: 'nextPageToken,files(id,name,size,mimeType)',
          pageSize: '1000',
          supportsAllDrives: 'true',
          includeItemsFromAllDrives: 'true',
        });
        if (pageToken) params.set('pageToken', pageToken);
        const res = await fetch(`${GATEWAY_URL}/files?${params}`, { headers: gatewayHeaders });
        if (!res.ok) {
          const details = await res.text();
          console.error(`Drive list failed [${res.status}]: ${details}`);
          return json({ error: 'Drive request failed', status: res.status, details }, res.status);
        }
        const data = await res.json();
        (data.files ?? []).forEach((f: any) => {
          if (/\.(stp|step)$/i.test(f.name ?? '')) files.push({ id: f.id, name: f.name, size: f.size });
        });
        pageToken = data.nextPageToken;
      } while (pageToken);

      return json({ files });
    }

    if (action === 'download') {
      const fileId = String(body?.fileId ?? '').trim();
      if (!/^[A-Za-z0-9_-]{10,}$/.test(fileId)) return json({ error: 'Invalid file id' }, 400);

      const res = await fetch(
        `${GATEWAY_URL}/files/${fileId}?alt=media&supportsAllDrives=true`,
        { headers: gatewayHeaders },
      );
      if (!res.ok) {
        const details = await res.text();
        console.error(`Drive download failed [${res.status}]: ${details}`);
        return json({ error: 'Drive request failed', status: res.status, details }, res.status);
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < buf.length; i += chunk) {
        binary += String.fromCharCode(...buf.subarray(i, i + chunk));
      }
      return json({ base64: btoa(binary) });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('drive-step-files error', e);
    return json({ error: (e as Error).message }, 500);
  }
});
