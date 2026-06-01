import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

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
  scene.background = new THREE.Color(materialMode === 'gene' ? 0x070816 : 0xf5f5f5);

  // Add environment map for glass/gene reflections
  let pmremGenerator = null;
  let envRenderer = null;
  if (materialMode === 'glass' || materialMode === 'gene') {
    envRenderer = new THREE.WebGLRenderer({ antialias: true });
    pmremGenerator = new THREE.PMREMGenerator(envRenderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment()).texture;
    scene.environment = envTexture;
  }

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(2.5, 2, 2.5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = materialMode === 'gene' ? 1.35 : 1.0;
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

  const ambient = new THREE.AmbientLight(0xffffff, materialMode === 'gene' ? 0.35 : 0.8);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, materialMode === 'gene' ? 0.75 : 0.5);
  dirLight.position.set(5, 5, 5);
  scene.add(dirLight);
  if (materialMode === 'gene') {
    const rimLight = new THREE.DirectionalLight(0x9bbcff, 1.2);
    rimLight.position.set(-4, 3, -5);
    scene.add(rimLight);
  }

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

    const edges = new THREE.EdgesGeometry(geometry, 30);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
      color: materialMode === 'glass' ? 0xffffff : 0x333333,
      transparent: true,
      opacity: materialMode === 'glass' ? 0.35 : 0.75,
    }));
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
      if (pmremGenerator) pmremGenerator.dispose();
      if (envRenderer) envRenderer.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    },
  };
}

/**
 * Create gene code cube with individual modules
 * Adjacent modules (face-to-face) appear merged when touching
 * Edge-to-edge connections remain as separate cubes
 */
function createGeneCube(qrCanvases, geneColor) {
  const group = new THREE.Group();
  const color = GENE_COLORS.find(c => c.name === geneColor)?.color || '#8B5CF6';
  const glowColor = new THREE.Color(color);

  // Acrylic material - translucent with subtle reflections
  const moduleMaterial = new THREE.MeshPhysicalMaterial({
    color: color,
    emissive: glowColor,
    emissiveIntensity: 0.42,
    transmission: 0.62,
    roughness: 0.075,
    metalness: 0.0,
    ior: 1.49,
    thickness: 0.65,
    envMapIntensity: 1.35,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: 0.92,
  });

  // Cube dimensions
  const cubeSize = 1.8;
  const halfSize = cubeSize / 2;
  const depth = 0.125; // Depth of raised dark modules
  const baseDepth = 0.035; // Thin translucent tiles for light/empty modules

  // QR code settings
  const qrSize = 256;
  const moduleSize = 8;
  const numModules = Math.floor(qrSize / moduleSize);
  const module3DSize = cubeSize / numModules;
  // Slightly oversize every tile to remove hairline cracks caused by
  // floating-point precision, texture sampling and rounded bevels at face seams.
  const seamOverlap = module3DSize * 0.018;
  const tileSize = module3DSize + seamOverlap;

  // Create a single shared geometry for all modules (same size)
  const moduleGeometry = new RoundedBoxGeometry(
    tileSize,
    tileSize,
    depth,
    2,
    module3DSize * 0.045
  );

  const baseMaterial = new THREE.MeshPhysicalMaterial({
    color,
    emissive: glowColor,
    emissiveIntensity: 0.16,
    roughness: 0.16,
    transmission: 0.78,
    thickness: 0.24,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });

  const baseGeometry = new RoundedBoxGeometry(
    tileSize,
    tileSize,
    baseDepth,
    1,
    module3DSize * 0.025
  );

  // Process each face
  for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
    const canvas = qrCanvases[faceIdx];
    if (!canvas) continue;

    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, qrSize, qrSize);
    const pixels = imageData.data;

    const boxIdx = FACE_TO_BOX[faceIdx];

    // Process each module in the QR code
    for (let row = 0; row < numModules; row++) {
      for (let col = 0; col < numModules; col++) {
        // Get pixel position in canvas
        const px = col * moduleSize + moduleSize / 2;
        const py = row * moduleSize + moduleSize / 2;
        const pixelIdx = (py * qrSize + px) * 4;

        // Check if this module is dark (part of QR code)
        const r = pixels[pixelIdx];
        const g = pixels[pixelIdx + 1];
        const b = pixels[pixelIdx + 2];
        const brightness = (r + g + b) / 3;

        // A low translucent tile is rendered for every QR module. This keeps
        // each face physically continuous (so neighbouring faces meet cleanly)
        // while the actual dark QR modules rise above it as relief blocks.
        const x = (col - numModules / 2) * module3DSize + module3DSize / 2;
        const y = (row - numModules / 2) * module3DSize + module3DSize / 2;
        const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
        positionGeneTile(baseMesh, boxIdx, x, y, halfSize + baseDepth / 2);
        group.add(baseMesh);

        // Dark modules are part of the QR code
        if (brightness < 128) {
          // Create mesh using shared geometry
          const mesh = new THREE.Mesh(moduleGeometry, moduleMaterial);
          positionGeneTile(mesh, boxIdx, x, y, halfSize + baseDepth + depth / 2);
          group.add(mesh);
        }
      }
    }
  }

  // Add internal light sources for a premium acrylic/neon glow.
  const pointLight = new THREE.PointLight(color, 4.2, 4.2, 1.6);
  pointLight.position.set(0, 0, 0);
  group.add(pointLight);
  const topLight = new THREE.PointLight(0xffffff, 1.2, 3.2, 2);
  topLight.position.set(0.45, 0.55, 0.45);
  group.add(topLight);

  // Layered additive halos: cheaper than post-processing bloom but gives a
  // softer, more advanced glow in both desktop and mobile WebViews.
  const glowLayers = [
    { size: 1.2, opacity: 0.12 },
    { size: 1.8, opacity: 0.045 },
  ];
  for (const layer of glowLayers) {
    const glowGeometry = new THREE.SphereGeometry(layer.size, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: layer.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    group.add(new THREE.Mesh(glowGeometry, glowMaterial));
  }

  return group;
}

function positionGeneTile(mesh, boxIdx, x, y, normalOffset) {
  switch (boxIdx) {
    case 0: // +X face (right)
      mesh.position.set(normalOffset, -y, -x);
      mesh.rotation.y = Math.PI / 2;
      break;
    case 1: // -X face (left)
      mesh.position.set(-normalOffset, -y, x);
      mesh.rotation.y = -Math.PI / 2;
      break;
    case 2: // +Y face (top)
      mesh.position.set(x, normalOffset, y);
      mesh.rotation.x = -Math.PI / 2;
      break;
    case 3: // -Y face (bottom)
      mesh.position.set(x, -normalOffset, -y);
      mesh.rotation.x = Math.PI / 2;
      break;
    case 4: // +Z face (front)
      mesh.position.set(x, -y, normalOffset);
      break;
    case 5: // -Z face (back)
      mesh.position.set(-x, -y, -normalOffset);
      mesh.rotation.y = Math.PI;
      break;
  }
}

function buildMaterials(qrCanvases, materialMode = 'standard') {
  const raw = [];
  for (let i = 0; i < 6; i++) {
    const canvas = qrCanvases[i] || createPlaceholderCanvas(i + 1);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = false;
    texture.anisotropy = 1;

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
