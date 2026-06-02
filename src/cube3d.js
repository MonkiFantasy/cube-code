import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Three.js BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
// Our face order: 1=front(+Z), 2=back(-Z), 3=top(+Y), 4=bottom(-Y), 5=left(-X), 6=right(+X)
const FACE_TO_BOX = [4, 5, 2, 3, 0, 1];

// Gene code colors (贪嗔痴)
export const GENE_COLORS = [
  { name: 'purple', color: '#7C2DFF', label: '贪' },  // 紫色 = 贪
  { name: 'red', color: '#E7352A', label: '嗔' },     // 红色 = 嗔
  { name: 'blue', color: '#14B8A6', label: '痴' },    // 蓝绿色 = 痴
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
export function createCube(container, qrCanvases, { materialMode = 'standard', geneColor = 'purple', enableSnapRotation: _enableSnapRotation = false } = {}) {
  const width = container.clientWidth;
  const height = container.clientWidth;

  const scene = new THREE.Scene();
  scene.background = materialMode === 'gene'
    ? new THREE.Color(0x05060c)
    : new THREE.Color(0xf5f5f5);

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
  renderer.toneMappingExposure = materialMode === 'gene' ? 1.65 : 1.0;
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
  let snapTarget = null;
  let isSnapping = false;

  // Face camera targets. Moving the camera position works reliably with
  // OrbitControls; setting camera.rotation directly is overwritten by controls.
  const SNAP_POSITIONS = {
    front: new THREE.Vector3(0, 0, 4.0),      // +Z face
    back: new THREE.Vector3(0, 0, -4.0),      // -Z face
    top: new THREE.Vector3(0, 4.0, 0.001),    // +Y face
    bottom: new THREE.Vector3(0, -4.0, 0.001), // -Y face
    left: new THREE.Vector3(-4.0, 0, 0),      // -X face
    right: new THREE.Vector3(4.0, 0, 0),      // +X face
  };

  function snapToFace(faceName) {
    snapTarget = SNAP_POSITIONS[faceName];
    if (snapTarget) {
      isSnapping = true;
      controls.autoRotate = false;
    }
  }

  function updateSnapRotation() {
    if (!isSnapping || !snapTarget) return;

    const dampingFactor = 0.12;
    const threshold = 0.015;

    camera.position.lerp(snapTarget, dampingFactor);
    controls.target.set(0, 0, 0);
    camera.lookAt(controls.target);

    if (camera.position.distanceTo(snapTarget) < threshold) {
      camera.position.copy(snapTarget);
      camera.lookAt(controls.target);
      isSnapping = false;
      snapTarget = null;
      controls.autoRotate = false;
      return;
    }
  }

  const ambient = new THREE.AmbientLight(0xffffff, materialMode === 'gene' ? 0.22 : 0.8);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, materialMode === 'gene' ? 0.95 : 0.5);
  dirLight.position.set(5, 5, 5);
  scene.add(dirLight);
  if (materialMode === 'gene') {
    const rimLight = new THREE.DirectionalLight(0x9bbcff, 1.45);
    rimLight.position.set(-4, 3, -5);
    scene.add(rimLight);
    const warmKeyLight = new THREE.DirectionalLight(0xffd1b8, 0.75);
    warmKeyLight.position.set(3.5, -2, 4);
    scene.add(warmKeyLight);
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
      controls.autoRotate = enabled;
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

  // Gem/acrylic material inspired by the reference: saturated translucent
  // color, strong inner glow, glossy highlights and low roughness.
  const moduleMaterial = new THREE.MeshPhysicalMaterial({
    color,
    emissive: glowColor,
    emissiveIntensity: 0.46,
    transmission: 0.5,
    roughness: 0.045,
    metalness: 0.02,
    ior: 1.58,
    thickness: 0.92,
    envMapIntensity: 1.85,
    clearcoat: 1.0,
    clearcoatRoughness: 0.025,
    transparent: true,
    opacity: 0.94,
  });

  // Cube dimensions
  const cubeSize = 1.8;
  const halfSize = cubeSize / 2;
  const depth = 0.125; // Depth of raised dark modules
  const baseDepth = 0.035; // Thin translucent tiles for light/empty modules

  const moduleGeometries = new Map();
  const getRaisedGeometry = (row, col, numModules, tileSize, module3DSize, edgeWrap) => {
    const left = col === 0;
    const right = col === numModules - 1;
    const top = row === 0;
    const bottom = row === numModules - 1;
    const key = `${numModules}-${left}-${right}-${top}-${bottom}`;
    if (!moduleGeometries.has(key)) {
      moduleGeometries.set(key, new RoundedBoxGeometry(
        tileSize + (left || right ? edgeWrap * 2 : 0),
        tileSize + (top || bottom ? edgeWrap * 2 : 0),
        depth,
        1,
        module3DSize * 0.025
      ));
    }
    return moduleGeometries.get(key);
  };

  const baseMaterial = new THREE.MeshPhysicalMaterial({
    color,
    emissive: glowColor,
    emissiveIntensity: 0.16,
    roughness: 0.08,
    transmission: 0.62,
    thickness: 0.34,
    envMapIntensity: 1.45,
    clearcoat: 1,
    clearcoatRoughness: 0.035,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });

  // Process each face
  for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
    const canvas = qrCanvases[faceIdx];
    if (!canvas) continue;

    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const bounds = detectQRContentBounds(imageData);
    const numModules = estimateQRModuleCount(bounds.size, canvas.width);
    const modulePixelSize = bounds.size / numModules;
    const module3DSize = cubeSize / numModules;
    // Slightly oversize every tile to remove hairline cracks caused by
    // floating-point precision, texture sampling and rounded bevels at face seams.
    const seamOverlap = module3DSize * 0.018;
    const tileSize = module3DSize + seamOverlap;
    const edgeWrap = baseDepth * 1.4;
    // The translucent "light" layer is intentionally a square cuboid and wraps
    // past the mathematical cube edge. Adjacent faces overlap slightly at their
    // own boundaries, so the cube is sealed by the face pixels themselves instead
    // of by an added outside frame.
    const baseGeometry = new THREE.BoxGeometry(
      tileSize + edgeWrap * 2,
      tileSize + edgeWrap * 2,
      baseDepth,
    );

    const boxIdx = FACE_TO_BOX[faceIdx];

    // Process each module in the QR code
    for (let row = 0; row < numModules; row++) {
      for (let col = 0; col < numModules; col++) {
        // Sample inside the real QR square only. The canvas quiet zone / extra
        // blank margin is deliberately ignored; the finder-pattern square is
        // what becomes the physical cube face.
        const px = Math.min(canvas.width - 1, Math.max(0, Math.round(bounds.minX + (col + 0.5) * modulePixelSize)));
        const py = Math.min(canvas.height - 1, Math.max(0, Math.round(bounds.minY + (row + 0.5) * modulePixelSize)));
        const pixelIdx = (py * canvas.width + px) * 4;
        const isModule = isForegroundPixel(pixels, pixelIdx, bounds.background);

        // A low translucent tile is rendered for every QR module. This keeps
        // each face physically continuous (so neighbouring faces meet cleanly)
        // while the actual dark QR modules rise above it as relief blocks.
        const x = (col - numModules / 2) * module3DSize + module3DSize / 2;
        const y = (row - numModules / 2) * module3DSize + module3DSize / 2;
        const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
        positionGeneTile(baseMesh, boxIdx, x, y, halfSize + baseDepth / 2);
        group.add(baseMesh);

        // Foreground modules are part of the QR code relief.
        if (isModule) {
          const mesh = new THREE.Mesh(getRaisedGeometry(row, col, numModules, tileSize, module3DSize, edgeWrap), moduleMaterial);
          positionGeneTile(mesh, boxIdx, x, y, halfSize + baseDepth + depth / 2);
          group.add(mesh);
        }
      }
    }
  }

  // Add local internal lights for a premium acrylic/neon glow.
  // Keep the light concentrated inside the material instead of drawing a
  // visible full-ball halo around the cube.
  const pointLight = new THREE.PointLight(color, 4.2, 3.4, 1.7);
  pointLight.position.set(0, 0, 0);
  group.add(pointLight);
  const topLight = new THREE.PointLight(0xffffff, 1.15, 2.8, 2);
  topLight.position.set(0.42, 0.55, 0.36);
  group.add(topLight);
  addGeneEnergyGlows(group, color);

  return group;
}

