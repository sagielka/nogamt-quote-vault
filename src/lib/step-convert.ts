import * as THREE from 'three';
import { GLTFExporter } from 'three-stdlib';

/**
 * Browser-side STEP (.stp/.step) → GLB + PNG conversion.
 * Uses the OpenCascade (OCCT) WASM importer, then Three.js for GLB export
 * and an offscreen render for the thumbnail picture.
 */

type OcctMesh = {
  name?: string;
  color?: [number, number, number];
  attributes: {
    position: { array: number[] };
    normal?: { array: number[] };
  };
  index?: { array: number[] };
};

let occtPromise: Promise<any> | null = null;

const loadOcct = async () => {
  if (!occtPromise) {
    occtPromise = (async () => {
      const mod = await import('occt-import-js');
      const factory = (mod as any).default ?? mod;
      return factory({ locateFile: () => '/occt-import-js.wasm' });
    })();
  }
  return occtPromise;
};

const buildGroup = (meshes: OcctMesh[]) => {
  const group = new THREE.Group();
  for (const m of meshes) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(m.attributes.position.array, 3));
    if (m.attributes.normal) {
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(m.attributes.normal.array, 3));
    }
    if (m.index) geometry.setIndex(m.index.array);
    if (!m.attributes.normal) geometry.computeVertexNormals();

    const color = m.color ? new THREE.Color(m.color[0], m.color[1], m.color[2]) : new THREE.Color(0.72, 0.74, 0.78);
    const material = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.35 });
    group.add(new THREE.Mesh(geometry, material));
  }
  return group;
};

const centerAndScale = (group: THREE.Group) => {
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  group.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  return maxDim;
};

const exportGlb = (object: THREE.Object3D): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      object,
      (result) => resolve(new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' })),
      (err) => reject(err),
      { binary: true },
    );
  });

const renderPng = async (group: THREE.Group, maxDim: number, size = 512): Promise<Blob | null> => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return null;
  }
  renderer.setSize(size, size, false);

  const scene = new THREE.Scene();
  scene.add(group);
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(1, 1.4, 1.2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-1.2, -0.6, -1);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, maxDim * 100);
  const dist = maxDim * 2.1;
  camera.position.set(dist * 0.7, dist * 0.55, dist * 0.8);
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  scene.remove(group);
  renderer.dispose();
  return blob;
};

export type StepConversion = { glb: Blob; png: Blob | null };

export const convertStepFile = async (file: File): Promise<StepConversion> => {
  const occt = await loadOcct();
  const buffer = new Uint8Array(await file.arrayBuffer());
  const result = occt.ReadStepFile(buffer, null);
  if (!result?.success || !result.meshes?.length) {
    throw new Error('Could not read the STEP file');
  }
  const group = buildGroup(result.meshes as OcctMesh[]);
  const maxDim = centerAndScale(group);
  const glb = await exportGlb(group);
  const png = await renderPng(group, maxDim);
  return { glb, png };
};
