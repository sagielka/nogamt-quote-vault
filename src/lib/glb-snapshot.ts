/**
 * Render a GLB model to a PNG data URL off-screen so it can be embedded in
 * exports (PDF) where no live 3D canvas exists.
 */
const cache = new Map<string, string | null>();

export async function renderGlbSnapshot(url: string, size = 512): Promise<string | null> {
  if (cache.has(url)) return cache.get(url)!;

  let result: string | null = null;
  try {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(size, size, false);
    renderer.setClearColor(0xffffff, 1);

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(3, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.7);
    fill.position.set(-4, -2, -3);
    scene.add(fill);

    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);
    const model = gltf.scene;
    scene.add(model);

    // Frame the model
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    model.position.sub(center);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
    const dist = (sphere.radius || 1) / Math.sin((camera.fov * Math.PI) / 360);
    camera.position.set(dist * 0.75, dist * 0.55, dist * 0.85);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
    result = canvas.toDataURL('image/png');

    renderer.dispose();
    scene.traverse((obj: any) => {
      obj.geometry?.dispose?.();
      const mat = obj.material;
      if (Array.isArray(mat)) mat.forEach((m: any) => m.dispose?.());
      else mat?.dispose?.();
    });
  } catch (e) {
    console.warn('GLB snapshot failed:', e);
    result = null;
  }

  cache.set(url, result);
  return result;
}
