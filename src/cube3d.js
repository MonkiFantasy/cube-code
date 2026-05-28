import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Three.js BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
// Our face order: 1=front(+Z), 2=back(-Z), 3=top(+Y), 4=bottom(-Y), 5=left(-X), 6=right(+X)
const FACE_TO_BOX = [4, 5, 2, 3, 0, 1];

// Gene code colors (贪嗔痴)
export const GENE_COLORS = [
  { name: 'purple', color: '#8B5CF6', label: '贪' },  // 紫色 = 贪
  { name: 'red', color: '#EF4444', label: '嗔' },      // 红色 = 嗔
  { name: 'blue', color: '#3B82F6', label: '痴' },     // 蓝色 = 痴
];

/**
 * Create an interactive 3D cube with QR code textures on each face.
 * @param {HTMLElement} container - The container element
 * @param {HTMLCanvasElement[]} qrCanvases - Array of 6 QR code canvases
 * @param {Object} options - Options for cube rendering
 * @param {string} options.materialMode - 'standard', 'glass', or 'gene'
 * @param {string} options.geneColor - Gene code color: 'purple', 'red', or 'blue'
 * @param {boolean} options.enableSnapRotation - Enable snap-to-face rotation
 */
export function createCube(container, qrCanvases, { materialMode = 'standard', geneColor = 'purple', enableSnapRotation = false } = {}) {
  const width = container.clientWidth;
  const height = container.clientWidth;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f5f5);

  // Add environment map for glass/gene reflections
  if (materialMode === 'glass' || materialMode === 'gene') {
    const pmremGenerator = new THREE.PMREMGenerator(new THREE.WebGLRenderer());
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment()).texture;
    scene.environment = envTexture;
  }

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

  // Snap-to-face rotation
  let isSnapRotationEnabled = enableSnapRotation;
  let snapTarget = null;
  let isSnapping = false;

  // Face rotation targets (in radians)
  const SNAP_ANGLES = {
    front: { x: 0, y: 0 },      // +Z face
    back: { x: 0, y: Math.PI },  // -Z face
    top: { x: -Math.PI / 2, y: 0 }, // +Y face
    bottom: { x: Math.PI / 2, y: 0 }, // -Y face
    left: { x: 0, y: Math.PI / 2 },  // -X face
    right: { x: 0, y: -Math.PI / 2 }, // +X face
  };

  function snapToFace(faceName) {
    if (!isSnapRotationEnabled) return;
    snapTarget = SNAP_ANGLES[faceName];
    if (snapTarget) {
      isSnapping = true;
      controls.autoRotate = false;
    }
  }

  function updateSnapRotation() {
    if (!isSnapping || !snapTarget) return;

    const dampingFactor = 0.1;
    const threshold = 0.01;

    // Smoothly interpolate to target rotation
    const dx = snapTarget.x - camera.rotation.x;
    const dy = snapTarget.y - camera.rotation.y;

    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
      camera.rotation.x = snapTarget.x;
      camera.rotation.y = snapTarget.y;
      isSnapping = false;
      snapTarget = null;
      controls.autoRotate = true;
      return;
    }

    camera.rotation.x += dx * dampingFactor;
    camera.rotation.y += dy * dampingFactor;
  }

  const ambient = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
  dirLight.position.set(5, 5, 5);
  scene.add(dirLight);

  // Create main group
  const mainGroup = new THREE.Group();

  let cube, cubeGroup;

  if (materialMode === 'gene') {
    // Gene mode: create individual cubes for each QR module
    cubeGroup = createGeneCube(qrCanvases, geneColor);
    mainGroup.add(cubeGroup);
  } else {
    // Standard/Glass mode: solid cube with textures
    const geometry = new THREE.BoxGeometry(1.8, 1.8, 1.8);
    const materials = buildMaterials(qrCanvases, materialMode, geneColor);
    cube = new THREE.Mesh(geometry, materials);
    mainGroup.add(cube);

    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x333333 }));
    mainGroup.add(line);
  }

  scene.add(mainGroup);

  let animId;
  function animate() {
    animId = requestAnimationFrame(animate);
    updateSnapRotation();
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
      if (materialMode === 'gene') {
        // Remove old gene cube group and create new one
        mainGroup.remove(cubeGroup);
        cubeGroup = createGeneCube(qrCanvases, geneColor);
        mainGroup.add(cubeGroup);
      } else if (cube) {
        cube.material = buildMaterials(qrCanvases, materialMode, geneColor);
      }
    },
    snapToFace(faceName) {
      snapToFace(faceName);
    },
    setSnapRotation(enabled) {
      isSnapRotationEnabled = enabled;
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

/**
 * Create gene code cube with merged modules
 * Adjacent QR modules are merged into bars for better performance
 * Uses acrylic material for translucent effect
 */
function createGeneCube(qrCanvases, geneColor) {
  const group = new THREE.Group();
  const color = GENE_COLORS.find(c => c.name === geneColor)?.color || '#8B5CF6';

  // Acrylic material - translucent with subtle reflections
  const moduleMaterial = new THREE.MeshPhysicalMaterial({
    color: color,
    transmission: 0.8,
    roughness: 0.1,
    metalness: 0.0,
    ior: 1.49, // Acrylic IOR
    thickness: 0.5,
    envMapIntensity: 0.8,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: 0.9,
  });

  // Cube dimensions - more compact
  const cubeSize = 1.6;
  const halfSize = cubeSize / 2;
  const depth = 0.15; // Thickness of each bar

  // QR code settings
  const qrSize = 256;
  const moduleSize = 8;
  const numModules = Math.floor(qrSize / moduleSize);

  // 3D module size
  const module3DSize = cubeSize / numModules;

  // Process each face
  for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
    const canvas = qrCanvases[faceIdx];
    if (!canvas) continue;

    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, qrSize, qrSize);
    const pixels = imageData.data;

    const boxIdx = FACE_TO_BOX[faceIdx];

    // Build grid of dark modules
    const grid = [];
    for (let row = 0; row < numModules; row++) {
      grid[row] = [];
      for (let col = 0; col < numModules; col++) {
        const px = col * moduleSize + moduleSize / 2;
        const py = row * moduleSize + moduleSize / 2;
        const pixelIdx = (py * qrSize + px) * 4;
        const r = pixels[pixelIdx];
        const g = pixels[pixelIdx + 1];
        const b = pixels[pixelIdx + 2];
        const brightness = (r + g + b) / 3;
        grid[row][col] = brightness < 128;
      }
    }

    // Find horizontal runs and create merged bars
    for (let row = 0; row < numModules; row++) {
      let col = 0;
      while (col < numModules) {
        if (grid[row][col]) {
          // Find end of horizontal run
          let endCol = col;
          while (endCol < numModules && grid[row][endCol]) {
            endCol++;
          }

          // Create bar for this run
          const runLength = endCol - col;
          const barWidth = runLength * module3DSize;
          const barHeight = module3DSize;

          // Center position of the bar
          const x = ((col + runLength / 2) - numModules / 2) * module3DSize;
          const y = (row - numModules / 2) * module3DSize;
          const z = halfSize;

          // Create box geometry for bar
          const geometry = new THREE.BoxGeometry(barWidth, barHeight, depth);
          const mesh = new THREE.Mesh(geometry, moduleMaterial);

          // Position and rotate based on face
          switch (boxIdx) {
            case 0: // +X face (right)
              mesh.position.set(z, -y, -x);
              mesh.rotation.y = Math.PI / 2;
              break;
            case 1: // -X face (left)
              mesh.position.set(-z, -y, x);
              mesh.rotation.y = -Math.PI / 2;
              break;
            case 2: // +Y face (top)
              mesh.position.set(x, z, y);
              mesh.rotation.x = -Math.PI / 2;
              break;
            case 3: // -Y face (bottom)
              mesh.position.set(x, -z, -y);
              mesh.rotation.x = Math.PI / 2;
              break;
            case 4: // +Z face (front)
              mesh.position.set(x, -y, z);
              break;
            case 5: // -Z face (back)
              mesh.position.set(-x, -y, -z);
              mesh.rotation.y = Math.PI;
              break;
          }

          group.add(mesh);
          col = endCol;
        } else {
          col++;
        }
      }
    }
  }

  return group;
}

function buildMaterials(qrCanvases, materialMode = 'standard', geneColor = 'purple') {
  const raw = [];
  for (let i = 0; i < 6; i++) {
    const canvas = qrCanvases[i] || createPlaceholderCanvas(i + 1);
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    if (materialMode === 'glass') {
      // Glass material with transparency and reflections
      raw.push(
        new THREE.MeshPhysicalMaterial({
          map: texture,
          transmission: 0.9,
          roughness: 0.1,
          metalness: 0.0,
          ior: 1.5,
          thickness: 0.5,
          envMapIntensity: 1.0,
          clearcoat: 1.0,
          clearcoatRoughness: 0.1,
        })
      );
    } else {
      // Standard material
      raw.push(
        new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.5,
          metalness: 0.05,
        })
      );
    }
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
