import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NearestFilter,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  Scene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
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
  { name: 'blue', color: '#0F766E', label: '痴' },    // 蓝绿色 = 痴
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

  const scene = new Scene();
  scene.background = materialMode === 'gene' || materialMode === 'rubik'
    ? new Color(0x05060c)
    : new Color(0xf5f5f5);

  // Add environment map for glossy materials.
  let pmremGenerator = null;
  let envRenderer = null;
  if (materialMode === 'glass' || materialMode === 'gene' || materialMode === 'rubik') {
    envRenderer = new WebGLRenderer({ antialias: true });
    pmremGenerator = new PMREMGenerator(envRenderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment()).texture;
    scene.environment = envTexture;
  }

  const camera = new PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(2.5, 2, 2.5);

  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(getRendererPixelRatio(materialMode));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = materialMode === 'gene' ? 1.65 : materialMode === 'rubik' ? 1.22 : 1.0;
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
    front: new Vector3(0, 0, 4.0),      // +Z face
    back: new Vector3(0, 0, -4.0),      // -Z face
    top: new Vector3(0, 4.0, 0.001),    // +Y face
    bottom: new Vector3(0, -4.0, 0.001), // -Y face
    left: new Vector3(-4.0, 0, 0),      // -X face
    right: new Vector3(4.0, 0, 0),      // +X face
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

  const ambient = new AmbientLight(0xffffff, materialMode === 'gene' ? 0.22 : materialMode === 'rubik' ? 0.46 : 0.8);
  scene.add(ambient);
  const dirLight = new DirectionalLight(0xffffff, materialMode === 'gene' ? 0.95 : materialMode === 'rubik' ? 1.05 : 0.5);
  dirLight.position.set(5, 5, 5);
  scene.add(dirLight);
  if (materialMode === 'gene' || materialMode === 'rubik') {
    const rimLight = new DirectionalLight(0x9bbcff, 1.45);
    rimLight.position.set(-4, 3, -5);
    scene.add(rimLight);
    const warmKeyLight = new DirectionalLight(0xffd1b8, 0.75);
    warmKeyLight.position.set(3.5, -2, 4);
    scene.add(warmKeyLight);
  }

  // Create main group
  const mainGroup = new Group();

  let cube, cubeGroup;

  if (materialMode === 'gene') {
    // Gene mode: create individual cubes for each QR module
    cubeGroup = createGeneCube(qrCanvases, geneColor);
    mainGroup.add(cubeGroup);
  } else if (materialMode === 'rubik') {
    cubeGroup = createRubikCube(qrCanvases);
    mainGroup.add(cubeGroup);
  } else {
    // Standard/Glass mode: solid cube with textures
    const geometry = new BoxGeometry(1.8, 1.8, 1.8);
    const materials = buildMaterials(qrCanvases, materialMode, geneColor);
    cube = new Mesh(geometry, materials);
    mainGroup.add(cube);

    const edges = new EdgesGeometry(geometry, 30);
    const line = new LineSegments(edges, new LineBasicMaterial({
      color: materialMode === 'glass' ? 0xffffff : 0x333333,
      transparent: true,
      opacity: materialMode === 'glass' ? 0.35 : 0.75,
    }));
    mainGroup.add(line);
  }

  scene.add(mainGroup);

  const rubikGestureCleanup = materialMode === 'rubik'
    ? installRubikSwipeTwists(renderer.domElement, camera, controls, () => cubeGroup)
    : null;

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
      if (materialMode === 'gene' || materialMode === 'rubik') {
        // Remove old cube group and create new one. Dispose GPU resources
        // explicitly because Three.js does not release removed objects for us.
        cubeGroup.stopTwists?.();
        mainGroup.remove(cubeGroup);
        disposeObject3D(cubeGroup);
        cubeGroup = materialMode === 'gene' ? createGeneCube(qrCanvases, geneColor) : createRubikCube(qrCanvases);
        mainGroup.add(cubeGroup);
      } else if (cube) {
        disposeMaterial(cube.material);
        cube.material = buildMaterials(qrCanvases, materialMode, geneColor);
      }
    },
    snapToFace(faceName) {
      snapToFace(faceName);
    },
    setSnapRotation(enabled) {
      controls.autoRotate = enabled;
    },
    twist(move) {
      if (materialMode === 'rubik' && cubeGroup?.twist) {
        controls.autoRotate = false;
        cubeGroup.twist(move);
      }
    },
    reverseLastTwist() {
      if (materialMode === 'rubik' && cubeGroup?.reverseLastTwist) {
        controls.autoRotate = false;
        cubeGroup.reverseLastTwist();
      }
    },
    twistLayer(axis, layer, dir) {
      if (materialMode === 'rubik' && cubeGroup?.twistLayer) {
        controls.autoRotate = false;
        cubeGroup.twistLayer(axis, layer, dir);
      }
    },
    scramble(count) {
      if (materialMode === 'rubik' && cubeGroup?.scramble) {
        controls.autoRotate = false;
        cubeGroup.scramble(count);
      }
    },
    dispose() {
      cancelAnimationFrame(animId);
      rubikGestureCleanup?.();
      controls.dispose();
      cubeGroup?.stopTwists?.();
      window.removeEventListener('resize', onResize);
      disposeObject3D(mainGroup);
      if (pmremGenerator) pmremGenerator.dispose();
      if (envRenderer) envRenderer.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}

