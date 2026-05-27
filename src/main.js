import { encodeToCubeCode } from './encoder.js';
import { decodeCubeCode } from './decoder.js';
import { startScanner } from './scanner.js';
import { createCube } from './cube3d.js';
import { renderCrossNet } from './crossnet.js';
import { scanCrossNet } from './quickscan.js';
import { t, toggleLang } from './i18n/index.js';

let cube3d = null;
let qrCanvases = [];
let showCross = false;
let quickScanMode = false;

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
  document.getElementById('btn-color').textContent = t('colorMode');
  document.getElementById('btn-cross').textContent = showCross ? t('viewGrid') : t('viewCross');
  document.getElementById('btn-scan-mode').textContent = quickScanMode ? t('tabDecode') : t('quickScan');
  document.getElementById('quickscan-hint').textContent = t('quickScanHint');
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (key && el.id !== 'btn-color' && el.id !== 'btn-cross' && el.id !== 'btn-scan-mode') {
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

// --- Encode ---
const btnEncode = document.getElementById('btn-encode');
const btnColor = document.getElementById('btn-color');
const btnCross = document.getElementById('btn-cross');
const toolbar = document.getElementById('encode-toolbar');
const cubeContainer = document.getElementById('cube-container');
const crossContainer = document.getElementById('cross-container');

btnEncode.addEventListener('click', async () => {
  const input = document.getElementById('input-data').value.trim();
  if (!input) return;

  const output = document.getElementById('qr-output');
  output.innerHTML = t('generating');
  cubeContainer.style.display = 'none';
  crossContainer.style.display = 'none';
  toolbar.style.display = 'none';

  try {
    const results = await encodeToCubeCode(input);
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
      renderCrossNet(crossContainer, qrCanvases);
    } else {
      cubeContainer.style.display = 'block';
      const cubeEl = document.getElementById('cube-3d');
      cubeEl.innerHTML = '';
      cube3d = createCube(cubeEl, qrCanvases);
    }
  } catch (err) {
    output.innerHTML = `${t('error')}: ${err.message}`;
  }
});

// Colorful toggle
btnColor.addEventListener('click', () => {
  if (!cube3d) return;
  const isColorful = cube3d.toggleColorful();
  btnColor.classList.toggle('active', isColorful);
});

// Cross net toggle
btnCross.addEventListener('click', () => {
  showCross = !showCross;
  btnCross.textContent = showCross ? t('viewGrid') : t('viewCross');
  btnCross.classList.toggle('active', showCross);

  if (showCross) {
    if (cube3d) { cube3d.dispose(); cube3d = null; }
    cubeContainer.style.display = 'none';
    crossContainer.style.display = 'block';
    renderCrossNet(crossContainer, qrCanvases);
  } else {
    crossContainer.style.display = 'none';
    cubeContainer.style.display = 'block';
    const cubeEl = document.getElementById('cube-3d');
    cubeEl.innerHTML = '';
    cube3d = createCube(cubeEl, qrCanvases);
  }
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
const decodeSection = document.getElementById('decode');
const quickscanOverlay = document.getElementById('quickscan-overlay');
const quickscanHint = document.getElementById('quickscan-hint');

// Quick scan mode toggle
btnScanMode.addEventListener('click', () => {
  quickScanMode = !quickScanMode;
  btnScanMode.textContent = quickScanMode ? t('tabDecode') : t('quickScan');
  btnScanMode.classList.toggle('active', quickScanMode);
  quickscanOverlay.style.display = quickScanMode ? 'block' : 'none';
  quickscanHint.style.display = quickScanMode ? 'block' : 'none';
});

// Scan all button for quick scan
btnDecode.addEventListener('click', () => {
  const output = document.getElementById('decoded-output');

  if (quickScanMode) {
    // Quick scan: capture current video frame and scan all 6 faces
    const video = document.getElementById('camera-feed');
    const canvas = document.getElementById('scan-canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const result = scanCrossNet(canvas);
    if (result.found > 0) {
      for (const [faceId, payload] of result.payloads) {
        if (!scannedPayloads.some((p) => extractFaceId(p) === faceId)) {
          scannedPayloads.push(payload);
        }
      }
      updateScanCount();
      output.textContent = `${t('scanned')}: ${result.found} / 6`;
    } else {
      output.textContent = t('noFaces');
    }
    return;
  }

  // Normal decode
  if (scannedPayloads.length === 0) {
    output.textContent = t('noFaces');
    return;
  }

  const decoded = decodeCubeCode(scannedPayloads);

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
    startCamera();
  }
});
observer.observe(decodeSection, { attributes: true, attributeFilter: ['class'] });

async function startCamera() {
  const video = document.getElementById('camera-feed');
  const canvas = document.getElementById('scan-canvas');

  try {
    scanner = startScanner(video, canvas, (payloadBytes) => {
      if (!quickScanMode) {
        scannedPayloads.push(payloadBytes);
        updateScanCount();
      }
    });
  } catch (err) {
    document.getElementById('scan-status').textContent = `${t('cameraError')}: ${err.message}`;
  }
}

function updateScanCount() {
  document.getElementById('scan-count').textContent = scannedPayloads.length;

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
