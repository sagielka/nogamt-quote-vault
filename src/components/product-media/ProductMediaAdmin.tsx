import { useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Box, ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { useProductMedia } from '@/hooks/useProductMedia';

const BUCKET = 'product-media';

const skuFromFileName = (name: string) => name.replace(/\.[^.]+$/, '').trim().toUpperCase();

/**
 * Admin panel: upload product pictures (PNG/JPG) and 3D models (GLB) named by SKU.
 * GLB files are produced by converting the STEP (.stp) files once, offline.
 */
export const ProductMediaAdmin = () => {
  const { media, reload } = useProductMedia();
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const entries = useMemo(() => {
    const list = Object.values(media).sort((a, b) => a.sku.localeCompare(b.sku));
    const q = query.trim().toLowerCase();
    return q ? list.filter((m) => m.sku.toLowerCase().includes(q)) : list;
  }, [media, query]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    let ok = 0;
    const errors: string[] = [];

    try {
      const { data: userData } = await supabase.auth.getUser();
      for (const file of Array.from(files)) {
        const sku = skuFromFileName(file.name);
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const isModel = ext === 'glb' || ext === 'gltf';
        const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
        const isStep = ext === 'stp' || ext === 'step';

        if (!isModel && !isImage && !isStep) {
          errors.push(`${file.name}: unsupported file type`);
          continue;
        }

        const kind = isStep ? 'step' : isModel ? 'model' : 'image';
        const path = `${sku}/${kind}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { upsert: true, contentType: file.type || undefined });
        if (upErr) {
          errors.push(`${file.name}: ${upErr.message}`);
          continue;
        }

        const patch: Record<string, unknown> = {
          sku,
          uploaded_by: userData.user?.id ?? null,
          [`${kind}_path`]: path,
        };
        const { error: dbErr } = await supabase
          .from('product_media' as any)
          .upsert(patch as any, { onConflict: 'sku' });
        if (dbErr) {
          errors.push(`${file.name}: ${dbErr.message}`);
          continue;
        }
        ok++;
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
          Drop pictures (PNG/JPG), 3D models (GLB) and original CAD files (STP/STEP) here. The file name must be the
          item number — e.g. <span className="font-mono">UF2612.png</span> or <span className="font-mono">UF2612.glb</span>.
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
              <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
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
            accept=".png,.jpg,.jpeg,.webp,.glb,.gltf"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
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