function addGeneEnergyGlows(group, color) {
  const glowTexture = createGlowTexture(color);
  const sparkPositions = [
    [-0.76, 0.72, 0.78, 0.34, 0.22],
    [0.78, 0.62, 0.38, 0.28, 0.18],
    [-0.56, -0.8, 0.72, 0.26, 0.16],
    [0.72, -0.7, -0.58, 0.22, 0.13],
    [0.18, 0.88, -0.7, 0.2, 0.12],
  ];

  for (const [x, y, z, scale, opacity] of sparkPositions) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture,
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    }));
    sprite.position.set(x, y, z);
    sprite.scale.set(scale, scale, 1);
    group.add(sprite);
  }

  const beamMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beams = [
    { position: [-1.04, 0.18, 0.82], rotation: [0.25, 0.1, -0.64], length: 1.35, width: 0.025 },
    { position: [0.74, 0.88, 0.26], rotation: [0.1, -0.75, 0.45], length: 1.15, width: 0.02 },
    { position: [0.96, -0.34, -0.62], rotation: [-0.35, 0.48, 0.18], length: 1.05, width: 0.018 },
  ];

  for (const beam of beams) {
    const geometry = new THREE.PlaneGeometry(beam.width, beam.length);
    const mesh = new THREE.Mesh(geometry, beamMaterial);
    mesh.position.set(...beam.position);
    mesh.rotation.set(...beam.rotation);
    group.add(mesh);
  }
}

