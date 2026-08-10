import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProductMedia {
  sku: string;
  imageUrl: string | null;
  modelUrl: string | null;
}

type MediaMap = Record<string, ProductMedia>;

let cache: MediaMap | null = null;
let inflight: Promise<MediaMap> | null = null;
const listeners = new Set<(m: MediaMap) => void>();

const BUCKET = 'product-media';
const SIGN_TTL = 60 * 60; // 1 hour

const normalize = (sku: string) => sku.trim().toUpperCase();

async function fetchMedia(): Promise<MediaMap> {
  const { data, error } = await supabase
    .from('product_media' as any)
    .select('sku, image_path, model_path');

  if (error || !data) return {};

  const rows = data as unknown as { sku: string; image_path: string | null; model_path: string | null }[];
  const paths = rows.flatMap((r) => [r.image_path, r.model_path].filter(Boolean) as string[]);
  const signed: Record<string, string> = {};

  if (paths.length) {
    const { data: urls } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGN_TTL);
    (urls || []).forEach((u) => {
      if (u.path && u.signedUrl) signed[u.path] = u.signedUrl;
    });
  }

  const map: MediaMap = {};
  rows.forEach((r) => {
    map[normalize(r.sku)] = {
      sku: r.sku,
      imageUrl: r.image_path ? signed[r.image_path] ?? null : null,
      modelUrl: r.model_path ? signed[r.model_path] ?? null : null,
    };
  });
  return map;
}

export function loadProductMedia(force = false): Promise<MediaMap> {
  if (!force && cache) return Promise.resolve(cache);
  if (!force && inflight) return inflight;
  inflight = fetchMedia()
    .then((m) => {
      cache = m;
      listeners.forEach((l) => l(m));
      return m;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Map of SKU (uppercase) -> signed image / 3D model URLs. */
export const useProductMedia = () => {
  const [media, setMedia] = useState<MediaMap>(cache || {});

  useEffect(() => {
    listeners.add(setMedia);
    loadProductMedia().then(setMedia);
    return () => {
      listeners.delete(setMedia);
    };
  }, []);

  return {
    media,
    get: (sku?: string | null) => (sku ? media[normalize(sku)] : undefined),
    reload: () => loadProductMedia(true),
  };
};
