import * as THREE from 'three';

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
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

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

  let isDragging = false;
  let prevX = 0;
  let prevY = 0;
  let rotVelX = 0.005;
  let rotVelY = 0.008;

  const onPointerDown = (e) => {
    isDragging = true;
    prevX = e.clientX || e.touches?.[0]?.clientX || 0;
    prevY = e.clientY || e.touches?.[0]?.clientY || 0;
    rotVelX = 0;
    rotVelY = 0;
  };

  const onPointerMove = (e) => {
    if (!isDragging) return;
    const x = e.clientX || e.touches?.[0]?.clientX || 0;
    const y = e.clientY || e.touches?.[0]?.clientY || 0;
    cube.rotation.y += (x - prevX) * 0.01;
    cube.rotation.x += (y - prevY) * 0.01;
    rotVelX = (y - prevY) * 0.005;
    rotVelY = (x - prevX) * 0.005;
    prevX = x;
    prevY = y;
  };

  const onPointerUp = () => { isDragging = false; };

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointerleave', onPointerUp);
  renderer.domElement.addEventListener('touchstart', onPointerDown, { passive: true });
  renderer.domElement.addEventListener('touchmove', onPointerMove, { passive: true });
  renderer.domElement.addEventListener('touchend', onPointerUp);

  let animId;
  function animate() {
    animId = requestAnimationFrame(animate);
    if (!isDragging) {
      cube.rotation.y += rotVelY;
      cube.rotation.x += rotVelX;
      rotVelX *= 0.98;
      rotVelY *= 0.98;
      if (Math.abs(rotVelY) < 0.002) rotVelY = 0.005;
    }
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
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointerleave', onPointerUp);
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
