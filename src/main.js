import { encodeToCubeCode } from './encoder.js';
import { decodeCubeCode } from './decoder.js';
import { startScanner } from './scanner.js';
import { createCube } from './cube3d.js';
import { renderCrossNet, downloadCrossNet } from './crossnet.js';
import { scanCrossNet } from './quickscan.js';
import { t, toggleLang } from './i18n/index.js';

let cube3d = null;
let qrCanvases = [];
let showCross = false;
let quickScanMode = false;
let colorMode = 'colorful'; // 'colorful' | 'bw' | 'inverted' | 'inverted-colorful' | 'gene' | 'fusion'
const COLOR_MODES = ['colorful', 'bw', 'inverted', 'inverted-colorful', 'gene', 'fusion'];
const COLOR_MODE_KEYS = { colorful: 'modeColorful', bw: 'modeBW', inverted: 'modeInverted', 'inverted-colorful': 'modeInvertedColorful', gene: 'modeGene', fusion: 'modeFusion' };
let singleFaceIdx = 0;
let showSingle = false;
let currentIcon = null;
let materialMode = 'standard';
let geneColor = 'purple';
let numFaces = 6;
let independentMode = false;
let errorLevel = 'M';

// --- i18n ---
function applyLang() {
  document.getElementById('title').textContent = t('title');
  document.getElementById('subtitle').textContent = t('subtitle');
  document.getElementById('tab-encode').textContent = t('tabEncode');
  document.getElementById('tab-decode').textContent = t('tabDecode');
  document.getElementById('input-data').placeholder = t('inputPlaceholder');
  document.getElementById('btn-encode').textContent = t('btnEncode');
  document.getElementById('btn-decode').textContent = t('btnDecode');
  document.getElementById('scan-label').textContent = t('scanned');
  document.getElementById('rotate-hint').textContent = t('rotateHint');
  document.getElementById('lang-switch').textContent = t('langSwitch');
  document.getElementById('btn-cross').textContent = showCross ? t('viewGrid') : t('viewCross');
  document.getElementById('btn-scan-mode').textContent = quickScanMode ? t('cameraMode') : t('quickScan');
  document.getElementById('quickscan-hint').textContent = t('quickScanHint');
  document.getElementById('btn-color-mode').textContent = t(COLOR_MODE_KEYS[colorMode]);
  document.getElementById('btn-single').textContent = t('viewSingle');
  document.getElementById('btn-icon').textContent = currentIcon ? t('removeIcon') : t('addIcon');
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (key && el.id !== 'btn-cross' && el.id !== 'btn-scan-mode' && el.id !== 'btn-color-mode' && el.id !== 'btn-single') {
      el.textContent = t(key);
    }
  });
  document.documentElement.lang = t('langSwitch') === 'EN' ? 'zh-CN' : 'en';
}

document.getElementById('lang-switch').addEventListener('click', () => {
  toggleLang();
  applyLang();
});

applyLang();

// --- Tab switching ---
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

// --- Face count selector ---
const faceCountSelect = document.getElementById('face-count');
faceCountSelect.addEventListener('change', (e) => {
  numFaces = parseInt(e.target.value, 10);
});

// --- Independent mode toggle ---
const independentModeCheckbox = document.getElementById('independent-mode');
independentModeCheckbox.addEventListener('change', (e) => {
  independentMode = e.target.checked;
});

// --- Error level selector ---
const errorLevelSelect = document.getElementById('error-level');
errorLevelSelect.addEventListener('change', (e) => {
  errorLevel = e.target.value;
});

// --- Face navigation buttons ---
document.querySelectorAll('.face-nav button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const face = btn.dataset.face;
    if (cube3d && face) {
      cube3d.snapToFace(face);
    }
  });
});

// --- Encode ---
const btnEncode = document.getElementById('btn-encode');
const btnCross = document.getElementById('btn-cross');
const btnSave = document.getElementById('btn-save');
const btnSingle = document.getElementById('btn-single');
const toolbar = document.getElementById('encode-toolbar');
const cubeContainer = document.getElementById('cube-container');
const crossContainer = document.getElementById('cross-container');
const singleContainer = document.getElementById('single-container');
const singleQr = document.getElementById('single-qr');
const faceCounter = document.getElementById('face-counter');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');

