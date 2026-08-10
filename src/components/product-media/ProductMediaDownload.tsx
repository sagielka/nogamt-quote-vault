import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Box, Download, FileBox, ImageIcon } from 'lucide-react';
import { useProductMedia } from '@/hooks/useProductMedia';

interface Props {
  sku?: string | null;
  description?: string | null;
  className?: string;
}

async function download(url: string, fileName: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

/** Download menu for an item's picture, 3D model and original STP file. */
export const ProductMediaDownload = ({ sku, description, className = '' }: Props) => {
  const { get } = useProductMedia();
  const [busy, setBusy] = useState(false);
  const media = get(sku, description);

  if (!media || (!media.imageUrl && !media.modelUrl && !media.stepUrl)) return null;

  const run = async (url: string, ext: string) => {
    setBusy(true);
    try {
      await download(url, `${(sku || media.sku).replace(/\s+/g, '_')}.${ext}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-7 w-7 shrink-0 ${className}`}
          disabled={busy}
          aria-label={`Download files for ${sku}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="w-3.5 h-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {media.stepUrl && (
          <DropdownMenuItem onClick={() => run(media.stepUrl!, 'stp')} className="gap-2">
            <FileBox className="w-4 h-4" /> STP file
          </DropdownMenuItem>
        )}
        {media.imageUrl && (
          <DropdownMenuItem
            onClick={() => run(media.imageUrl!, media.imageUrl!.includes('.jpg') ? 'jpg' : 'png')}
            className="gap-2"
          >
            <ImageIcon className="w-4 h-4" /> Picture
          </DropdownMenuItem>
        )}
        {media.modelUrl && (
          <DropdownMenuItem onClick={() => run(media.modelUrl!, 'glb')} className="gap-2">
            <Box className="w-4 h-4" /> 3D model (GLB)
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ProductMediaDownload;
