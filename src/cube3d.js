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

  // Create cube group for gene mode (outer cube + inner hollow structure)
  const cubeGroup = new THREE.Group();

  const geometry = new THREE.BoxGeometry(1.8, 1.8, 1.8);
  const materials = buildMaterials(qrCanvases, materialMode, geneColor);
  const cube = new THREE.Mesh(geometry, materials);
  cubeGroup.add(cube);

  const edges = new THREE.EdgesGeometry(geometry);
  const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x333333 }));
  cubeGroup.add(line);

  // Add hollow center structure for gene mode
  if (materialMode === 'gene') {
    addHollowCenter(cubeGroup, geneColor);
  }

  scene.add(cubeGroup);

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
      cube.material = buildMaterials(qrCanvases, materialMode, geneColor);
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
 * Add hollow center structure for gene code material
 */
function addHollowCenter(group, geneColor) {
  const color = GENE_COLORS.find(c => c.name === geneColor)?.color || '#8B5CF6';

  // Inner frame structure
  const frameSize = 1.2;
  const frameThickness = 0.08;

  // Create 12 edges of the inner cube frame
  const edgeGeometry = new THREE.BoxGeometry(frameThickness, frameThickness, frameSize);
  const edgeMaterial = new THREE.MeshPhysicalMaterial({
    color: color,
    transmission: 0.7,
    roughness: 0.2,
    metalness: 0.3,
    ior: 1.5,
    thickness: 0.2,
  });

  // 4 edges along X axis
  for (let y = -1; y <= 1; y += 2) {
    for (let z = -1; z <= 1; z += 2) {
      const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
      edge.position.set(0, y * frameSize / 2, z * frameSize / 2);
      group.add(edge);
    }
  }

  // 4 edges along Y axis
  const edgeGeometryY = new THREE.BoxGeometry(frameSize, frameThickness, frameThickness);
  for (let x = -1; x <= 1; x += 2) {
    for (let z = -1; z <= 1; z += 2) {
      const edge = new THREE.Mesh(edgeGeometryY, edgeMaterial);
      edge.position.set(x * frameSize / 2, 0, z * frameSize / 2);
      group.add(edge);
    }
  }

  // 4 edges along Z axis
  const edgeGeometryZ = new THREE.BoxGeometry(frameThickness, frameSize, frameThickness);
  for (let x = -1; x <= 1; x += 2) {
    for (let y = -1; y <= 1; y += 2) {
      const edge = new THREE.Mesh(edgeGeometryZ, edgeMaterial);
      edge.position.set(x * frameSize / 2, y * frameSize / 2, 0);
      group.add(edge);
    }
  }

  // Add corner nodes
  const nodeGeometry = new THREE.SphereGeometry(0.06, 16, 16);
  const nodeMaterial = new THREE.MeshPhysicalMaterial({
    color: color,
    transmission: 0.8,
    roughness: 0.1,
    metalness: 0.4,
    ior: 1.5,
    thickness: 0.1,
  });

  for (let x = -1; x <= 1; x += 2) {
    for (let y = -1; y <= 1; y += 2) {
      for (let z = -1; z <= 1; z += 2) {
        const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
        node.position.set(x * frameSize / 2, y * frameSize / 2, z * frameSize / 2);
        group.add(node);
      }
    }
  }

  // Add center energy core
  const coreGeometry = new THREE.IcosahedronGeometry(0.15, 0);
  const coreMaterial = new THREE.MeshPhysicalMaterial({
    color: color,
    transmission: 0.9,
    roughness: 0.0,
    metalness: 0.5,
    ior: 2.0,
    thickness: 0.3,
    emissive: color,
    emissiveIntensity: 0.3,
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  group.add(core);
}

function buildMaterials(qrCanvases, materialMode = 'standard', geneColor = 'purple') {
  const raw = [];
  for (let i = 0; i < 6; i++) {
    const canvas = qrCanvases[i] || createPlaceholderCanvas(i + 1);

    // For gene mode, overlay geometric pattern on QR code
    if (materialMode === 'gene') {
      overlayGenePattern(canvas, i, geneColor);
    }

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
    } else if (materialMode === 'gene') {
      // Gene code material - translucent with color tint
      const color = GENE_COLORS.find(c => c.name === geneColor)?.color || '#8B5CF6';
      raw.push(
        new THREE.MeshPhysicalMaterial({
          map: texture,
          transmission: 0.6,
          roughness: 0.2,
          metalness: 0.3,
          ior: 1.5,
          thickness: 0.3,
          envMapIntensity: 0.8,
          clearcoat: 0.8,
          clearcoatRoughness: 0.2,
          color: color,
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

/**
 * Overlay gene code pattern on canvas
 * Creates complex geometric patterns similar to the reference images
 */
function overlayGenePattern(canvas, faceIndex, geneColor) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const centerX = size / 2;
  const centerY = size / 2;

  const color = GENE_COLORS.find(c => c.name === geneColor)?.color || '#8B5CF6';

  // Create overlay with transparency
  ctx.save();

  // Draw complex geometric pattern
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.7;

  // Outer frame
  const frameSize = size * 0.85;
  const frameOffset = (size - frameSize) / 2;
  ctx.strokeRect(frameOffset, frameOffset, frameSize, frameSize);

  // Inner frame
  const innerFrameSize = size * 0.65;
  const innerFrameOffset = (size - innerFrameSize) / 2;
  ctx.strokeRect(innerFrameOffset, innerFrameOffset, innerFrameSize, innerFrameSize);

  // Center frame (hollow center)
  const centerFrameSize = size * 0.4;
  const centerFrameOffset = (size - centerFrameSize) / 2;
  ctx.strokeRect(centerFrameOffset, centerFrameOffset, centerFrameSize, centerFrameSize);

  // Draw connecting lines (circuit board style)
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;

  // Horizontal lines
  for (let i = 0; i < 4; i++) {
    const y = frameOffset + (i + 1) * (frameSize / 5);
    ctx.beginPath();
    ctx.moveTo(frameOffset, y);
    ctx.lineTo(centerFrameOffset, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centerFrameOffset + centerFrameSize, y);
    ctx.lineTo(frameOffset + frameSize, y);
    ctx.stroke();
  }

  // Vertical lines
  for (let i = 0; i < 4; i++) {
    const x = frameOffset + (i + 1) * (frameSize / 5);
    ctx.beginPath();
    ctx.moveTo(x, frameOffset);
    ctx.lineTo(x, centerFrameOffset);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, centerFrameOffset + centerFrameSize);
    ctx.lineTo(x, frameOffset + frameSize);
    ctx.stroke();
  }

  // Draw corner nodes
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.8;
  const nodeSize = 6;
  const corners = [
    [frameOffset, frameOffset],
    [frameOffset + frameSize, frameOffset],
    [frameOffset, frameOffset + frameSize],
    [frameOffset + frameSize, frameOffset + frameSize],
  ];
  for (const [x, y] of corners) {
    ctx.beginPath();
    ctx.arc(x, y, nodeSize, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw center hexagon
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.6;
  const hexSize = size * 0.15;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 - 30) * Math.PI / 180;
    const x = centerX + hexSize * Math.cos(angle);
    const y = centerY + hexSize * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  ctx.restore();
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
