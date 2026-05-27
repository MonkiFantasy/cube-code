import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Three.js BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
// Our face order: 1=front(+Z), 2=back(-Z), 3=top(+Y), 4=bottom(-Y), 5=left(-X), 6=right(+X)
const FACE_TO_BOX = [4, 5, 2, 3, 0, 1];

/**
 * Create an interactive 3D cube with QR code textures on each face.
 */
export function createCube(container, qrCanvases) {
  const width = container.clientWidth;
  const height = container.clientWidth;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f5f5);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(2.5, 2, 2.5);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 2.5;
  controls.maxDistance = 6;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.5;

  const ambient = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
  dirLight.position.set(5, 5, 5);
  scene.add(dirLight);

  const geometry = new THREE.BoxGeometry(1.8, 1.8, 1.8);
  const materials = buildMaterials(qrCanvases);
  const cube = new THREE.Mesh(geometry, materials);
  scene.add(cube);

  const edges = new THREE.EdgesGeometry(geometry);
  const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x333333 }));
  cube.add(line);

  let animId;
  function animate() {
    animId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  const onResize = () => {
    const w = container.clientWidth;
    renderer.setSize(w, w);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);

  return {
    update(canvases) {
      qrCanvases = canvases;
      cube.material = buildMaterials(qrCanvases);
    },
    dispose() {
      cancelAnimationFrame(animId);
      controls.dispose();
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    },
  };
}

function buildMaterials(qrCanvases) {
  const raw = [];
  for (let i = 0; i < 6; i++) {
    const canvas = qrCanvases[i] || createPlaceholderCanvas(i + 1);
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    raw.push(
      new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.5,
        metalness: 0.05,
      })
    );
  }
  return FACE_TO_BOX.map((idx) => raw[idx]);
}

function createPlaceholderCanvas(faceId) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#ccc';
  ctx.font = '48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(faceId), 128, 128);
  return c;
}
