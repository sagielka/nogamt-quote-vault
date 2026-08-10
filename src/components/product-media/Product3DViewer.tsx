import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF } from '@react-three/drei';
import { Loader2 } from 'lucide-react';

const Model = ({ url }: { url: string }) => {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
};

interface Props {
  url: string;
  className?: string;
}

/** Rotatable 3D preview of a product model (GLB converted from the STEP file). */
export const Product3DViewer = ({ url, className = 'h-[360px]' }: Props) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (failed) {
    return (
      <div className={`${className} flex items-center justify-center rounded-md border border-border text-sm text-muted-foreground`}>
        3D model could not be loaded.
      </div>
    );
  }

  return (
    <div className={`${className} rounded-md border border-border bg-muted/20 overflow-hidden`}>
      <Canvas camera={{ position: [3, 2, 4], fov: 45 }} onError={() => setFailed(true)}>
        <Suspense fallback={null}>
          <Stage environment="city" intensity={0.5} adjustCamera>
            <Model url={url} />
          </Stage>
        </Suspense>
        <OrbitControls makeDefault enablePan enableZoom />
      </Canvas>
    </div>
  );
};

export const Product3DFallback = () => (
  <div className="h-[360px] flex items-center justify-center text-muted-foreground">
    <Loader2 className="w-5 h-5 animate-spin" />
  </div>
);

export default Product3DViewer;