function getRendererPixelRatio(materialMode) {
  const dpr = window.devicePixelRatio || 1;
  // Gene mode uses many translucent 3D modules. Capping DPR reduces mobile GPU
  // fill-rate pressure while keeping the visual crisp enough for preview.
  return Math.min(dpr, materialMode === 'gene' ? 1.5 : 2);
}

function installRubikSwipeTwists(domElement, _camera, controls, getCubeGroup) {
  const dragThreshold = 30;
  let gesture = null;

  const isRightTurnZone = (event) => {
    const rect = domElement.getBoundingClientRect();
    return event.clientX - rect.left >= rect.width / 2;
  };

  const pickLayer = (event) => {
    const rect = domElement.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    if (ratio < 1 / 3) return 1;
    if (ratio < 2 / 3) return 0;
    return -1;
  };

  const onPointerDown = (event) => {
    if (!event.isPrimary && event.pointerType !== 'mouse') return;

    // 双手模式：左半边只调视角；右半边只转上/中/下层，避免两套手势互相抢。
    if (!isRightTurnZone(event)) {
      gesture = null;
      controls.enabled = true;
      return;
    }

    const group = getCubeGroup?.();
    if (!group?.twistLayer) return;

    gesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      layer: pickLayer(event),
      triggered: false,
    };
    controls.enabled = false;
    controls.autoRotate = false;
    domElement.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopImmediatePropagation?.();
  };

  const onPointerMove = (event) => {
    if (!gesture || gesture.pointerId !== event.pointerId || gesture.triggered) return;

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (Math.hypot(dx, dy) < dragThreshold) return;

    // 右侧像“推层”：按起点高度锁定上/中/下层；横向滑动决定方向。
    const dir = dx >= 0 ? 1 : -1;
    getCubeGroup?.()?.twistLayer?.('y', gesture.layer, dir);
    gesture.triggered = true;
    event.preventDefault();
    event.stopImmediatePropagation?.();
  };

  const onPointerEnd = (event) => {
    if (gesture?.pointerId === event.pointerId) {
      gesture = null;
      controls.enabled = true;
      domElement.releasePointerCapture?.(event.pointerId);
    }
  };

  domElement.addEventListener('pointerdown', onPointerDown, { passive: false, capture: true });
  domElement.addEventListener('pointermove', onPointerMove, { passive: false, capture: true });
  domElement.addEventListener('pointerup', onPointerEnd, { passive: true, capture: true });
  domElement.addEventListener('pointercancel', onPointerEnd, { passive: true, capture: true });
  domElement.addEventListener('pointerleave', onPointerEnd, { passive: true, capture: true });

  return () => {
    domElement.removeEventListener('pointerdown', onPointerDown, { capture: true });
    domElement.removeEventListener('pointermove', onPointerMove, { capture: true });
    domElement.removeEventListener('pointerup', onPointerEnd, { capture: true });
    domElement.removeEventListener('pointercancel', onPointerEnd, { capture: true });
    domElement.removeEventListener('pointerleave', onPointerEnd, { capture: true });
    controls.enabled = true;
  };
}