btnEncode.addEventListener('click', async () => {
  const input = document.getElementById('input-data').value.trim();
  if (!input) return;

  const output = document.getElementById('qr-output');
  output.innerHTML = t('generating');
  cubeContainer.style.display = 'none';
  crossContainer.style.display = 'none';
  singleContainer.style.display = 'none';
  toolbar.style.display = 'none';
  showSingle = false;
  btnSingle.classList.remove('active');

  try {
    const results = await encodeToCubeCode(input, { mode: colorMode, icon: currentIcon, numFaces, independent: independentMode, errorLevel });
    output.innerHTML = '';

    if (cube3d) {
      cube3d.dispose();
      cube3d = null;
    }

    qrCanvases = [];
    for (const { faceId, canvas } of results) {
      const cell = document.createElement('div');
      cell.className = 'qr-cell';
      cell.appendChild(canvas);
      const label = document.createElement('div');
      label.className = 'face-label';
      label.textContent = `${t('face')} ${faceId}`;
      cell.appendChild(label);
      output.appendChild(cell);
      qrCanvases.push(canvas);
    }

    toolbar.style.display = 'flex';

    if (showCross) {
      crossContainer.style.display = 'block';
      renderCrossNet(crossContainer, qrCanvases, { mode: colorMode });
    } else {
      cubeContainer.style.display = 'block';
      const cubeEl = document.getElementById('cube-3d');
      cubeEl.innerHTML = '';
      cube3d = createCube(cubeEl, qrCanvases, { materialMode });
    }
  } catch (err) {
    output.innerHTML = `${t('error')}: ${err.message}`;
  }
});

// Single face view
function renderSingleFace() {
  if (qrCanvases.length === 0) return;
  singleQr.innerHTML = '';
  const src = qrCanvases[singleFaceIdx];
  const img = document.createElement('img');
  img.src = src.toDataURL('image/png');
  img.style.maxWidth = '280px';
  img.style.width = '100%';
  singleQr.appendChild(img);
  faceCounter.textContent = `${singleFaceIdx + 1} / ${qrCanvases.length}`;
  btnPrev.disabled = singleFaceIdx === 0;
  btnNext.disabled = singleFaceIdx === qrCanvases.length - 1;
}

btnSingle.addEventListener('click', () => {
  showSingle = !showSingle;
  btnSingle.classList.toggle('active', showSingle);

  if (showSingle) {
    showCross = false;
    btnCross.classList.remove('active');
    if (cube3d) { cube3d.dispose(); cube3d = null; }
    cubeContainer.style.display = 'none';
    crossContainer.style.display = 'none';
    singleContainer.style.display = 'flex';
    document.getElementById('qr-output').style.display = 'none';
    singleFaceIdx = 0;
    renderSingleFace();
  } else {
    singleContainer.style.display = 'none';
    document.getElementById('qr-output').style.display = '';
    if (showCross) {
      crossContainer.style.display = 'block';
    } else {
      cubeContainer.style.display = 'block';
    }
  }
});

btnPrev.addEventListener('click', () => {
  if (singleFaceIdx > 0) { singleFaceIdx--; renderSingleFace(); }
});

btnNext.addEventListener('click', () => {
  if (singleFaceIdx < qrCanvases.length - 1) { singleFaceIdx++; renderSingleFace(); }
});

// Cross net toggle
btnCross.addEventListener('click', () => {
  showCross = !showCross;
  showSingle = false;
  btnSingle.classList.remove('active');
  btnCross.textContent = showCross ? t('viewGrid') : t('viewCross');
  btnCross.classList.toggle('active', showCross);
  singleContainer.style.display = 'none';
  document.getElementById('qr-output').style.display = '';

  if (showCross) {
    if (cube3d) { cube3d.dispose(); cube3d = null; }
    cubeContainer.style.display = 'none';
    crossContainer.style.display = 'block';
    renderCrossNet(crossContainer, qrCanvases, { mode: colorMode });
  } else {
    crossContainer.style.display = 'none';
    cubeContainer.style.display = 'block';
    const cubeEl = document.getElementById('cube-3d');
    cubeEl.innerHTML = '';
    cube3d = createCube(cubeEl, qrCanvases, { materialMode });
  }
});

// Color mode toggle
const btnColorMode = document.getElementById('btn-color-mode');
btnColorMode.addEventListener('click', async () => {
  const idx = COLOR_MODES.indexOf(colorMode);
  colorMode = COLOR_MODES[(idx + 1) % COLOR_MODES.length];
  btnColorMode.textContent = t(COLOR_MODE_KEYS[colorMode]);

  if (qrCanvases.length === 0) return;

  const input = document.getElementById('input-data').value.trim();
  if (!input) return;

  const results = await encodeToCubeCode(input, { mode: colorMode, icon: currentIcon });
  qrCanvases = [];
  const output = document.getElementById('qr-output');
  output.innerHTML = '';
  for (const { faceId, canvas } of results) {
    const cell = document.createElement('div');
    cell.className = 'qr-cell';
    cell.appendChild(canvas);
    const label = document.createElement('div');
    label.className = 'face-label';
    label.textContent = `${t('face')} ${faceId}`;
    cell.appendChild(label);
    output.appendChild(cell);
    qrCanvases.push(canvas);
  }

  if (showSingle) {
    renderSingleFace();
  }
  if (showCross) {
    renderCrossNet(crossContainer, qrCanvases, { mode: colorMode });
  }
});