function createGlowTexture(color) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
  gradient.addColorStop(0.18, `${color}cc`);
  gradient.addColorStop(0.45, `${color}55`);
  gradient.addColorStop(1, `${color}00`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function detectQRContentBounds(imageData) {
  const { width, height, data } = imageData;
  const background = sampleCornerBackground(imageData);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (isForegroundPixel(data, idx, background)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1, size: Math.min(width, height), background };
  }

  // Use a perfect square derived from the non-background finder/module bounds.
  // This removes QR quiet-zone whitespace from the physical face.
  const contentWidth = maxX - minX + 1;
  const contentHeight = maxY - minY + 1;
  const size = Math.max(contentWidth, contentHeight);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  minX = Math.max(0, cx - size / 2);
  minY = Math.max(0, cy - size / 2);

  return {
    minX,
    minY,
    maxX: Math.min(width - 1, minX + size - 1),
    maxY: Math.min(height - 1, minY + size - 1),
    size,
    background,
  };
}

function sampleCornerBackground(imageData) {
  const { width, height, data } = imageData;
  const sampleSize = Math.max(3, Math.floor(Math.min(width, height) * 0.04));
  const corners = [
    [0, 0],
    [width - sampleSize, 0],
    [0, height - sampleSize],
    [width - sampleSize, height - sampleSize],
  ];
  const color = [0, 0, 0];
  let count = 0;

  for (const [startX, startY] of corners) {
    for (let y = startY; y < startY + sampleSize; y++) {
      for (let x = startX; x < startX + sampleSize; x++) {
        const idx = (y * width + x) * 4;
        color[0] += data[idx];
        color[1] += data[idx + 1];
        color[2] += data[idx + 2];
        count++;
      }
    }
  }

  return color.map((value) => value / count);
}

function isForegroundPixel(pixels, idx, background) {
  const dr = pixels[idx] - background[0];
  const dg = pixels[idx + 1] - background[1];
  const db = pixels[idx + 2] - background[2];
  return Math.hypot(dr, dg, db) > 38;
}

function estimateQRModuleCount(contentSize, canvasSize) {
  // QRCode.toCanvas was called with margin: 2, so:
  // contentSize ≈ canvasSize * modules / (modules + 4)
  // modules ≈ 4 * contentSize / (canvasSize - contentSize)
  const raw = 4 * contentSize / Math.max(1, canvasSize - contentSize);
  const qrCounts = [];
  for (let count = 21; count <= 177; count += 4) qrCounts.push(count);
  return qrCounts.reduce((best, count) => (
    Math.abs(count - raw) < Math.abs(best - raw) ? count : best
  ), 21);
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