function disposeObject3D(object) {
  if (!object) return;
  object.traverse?.((child) => {
    if (child.geometry) child.geometry.dispose?.();
    if (child.material) disposeMaterial(child.material);
  });
}

function disposeMaterial(material) {
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
    return;
  }
  if (!material) return;

  for (const value of Object.values(material)) {
    if (value?.isTexture) value.dispose?.();
  }
  material.dispose?.();
}


function createRubikCube(qrCanvases) {
  const group = new Group();
  const cubies = [];
  const cubieSize = 0.56;
  const step = 0.615;
  const stickerSize = cubieSize * 0.84;
  const plasticMaterial = new MeshPhysicalMaterial({
    color: 0x050712,
    roughness: 0.34,
    metalness: 0.08,
    clearcoat: 0.75,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.35,
  });
  const cubieGeometry = new RoundedBoxGeometry(cubieSize, cubieSize, cubieSize, 3, 0.05);
  const stickerGeometry = new PlaneGeometry(stickerSize, stickerSize);
  const stickerMaterials = buildRubikStickerMaterials(qrCanvases);

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const cubie = new Group();
        cubie.userData.isRubikCubie = true;
        cubie.userData.coord = { x, y, z };
        cubie.position.set(x * step, y * step, z * step);
        cubie.add(new Mesh(cubieGeometry, plasticMaterial));
        addRubikSticker(cubie, stickerGeometry, stickerMaterials.front[1 - y][x + 1], 'front', z === 1);
        addRubikSticker(cubie, stickerGeometry, stickerMaterials.back[1 - y][1 - x], 'back', z === -1);
        addRubikSticker(cubie, stickerGeometry, stickerMaterials.top[z + 1][x + 1], 'top', y === 1);
        addRubikSticker(cubie, stickerGeometry, stickerMaterials.bottom[1 - z][x + 1], 'bottom', y === -1);
        addRubikSticker(cubie, stickerGeometry, stickerMaterials.left[1 - y][z + 1], 'left', x === -1);
        addRubikSticker(cubie, stickerGeometry, stickerMaterials.right[1 - y][1 - z], 'right', x === 1);
        group.add(cubie);
        cubies.push(cubie);
      }
    }
  }

  let turning = false;
  let stopped = false;
  let turnFrameId = null;
  const moveQueue = [];
  const moveHistory = [];
  const maxQueuedTurns = 96;
  const maxHistoryTurns = 160;

  const enqueueTurns = (moves, { recordHistory = true } = {}) => {
    const validMoves = moves.filter((move) => getRubikMoveSpec(move));
    if (validMoves.length === 0 || stopped) return;
    const room = Math.max(0, maxQueuedTurns - moveQueue.length);
    moveQueue.push(...validMoves.slice(0, room).map((move) => ({ move, recordHistory })));
    runNextQueuedTurn();
  };

  const finishTurn = (turnGroup, layer, spec, queueItem) => {
    // Important: children already inherit turnGroup's rotation while the
    // animation runs. `group.attach(cubie)` preserves that world transform
    // when moving the cubie back to the main cube. Applying turnGroup.matrix
    // manually here would rotate/translate the cubie a second time, which is
    // what made pieces drift away or appear to disappear after several turns.
    turnGroup.rotation[spec.axis] = spec.angle;
    turnGroup.updateMatrixWorld(true);
    layer.forEach((cubie) => {
      const nextCoord = rotateRubikCoord(cubie.userData.coord, spec.axis, spec.dir);
      group.attach(cubie);
      cubie.userData.coord = nextCoord;
      cubie.position.set(nextCoord.x * step, nextCoord.y * step, nextCoord.z * step);
      snapCubieRotation(cubie);
    });
    group.remove(turnGroup);
    if (queueItem.recordHistory) {
      moveHistory.push(queueItem.move);
      if (moveHistory.length > maxHistoryTurns) {
        moveHistory.splice(0, moveHistory.length - maxHistoryTurns);
      }
    }
    turning = false;
    runNextQueuedTurn();
  };

  function runNextQueuedTurn() {
    if (turning || stopped) return;
    const queueItem = moveQueue.shift();
    if (!queueItem) return;
    const { move } = queueItem;
    const spec = getRubikMoveSpec(move);
    if (!spec) return;

    turning = true;
    const layer = cubies.filter((cubie) => cubie.userData.coord[spec.axis] === spec.layer);
    const turnGroup = new Group();
    group.add(turnGroup);
    layer.forEach((cubie) => turnGroup.attach(cubie));

    const start = window.performance.now();
    const duration = 260;
    const animateTurn = (now) => {
      if (stopped) return;
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      turnGroup.rotation[spec.axis] = spec.angle * eased;
      if (t < 1) {
        turnFrameId = requestAnimationFrame(animateTurn);
        return;
      }
      turnFrameId = null;
      finishTurn(turnGroup, layer, spec, queueItem);
    };
    turnFrameId = requestAnimationFrame(animateTurn);
  }

  group.twist = (move) => {
    enqueueTurns([move]);
  };

  group.twistLayer = (axis, layer, dir) => {
    const move = getRubikMoveFromLayer(axis, layer, dir);
    if (move) enqueueTurns([move]);
  };

  group.scramble = (count = 20) => {
    enqueueTurns(createRubikScrambleMoves(count));
  };

  group.reverseLastTwist = () => {
    const lastMove = moveHistory.pop();
    if (!lastMove) return;
    enqueueTurns([invertRubikMove(lastMove)], { recordHistory: false });
  };

  group.stopTwists = () => {
    stopped = true;
    moveQueue.length = 0;
    if (turnFrameId !== null) {
      cancelAnimationFrame(turnFrameId);
      turnFrameId = null;
    }
  };

  return group;
}