// Icon upload
const btnIcon = document.getElementById('btn-icon');
const iconInput = document.getElementById('icon-input');

btnIcon.addEventListener('click', () => {
  iconInput.click();
});

iconInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const img = new Image();
  img.onload = () => {
    currentIcon = img;
    btnIcon.classList.add('active');

    // Re-encode with icon if data exists
    const input = document.getElementById('input-data').value.trim();
    if (input && qrCanvases.length > 0) {
      reencodeWithIcon();
    }
  };
  img.src = URL.createObjectURL(file);
  iconInput.value = '';
});

async function reencodeWithIcon() {
  const input = document.getElementById('input-data').value.trim();
  if (!input) return;

  const results = await encodeToCubeCode(input, { mode: colorMode, icon: currentIcon });
  qrCanvases = [];
  const output = document.getElementById('qr-output');
  output.innerHTML = '';
  for (const { faceId, canvas } of results) {
    const cell = document.createElement('div');
    cell.className = 'qr-cell';
    cell.appendChild(canvas);
    const label = document.createElement('div');
    label.className = 'face-label';
    label.textContent = `${t('face')} ${faceId}`;
    cell.appendChild(label);
    output.appendChild(cell);
    qrCanvases.push(canvas);
  }

  if (showSingle) {
    renderSingleFace();
  }
  if (showCross) {
    renderCrossNet(crossContainer, qrCanvases, { mode: colorMode });
  }
}

// Remove icon
btnIcon.addEventListener('dblclick', () => {
  currentIcon = null;
  btnIcon.classList.remove('active');

  // Re-encode without icon if data exists
  const input = document.getElementById('input-data').value.trim();
  if (input && qrCanvases.length > 0) {
    reencodeWithIcon();
  }
});

// Material mode toggle (standard/glass/gene)
const MATERIAL_MODES = ['standard', 'glass', 'gene'];
const MATERIAL_MODE_KEYS = { standard: 'standardMaterial', glass: 'glassMaterial', gene: 'geneMaterial' };

const btnMaterial = document.getElementById('btn-material');
btnMaterial.addEventListener('click', () => {
  const idx = MATERIAL_MODES.indexOf(materialMode);
  materialMode = MATERIAL_MODES[(idx + 1) % MATERIAL_MODES.length];
  btnMaterial.textContent = t(MATERIAL_MODE_KEYS[materialMode]);
  btnMaterial.classList.toggle('active', materialMode !== 'standard');

  // Show/hide gene color picker
  const geneColorPicker = document.getElementById('gene-color-picker');
  if (geneColorPicker) {
    geneColorPicker.style.display = materialMode === 'gene' ? 'flex' : 'none';
  }

  // Update cube with new material mode
  if (cube3d && qrCanvases.length > 0) {
    const cubeEl = document.getElementById('cube-3d');
    cube3d.dispose();
    cubeEl.innerHTML = '';
    cube3d = createCube(cubeEl, qrCanvases, { materialMode, geneColor });
  }
});

