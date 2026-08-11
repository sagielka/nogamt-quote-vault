import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Loader2, RotateCcw, RotateCw, ZoomIn, ZoomOut, Maximize2, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Model = ({ url }: { url: string }) => {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
};

interface Props {
  url: string;
  className?: string;
  /** Hide the on-screen rotate/zoom buttons (mouse controls stay active). */
  hideControls?: boolean;
}

/** Rotatable 3D preview of a product model (GLB converted from the STEP file). */
export const Product3DViewer = ({ url, className = 'h-[360px]', hideControls = false }: Props) => {
  const [failed, setFailed] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  const rotate = useCallback((dir: 1 | -1) => {
    const c = controlsRef.current as any;
    if (!c) return;
    c.rotateLeft?.(dir * (Math.PI / 12));
    c.update?.();
  }, []);

  const zoom = useCallback((dir: 1 | -1) => {
    const c = controlsRef.current as any;
    if (!c?.object) return;
    const target = c.target;
    const cam = c.object;
    const factor = dir === 1 ? 0.8 : 1.25;
    cam.position.set(
      target.x + (cam.position.x - target.x) * factor,
      target.y + (cam.position.y - target.y) * factor,
      target.z + (cam.position.z - target.z) * factor
    );
    c.update?.();
  }, []);

  const reset = useCallback(() => {
    controlsRef.current?.reset?.();
  }, []);

  if (failed) {
    return (
      <div className={`${className} flex items-center justify-center rounded-md border border-border text-sm text-muted-foreground`}>
        3D model could not be loaded.
      </div>
    );
  }

  return (
    <div className={`${className} relative rounded-md border border-border bg-muted/20 overflow-hidden print:hidden`}>
      <Canvas camera={{ position: [3, 2, 4], fov: 45 }} onError={() => setFailed(true)}>
        <Suspense fallback={null}>
          <Stage environment="city" intensity={0.5} adjustCamera>
            <Model url={url} />
          </Stage>
        </Suspense>
        <OrbitControls
          ref={controlsRef as any}
          makeDefault
          enablePan
          enableZoom
          autoRotate={autoRotate}
          autoRotateSpeed={2.5}
        />
      </Canvas>

      {!hideControls && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-md border border-border bg-background/90 backdrop-blur px-1 py-1 shadow-sm">
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => rotate(-1)} aria-label="Rotate left" title="Rotate left">
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => rotate(1)} aria-label="Rotate right" title="Rotate right">
            <RotateCw className="w-4 h-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => zoom(1)} aria-label="Zoom in" title="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => zoom(-1)} aria-label="Zoom out" title="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setAutoRotate((v) => !v)}
            aria-label={autoRotate ? 'Stop auto-rotate' : 'Start auto-rotate'}
            aria-pressed={autoRotate}
            title={autoRotate ? 'Stop auto-rotate' : 'Auto-rotate'}
          >
            {autoRotate ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={reset} aria-label="Reset view" title="Reset view">
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export const Product3DFallback = () => (
  <div className="h-[360px] flex items-center justify-center text-muted-foreground">
    <Loader2 className="w-5 h-5 animate-spin" />
  </div>
);

export default Product3DViewer;