function snapCubieRotation(cubie) {
  const quarter = Math.PI / 2;
  cubie.rotation.set(
    Math.round(cubie.rotation.x / quarter) * quarter,
    Math.round(cubie.rotation.y / quarter) * quarter,
    Math.round(cubie.rotation.z / quarter) * quarter,
  );
  cubie.updateMatrix();
  cubie.updateMatrixWorld(true);
}

function buildRubikStickerMaterials(qrCanvases) {
  const faces = ['front', 'back', 'top', 'bottom', 'left', 'right'];
  const result = {};
  for (let i = 0; i < 6; i++) {
    result[faces[i]] = splitCanvasMaterials(qrCanvases[i] || createPlaceholderCanvas(i + 1));
  }
  return result;
}

function splitCanvasMaterials(canvas) {
  const rows = [];
  for (let row = 0; row < 3; row++) {
    const cols = [];
    for (let col = 0; col < 3; col++) {
      const sticker = document.createElement('canvas');
      sticker.width = Math.floor(canvas.width / 3);
      sticker.height = Math.floor(canvas.height / 3);
      const ctx = sticker.getContext('2d');
      const sx = Math.floor((canvas.width * col) / 3);
      const sy = Math.floor((canvas.height * row) / 3);
      const sr = Math.floor((canvas.width * (col + 1)) / 3);
      const sb = Math.floor((canvas.height * (row + 1)) / 3);
      ctx.drawImage(canvas, sx, sy, sr - sx, sb - sy, 0, 0, sticker.width, sticker.height);
      const texture = new CanvasTexture(sticker);
      texture.colorSpace = SRGBColorSpace;
      texture.minFilter = NearestFilter;
      texture.magFilter = NearestFilter;
      texture.wrapS = ClampToEdgeWrapping;
      texture.wrapT = ClampToEdgeWrapping;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
      cols.push(new MeshBasicMaterial({
        map: texture,
        color: 0xffffff,
        side: DoubleSide,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }));
    }
    rows.push(cols);
  }
  return rows;
}

