import { encodeToCubeCode } from './encoder.js';
import { decodeCubeCode } from './decoder.js';
import { startScanner } from './scanner.js';
import { createCube } from './cube3d.js';
import { t, toggleLang } from './i18n/index.js';

let cube3d = null;

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
btnEncode.addEventListener('click', async () => {
  const input = document.getElementById('input-data').value.trim();
  if (!input) return;

  const output = document.getElementById('qr-output');
  const cubeContainer = document.getElementById('cube-container');
  const cubeEl = document.getElementById('cube-3d');
  output.innerHTML = t('generating');
  cubeContainer.style.display = 'none';

  try {
    const results = await encodeToCubeCode(input);
    output.innerHTML = '';

    // Dispose old 3D cube
    if (cube3d) {
      cube3d.dispose();
      cube3d = null;
    }

    const qrCanvases = [];
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

    // Render 3D cube
    cubeContainer.style.display = 'block';
    cubeEl.innerHTML = '';
    cube3d = createCube(cubeEl, qrCanvases);
  } catch (err) {
    output.innerHTML = `${t('error')}: ${err.message}`;
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
const decodeSection = document.getElementById('decode');

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
      scannedPayloads.push(payloadBytes);
      updateScanCount();
    });
  } catch (err) {
    document.getElementById('scan-status').textContent = `${t('cameraError')}: ${err.message}`;
  }
}

function updateScanCount() {
  document.getElementById('scan-count').textContent = scannedPayloads.length;

  for (const payload of scannedPayloads) {
    const allBits = Array.from(payload)
      .map((b) => b.toString(2).padStart(8, '0'))
      .join('');
    const faceId = parseInt(allBits.slice(0, 3), 2);
    const dot = document.querySelector(`.face-dot[data-face="${faceId}"]`);
    if (dot) dot.classList.add('scanned');
  }
}

btnDecode.addEventListener('click', () => {
  const output = document.getElementById('decoded-output');

  if (scannedPayloads.length === 0) {
    output.textContent = t('noFaces');
    return;
  }

  const result = decodeCubeCode(scannedPayloads);

  if (result.success) {
    output.textContent = result.data;
  } else if (result.missingFaces.length > 0) {
    output.textContent = `${t('missingFaces')}: ${result.missingFaces.join(', ')}`;
  } else {
    output.textContent = `${t('error')}: ${result.error}`;
  }
});
