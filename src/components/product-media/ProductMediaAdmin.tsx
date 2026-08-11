import { useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Box, CloudDownload, ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { useProductMedia } from '@/hooks/useProductMedia';

const BUCKET = 'product-media';

const skuFromFileName = (name: string) => name.replace(/\.[^.]+$/, '').trim().toUpperCase();

/** Accepts a full Drive folder URL or a bare folder id. */
export const parseDriveFolderId = (input: string): string | null => {
  const value = input.trim();
  if (!value) return null;
  const byPath = value.match(/\/folders\/([A-Za-z0-9_-]{10,})/);
  if (byPath) return byPath[1];
  const byQuery = value.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (byQuery) return byQuery[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(value) ? value : null;
};

/**
 * Admin panel: upload product pictures (PNG/JPG), 3D models (GLB) or original
 * STEP files named by SKU. STEP files are converted in the browser into a GLB
 * 3D model plus a PNG thumbnail. STEP files can also be pulled in bulk from a
 * Google Drive folder link.
 */
export const ProductMediaAdmin = () => {
  const { media, reload } = useProductMedia();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [folderLink, setFolderLink] = useState('');
  const [skipExisting, setSkipExisting] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const entries = useMemo(() => {
    const list = Object.values(media).sort((a, b) => a.sku.localeCompare(b.sku));
    const q = query.trim().toLowerCase();
    return q ? list.filter((m) => m.sku.toLowerCase().includes(q)) : list;
  }, [media, query]);

  /** Upload one file (image / model / STEP) and, for STEP, generate GLB + PNG. */
  const ingestFile = async (file: File, userId: string | null): Promise<string | null> => {
    const sku = skuFromFileName(file.name);
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isModel = ext === 'glb' || ext === 'gltf';
    const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
    const isStep = ext === 'stp' || ext === 'step';
    if (!isModel && !isImage && !isStep) return `${file.name}: unsupported file type`;

    const kind = isStep ? 'step' : isModel ? 'model' : 'image';
    const path = `${sku}/${kind}.${ext}`;
    const patch: Record<string, unknown> = {
      sku,
      uploaded_by: userId,
      [`${kind}_path`]: path,
    };

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type || undefined });
    if (upErr) return `${file.name}: ${upErr.message}`;

    if (isStep) {
      setStatus(`Converting ${sku}…`);
      try {
        const { convertStepFile } = await import('@/lib/step-convert');
        const { glb, png } = await convertStepFile(file);

        const glbPath = `${sku}/model.glb`;
        const { error: glbErr } = await supabase.storage
          .from(BUCKET)
          .upload(glbPath, glb, { upsert: true, contentType: 'model/gltf-binary' });
        if (glbErr) throw glbErr;
        patch.model_path = glbPath;

        if (png) {
          const pngPath = `${sku}/image.png`;
          const { error: pngErr } = await supabase.storage
            .from(BUCKET)
            .upload(pngPath, png, { upsert: true, contentType: 'image/png' });
          if (pngErr) throw pngErr;
          patch.image_path = pngPath;
        }
      } catch (e) {
        return `${file.name}: conversion failed (${(e as Error).message})`;
      } finally {
        setStatus(null);
      }
    }

    const { error: dbErr } = await supabase
      .from('product_media' as any)
      .upsert(patch as any, { onConflict: 'sku' });
    if (dbErr) return `${file.name}: ${dbErr.message}`;
    return null;
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    let ok = 0;
    const errors: string[] = [];
    try {
      const { data: userData } = await supabase.auth.getUser();
      for (const file of Array.from(files)) {
        const err = await ingestFile(file, userData.user?.id ?? null);
        if (err) errors.push(err);
        else ok++;
      }
      await reload();
      if (ok) toast.success(`Uploaded media for ${ok} item${ok === 1 ? '' : 's'}`);
      errors.slice(0, 3).forEach((e) => toast.error(e));
      if (errors.length > 3) toast.error(`${errors.length - 3} more files failed`);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const importFromDrive = async () => {
    const folderId = parseDriveFolderId(folderLink);
    if (!folderId) {
      toast.error('Paste a Google Drive folder link (…/drive/folders/<id>)');
      return;
    }

    setBusy(true);
    setStatus('Reading Drive folder…');
    const errors: string[] = [];
    let ok = 0;
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke('drive-step-files', {
        body: { action: 'list', folderId },
      });
      if (error) throw error;
      const files: { id: string; name: string }[] = data?.files ?? [];
      if (!files.length) {
        toast.info('No STP/STEP files found in that folder');
        return;
      }

      const pending = skipExisting
        ? files.filter((f) => !media[skuFromFileName(f.name)]?.modelUrl)
        : files;
      if (!pending.length) {
        toast.info('All items in that folder already have a 3D preview');
        return;
      }

      for (let i = 0; i < pending.length; i++) {
        const f = pending[i];
        setStatus(`Downloading ${f.name} (${i + 1}/${pending.length})…`);
        const { data: dl, error: dlErr } = await supabase.functions.invoke('drive-step-files', {
          body: { action: 'download', fileId: f.id },
        });
        if (dlErr || !dl?.base64) {
          errors.push(`${f.name}: download failed`);
          continue;
        }
        const bytes = Uint8Array.from(atob(dl.base64), (c) => c.charCodeAt(0));
        const file = new File([bytes], f.name, { type: 'application/step' });
        const err = await ingestFile(file, userData.user?.id ?? null);
        if (err) errors.push(err);
        else ok++;
        setStatus(`Processed ${i + 1}/${pending.length}…`);
      }

      await reload();
      if (ok) toast.success(`Generated 3D previews & pictures for ${ok} item${ok === 1 ? '' : 's'}`);
      errors.slice(0, 3).forEach((e) => toast.error(e));
      if (errors.length > 3) toast.error(`${errors.length - 3} more files failed`);
    } catch (e) {
      toast.error((e as Error).message || 'Drive import failed');
    } finally {
      setBusy(false);
      setStatus(null);
    }
  };

  const removeSku = async (sku: string) => {
    const { error } = await supabase.from('product_media' as any).delete().eq('sku', sku);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.storage.from(BUCKET).remove([`${sku}/image.png`, `${sku}/image.jpg`, `${sku}/image.jpeg`, `${sku}/image.webp`, `${sku}/model.glb`, `${sku}/model.gltf`, `${sku}/step.stp`, `${sku}/step.step`]);
    await reload();
    toast.success(`Removed media for ${sku}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Item pictures & 3D models
        </CardTitle>
        <CardDescription>
          Drop pictures (PNG/JPG), 3D models (GLB) or original CAD files (STP/STEP) here — or import a whole Google
          Drive folder of STP files. STEP files are converted automatically into a 3D model and a preview picture. The
          file name must be the item number — e.g. <span className="font-mono">UF2612.stp</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }}
          className="rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground"
        >
          {busy ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> {status ?? 'Uploading…'}
            </span>
          ) : (
            <>
              <p>Drag & drop files here</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => inputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" /> Choose files
              </Button>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,.webp,.glb,.gltf,.stp,.step"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        <div className="rounded-lg border border-border p-4 space-y-3">
          <Label htmlFor="drive-folder" className="text-sm font-medium">
            Import STP files from a Google Drive folder
          </Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="drive-folder"
              value={folderLink}
              onChange={(e) => setFolderLink(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/…"
              disabled={busy}
            />
            <Button type="button" onClick={importFromDrive} disabled={busy || !folderLink.trim()}>
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CloudDownload className="w-4 h-4 mr-2" />}
              Import & convert
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="skip-existing"
              checked={skipExisting}
              onCheckedChange={(v) => setSkipExisting(v === true)}
              disabled={busy}
            />
            <Label htmlFor="skip-existing" className="text-xs font-normal text-muted-foreground">
              Only new items (skip SKUs that already have a 3D preview)
            </Label>
          </div>
          {busy && status && (
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> {status}
            </p>
          )}
        </div>

        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search item number…" />

        <div className="max-h-64 overflow-auto rounded border border-border divide-y divide-border">
          {entries.map((m) => (
            <div key={m.sku} className="flex items-center gap-3 px-3 py-2">
              <div className="w-10 h-10 rounded border border-border overflow-hidden bg-background shrink-0">
                {m.imageUrl ? (
                  <img src={m.imageUrl} alt={`${m.sku} product`} className="w-full h-full object-contain" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Box className="w-4 h-4" />
                  </span>
                )}
              </div>
              <span className="font-mono text-sm">{m.sku}</span>
              <span className="text-xs text-muted-foreground">
                {[m.imageUrl && 'picture', m.modelUrl && '3D'].filter(Boolean).join(' + ')}
              </span>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => removeSku(m.sku)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {entries.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">No item media uploaded yet.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductMediaAdmin;