function addRubikSticker(cubie, geometry, material, face, enabled) {
  if (!enabled) return;
  const mesh = new Mesh(geometry, material);
  mesh.userData.rubikSticker = true;
  mesh.userData.rubikFace = face;
  // Keep stickers slightly above the rounded cubie shell. The previous value
  // was just inside the 0.56 / 2 surface, which caused z-fighting / dark
  // clipping on some mobile WebGL renderers.
  const offset = 0.286;
  switch (face) {
    case 'front':
      mesh.position.z = offset;
      break;
    case 'back':
      mesh.position.z = -offset;
      mesh.rotation.y = Math.PI;
      break;
    case 'top':
      mesh.position.y = offset;
      mesh.rotation.x = -Math.PI / 2;
      break;
    case 'bottom':
      mesh.position.y = -offset;
      mesh.rotation.x = Math.PI / 2;
      break;
    case 'left':
      mesh.position.x = -offset;
      mesh.rotation.y = -Math.PI / 2;
      break;
    case 'right':
      mesh.position.x = offset;
      mesh.rotation.y = Math.PI / 2;
      break;
  }
  cubie.add(mesh);
}

function getRubikMoveSpec(move) {
  const specs = {
    U: { axis: 'y', layer: 1, angle: Math.PI / 2, dir: 1 },
    D: { axis: 'y', layer: -1, angle: -Math.PI / 2, dir: -1 },
    L: { axis: 'x', layer: -1, angle: Math.PI / 2, dir: 1 },
    R: { axis: 'x', layer: 1, angle: -Math.PI / 2, dir: -1 },
    F: { axis: 'z', layer: 1, angle: -Math.PI / 2, dir: -1 },
    B: { axis: 'z', layer: -1, angle: Math.PI / 2, dir: 1 },
    "U'": { axis: 'y', layer: 1, angle: -Math.PI / 2, dir: -1 },
    "D'": { axis: 'y', layer: -1, angle: Math.PI / 2, dir: 1 },
    "L'": { axis: 'x', layer: -1, angle: -Math.PI / 2, dir: -1 },
    "R'": { axis: 'x', layer: 1, angle: Math.PI / 2, dir: 1 },
    "F'": { axis: 'z', layer: 1, angle: Math.PI / 2, dir: 1 },
    "B'": { axis: 'z', layer: -1, angle: -Math.PI / 2, dir: -1 },
    M: { axis: 'x', layer: 0, angle: Math.PI / 2, dir: 1 },
    "M'": { axis: 'x', layer: 0, angle: -Math.PI / 2, dir: -1 },
    E: { axis: 'y', layer: 0, angle: -Math.PI / 2, dir: -1 },
    "E'": { axis: 'y', layer: 0, angle: Math.PI / 2, dir: 1 },
    S: { axis: 'z', layer: 0, angle: -Math.PI / 2, dir: -1 },
    "S'": { axis: 'z', layer: 0, angle: Math.PI / 2, dir: 1 },
  };
  return specs[move];
}

function getRubikMoveFromLayer(axis, layer, dir) {
  const normalizedAxis = axis === 'x' || axis === 'y' || axis === 'z' ? axis : null;
  const normalizedLayer = layer === -1 || layer === 0 || layer === 1 ? layer : null;
  const normalizedDir = dir >= 0 ? 1 : -1;
  if (!normalizedAxis || normalizedLayer === null) return null;

  const specs = {
    y: { 1: { 1: 'U', '-1': "U'" }, 0: { 1: "E'", '-1': 'E' }, '-1': { 1: "D'", '-1': 'D' } },
    x: { 1: { 1: "R'", '-1': 'R' }, 0: { 1: 'M', '-1': "M'" }, '-1': { 1: 'L', '-1': "L'" } },
    z: { 1: { 1: "F'", '-1': 'F' }, 0: { 1: "S'", '-1': 'S' }, '-1': { 1: 'B', '-1': "B'" } },
  };
  return specs[normalizedAxis]?.[normalizedLayer]?.[normalizedDir] || null;
}

