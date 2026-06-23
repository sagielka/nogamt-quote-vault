import { useState, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { RotateCw, RotateCcw, FlipHorizontal, FlipVertical, Loader2 } from 'lucide-react';

interface LineItemImageEditorProps {
  open: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onSave: (blob: Blob) => Promise<void> | void;
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

async function renderEdited(
  src: string,
  crop: Area,
  rotation: number,
  flipH: boolean,
  flipV: boolean,
  outputMaxWidth: number,
): Promise<Blob> {
  const image = await loadImage(src);
  // Step 1: render rotated+flipped image onto an intermediate canvas
  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const bBoxW = image.width * cos + image.height * sin;
  const bBoxH = image.width * sin + image.height * cos;

  const inter = document.createElement('canvas');
  inter.width = bBoxW;
  inter.height = bBoxH;
  const ictx = inter.getContext('2d')!;
  ictx.translate(bBoxW / 2, bBoxH / 2);
  ictx.rotate(rad);
  ictx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ictx.drawImage(image, -image.width / 2, -image.height / 2);

  // Step 2: crop from intermediate. react-easy-crop returns crop in original image
  // coordinate space (post-rotation bounding box).
  const cropCanvas = document.createElement('canvas');
  const targetW = Math.min(outputMaxWidth, crop.width);
  const scale = targetW / crop.width;
  cropCanvas.width = Math.round(crop.width * scale);
  cropCanvas.height = Math.round(crop.height * scale);
  const cctx = cropCanvas.getContext('2d')!;
  cctx.drawImage(
    inter,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    cropCanvas.width,
    cropCanvas.height,
  );

  return new Promise<Blob>((resolve, reject) => {
    cropCanvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      0.9,
    );
  });
}

export const LineItemImageEditor = ({ open, imageSrc, onClose, onSave }: LineItemImageEditorProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [outputWidth, setOutputWidth] = useState(1200);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_a: Area, areaPx: Area) => {
    setCroppedArea(areaPx);
  }, []);

  const reset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setOutputWidth(1200);
    setCroppedArea(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!imageSrc || !croppedArea) return;
    setSaving(true);
    try {
      const blob = await renderEdited(imageSrc, croppedArea, rotation, flipH, flipV, outputWidth);
      await onSave(blob);
      reset();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Image</DialogTitle>
        </DialogHeader>

        <div className="relative w-full h-[420px] bg-black/80 rounded-md overflow-hidden">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              transform={`translate(${crop.x}px, ${crop.y}px) rotate(${rotation}deg) scale(${zoom}) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`}
              aspect={undefined}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
              restrictPosition={false}
            />
          )}
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setRotation((r) => r - 90)}>
              <RotateCcw className="h-4 w-4 mr-1" /> 90°
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setRotation((r) => r + 90)}>
              <RotateCw className="h-4 w-4 mr-1" /> 90°
            </Button>
            <Button type="button" size="sm" variant={flipH ? 'default' : 'outline'} onClick={() => setFlipH((v) => !v)}>
              <FlipHorizontal className="h-4 w-4 mr-1" /> Mirror
            </Button>
            <Button type="button" size="sm" variant={flipV ? 'default' : 'outline'} onClick={() => setFlipV((v) => !v)}>
              <FlipVertical className="h-4 w-4 mr-1" /> Flip
            </Button>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Zoom ({zoom.toFixed(2)}x)</Label>
            <Slider min={0.5} max={4} step={0.05} value={[zoom]} onValueChange={(v) => setZoom(v[0])} />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Output size ({outputWidth}px wide)</Label>
            <Slider min={400} max={2000} step={100} value={[outputWidth]} onValueChange={(v) => setOutputWidth(v[0])} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={handleSave} disabled={saving || !croppedArea}>
            {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving</> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
