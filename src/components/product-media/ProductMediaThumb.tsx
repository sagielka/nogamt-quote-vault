import { lazy, Suspense, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Box, ImageIcon, Loader2 } from 'lucide-react';
import { useProductMedia } from '@/hooks/useProductMedia';

const Product3DViewer = lazy(() =>
  import('./Product3DViewer').then((m) => ({ default: m.Product3DViewer }))
);

interface Props {
  sku?: string | null;
  size?: number;
  className?: string;
}

/** Small product thumbnail; click to open the picture and the rotatable 3D model. */
export const ProductMediaThumb = ({ sku, size = 40, className = '' }: Props) => {
  const { get } = useProductMedia();
  const [open, setOpen] = useState(false);
  const media = get(sku);

  if (!media || (!media.imageUrl && !media.modelUrl)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`View ${sku}`}
        aria-label={`View ${sku} picture`}
        className={`shrink-0 rounded border border-border bg-background overflow-hidden hover:ring-2 hover:ring-primary transition ${className}`}
        style={{ width: size, height: size }}
      >
        {media.imageUrl ? (
          <img src={media.imageUrl} alt={`${sku} product`} className="w-full h-full object-contain" loading="lazy" />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Box className="w-4 h-4" />
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">{sku}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue={media.imageUrl ? 'image' : 'model'}>
            <TabsList>
              {media.imageUrl && (
                <TabsTrigger value="image" className="gap-1">
                  <ImageIcon className="w-4 h-4" /> Picture
                </TabsTrigger>
              )}
              {media.modelUrl && (
                <TabsTrigger value="model" className="gap-1">
                  <Box className="w-4 h-4" /> 3D model
                </TabsTrigger>
              )}
            </TabsList>
            {media.imageUrl && (
              <TabsContent value="image">
                <img src={media.imageUrl} alt={`${sku} product`} className="w-full max-h-[420px] object-contain rounded-md border border-border bg-background" />
              </TabsContent>
            )}
            {media.modelUrl && (
              <TabsContent value="model">
                <Suspense
                  fallback={
                    <div className="h-[360px] flex items-center justify-center text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  }
                >
                  <Product3DViewer url={media.modelUrl} />
                </Suspense>
                <p className="text-xs text-muted-foreground mt-2">Drag to rotate, scroll to zoom.</p>
              </TabsContent>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProductMediaThumb;