function invertRubikMove(move) {
  return move.endsWith("'") ? move.slice(0, -1) : `${move}'`;
}

function createRubikScrambleMoves(count) {
  const moves = ['U', 'D', 'L', 'R', 'F', 'B'];
  const axes = { U: 'y', D: 'y', L: 'x', R: 'x', F: 'z', B: 'z' };
  const safeCount = Math.min(60, Math.max(1, Number.parseInt(count, 10) || 20));
  const result = [];
  let lastAxis = null;

  for (let i = 0; i < safeCount; i++) {
    const candidates = moves.filter((move) => axes[move] !== lastAxis);
    const move = candidates[Math.floor(Math.random() * candidates.length)];
    result.push(move);
    lastAxis = axes[move];
  }

  return result;
}

function rotateRubikCoord(coord, axis, dir) {
  const { x, y, z } = coord;
  if (axis === 'x') return { x, y: -dir * z, z: dir * y };
  if (axis === 'y') return { x: dir * z, y, z: -dir * x };
  return { x: -dir * y, y: dir * x, z };
}

/**
 * Create gene code cube with individual modules
 * Adjacent modules (face-to-face) appear merged when touching
 * Edge-to-edge connections remain as separate cubes
 */
function createGeneCube(qrCanvases, geneColor) {
  const group = new Group();
  const color = GENE_COLORS.find(c => c.name === geneColor)?.color || '#8B5CF6';
  const glowColor = new Color(color);

  // Gem/acrylic material inspired by the reference: saturated translucent
  // color, strong inner glow, glossy highlights and low roughness.
  const moduleMaterial = new MeshPhysicalMaterial({
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

  const baseMaterial = new MeshPhysicalMaterial({
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
    const baseGeometry = new BoxGeometry(
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
        const baseMesh = new Mesh(baseGeometry, baseMaterial);
        positionGeneTile(baseMesh, boxIdx, x, y, halfSize + baseDepth / 2);
        group.add(baseMesh);

        // Foreground modules are part of the QR code relief.
        if (isModule) {
          const mesh = new Mesh(getRaisedGeometry(row, col, numModules, tileSize, module3DSize, edgeWrap), moduleMaterial);
          positionGeneTile(mesh, boxIdx, x, y, halfSize + baseDepth + depth / 2);
          group.add(mesh);
        }
      }
    }
  }

  // Add local internal lights for a premium acrylic/neon glow.
  // Keep the light concentrated inside the material instead of drawing a
  // visible full-ball halo around the cube.
  const pointLight = new PointLight(color, 4.2, 3.4, 1.7);
  pointLight.position.set(0, 0, 0);
  group.add(pointLight);
  const topLight = new PointLight(0xffffff, 1.15, 2.8, 2);
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
    const sprite = new Sprite(new SpriteMaterial({
      map: glowTexture,
      color,
      transparent: true,
      opacity,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    }));
    sprite.position.set(x, y, z);
    sprite.scale.set(scale, scale, 1);
    group.add(sprite);
  }

  const beamMaterial = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.18,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  });
  const beams = [
    { position: [-1.04, 0.18, 0.82], rotation: [0.25, 0.1, -0.64], length: 1.35, width: 0.025 },
    { position: [0.74, 0.88, 0.26], rotation: [0.1, -0.75, 0.45], length: 1.15, width: 0.02 },
    { position: [0.96, -0.34, -0.62], rotation: [-0.35, 0.48, 0.18], length: 1.05, width: 0.018 },
  ];

  for (const beam of beams) {
    const geometry = new PlaneGeometry(beam.width, beam.length);
    const mesh = new Mesh(geometry, beamMaterial);
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
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
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
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.generateMipmaps = false;
    texture.anisotropy = 1;

    if (materialMode === 'glass') {
      // Glass material with transparency and reflections
      raw.push(
        new MeshPhysicalMaterial({
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
        new MeshStandardMaterial({
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