// Gene color picker
const geneColorPicker = document.getElementById('gene-color-picker');
if (geneColorPicker) {
  geneColorPicker.addEventListener('click', (e) => {
    const btn = e.target.closest('.gene-color-btn');
    if (!btn) return;

    geneColor = btn.dataset.color;

    // Update active state
    geneColorPicker.querySelectorAll('.gene-color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Update cube with new color
    if (cube3d && qrCanvases.length > 0 && materialMode === 'gene') {
      const cubeEl = document.getElementById('cube-3d');
      cube3d.dispose();
      cubeEl.innerHTML = '';
      cube3d = createCube(cubeEl, qrCanvases, { materialMode, geneColor });
    }
  });
}

// Save cross net as image
btnSave.addEventListener('click', () => {
  if (qrCanvases.length === 0) return;
  downloadCrossNet(qrCanvases, colorMode);
});

// --- Decode ---
const scannedPayloads = [];
let scanner = null;

const faceIndicators = document.getElementById('scanned-faces');
for (let i = 1; i <= 6; i++) {
  const dot = document.createElement('div');
  dot.className = 'face-dot';
  dot.textContent = i;
  dot.dataset.face = i;
  faceIndicators.appendChild(dot);
}

const btnDecode = document.getElementById('btn-decode');
const btnScanMode = document.getElementById('btn-scan-mode');
const btnUpload = document.getElementById('btn-upload');
const fileInput = document.getElementById('file-input');
const decodeSection = document.getElementById('decode');
const quickscanOverlay = document.getElementById('quickscan-overlay');
const quickscanHint = document.getElementById('quickscan-hint');

// Quick scan mode toggle
btnScanMode.addEventListener('click', () => {
  quickScanMode = !quickScanMode;
  btnScanMode.textContent = quickScanMode ? t('cameraMode') : t('quickScan');
  btnScanMode.classList.toggle('active', quickScanMode);
  quickscanOverlay.style.display = quickScanMode ? 'block' : 'none';
  quickscanHint.style.display = quickScanMode ? 'block' : 'none';

  // Restart scanner with new mode
  if (scanner) { scanner.stop(); scanner = null; }
  startCamera(quickScanMode);
});

// Upload image for scanning
btnUpload.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const result = scanCrossNet(canvas);
    const output = document.getElementById('decoded-output');

    if (result.found > 0) {
      for (const [faceId, payload] of result.payloads) {
        if (!scannedPayloads.some((p) => extractFaceId(p) === faceId)) {
          scannedPayloads.push(payload);
        }
      }
      updateScanCount();

      // Auto-decode if all 6 faces found
      if (scannedPayloads.length >= numFaces) {
        const decoded = decodeCubeCode(scannedPayloads, numFaces);
        if (decoded.success) {
          output.textContent = decoded.data;
        }
      } else {
        output.textContent = `${t('scanned')}: ${result.found} / 6`;
      }
    } else {
      output.textContent = t('noFaces');
    }

    fileInput.value = '';
  };
  img.src = URL.createObjectURL(file);
});

// Decode button
const btnReset = document.getElementById('btn-reset');

btnReset.addEventListener('click', () => {
  scannedPayloads.length = 0;
  document.getElementById('scan-count').textContent = '0';
  document.getElementById('decoded-output').textContent = '';
  document.querySelectorAll('.face-dot').forEach((d) => d.classList.remove('scanned'));
  if (scanner) { scanner.reset(); }
});

btnDecode.addEventListener('click', () => {
  const output = document.getElementById('decoded-output');

  if (scannedPayloads.length === 0) {
    output.textContent = t('noFaces');
    return;
  }

  const decoded = decodeCubeCode(scannedPayloads, numFaces);

  if (decoded.success) {
    output.textContent = decoded.data;
  } else if (decoded.missingFaces.length > 0) {
    output.textContent = `${t('missingFaces')}: ${decoded.missingFaces.join(', ')}`;
  } else {
    output.textContent = `${t('error')}: ${decoded.error}`;
  }
});

const observer = new MutationObserver(() => {
  if (decodeSection.classList.contains('active') && !scanner) {
    startCamera(quickScanMode);
  }
});
observer.observe(decodeSection, { attributes: true, attributeFilter: ['class'] });

async function startCamera(quick = false) {
  const video = document.getElementById('camera-feed');
  const canvas = document.getElementById('scan-canvas');

  try {
    scanner = startScanner(video, canvas, (_payloadBytes, faceId) => {
      // Deduplicate by faceId
      if (!scannedPayloads.some((p) => extractFaceId(p) === faceId)) {
        scannedPayloads.push(_payloadBytes);
        updateScanCount();

        // Auto-decode when all 6 faces found
        if (scannedPayloads.length >= numFaces) {
          const decoded = decodeCubeCode(scannedPayloads, numFaces);
          if (decoded.success) {
            document.getElementById('decoded-output').textContent = decoded.data;
          }
        }
      }
    }, { quick });
  } catch (err) {
    document.getElementById('scan-status').textContent = `${t('cameraError')}: ${err.message}`;
  }
}

function updateScanCount() {
  document.getElementById('scan-count').textContent = `${scannedPayloads.length} / ${numFaces}`;

  for (const payload of scannedPayloads) {
    const faceId = extractFaceId(payload);
    const dot = document.querySelector(`.face-dot[data-face="${faceId}"]`);
    if (dot) dot.classList.add('scanned');
  }
}

function extractFaceId(payloadBytes) {
  const bits = Array.from(payloadBytes)
    .map((b) => b.toString(2).padStart(8, '0'))
    .join('');
  return parseInt(bits.slice(0, 3), 2);
}
