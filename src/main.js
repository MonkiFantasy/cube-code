import { encodeToCubeCode } from './encoder.js';
import { decodeCubeCode } from './decoder.js';
import { startScanner } from './scanner.js';
import { base64ToBytes } from './encoder-utils.js';

// Tab switching
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

// Encode
const btnEncode = document.getElementById('btn-encode');
btnEncode.addEventListener('click', async () => {
  const input = document.getElementById('input-data').value.trim();
  if (!input) return;

  const output = document.getElementById('qr-output');
  output.innerHTML = 'Generating...';

  try {
    const results = await encodeToCubeCode(input);
    output.innerHTML = '';
    for (const { faceId, canvas } of results) {
      const cell = document.createElement('div');
      cell.className = 'qr-cell';
      cell.appendChild(canvas);
      const label = document.createElement('div');
      label.className = 'face-label';
      label.textContent = `Face ${faceId}`;
      cell.appendChild(label);
      output.appendChild(cell);
    }
  } catch (err) {
    output.innerHTML = `Error: ${err.message}`;
  }
});

// Decode
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

// Start camera when decode tab is shown
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
    document.getElementById('scan-status').textContent = `Camera error: ${err.message}`;
  }
}

function updateScanCount() {
  document.getElementById('scan-count').textContent = scannedPayloads.length;

  // Mark scanned face dots
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
    output.textContent = 'No faces scanned yet.';
    return;
  }

  const result = decodeCubeCode(scannedPayloads);

  if (result.success) {
    output.textContent = result.data;
  } else if (result.missingFaces.length > 0) {
    output.textContent = `Missing faces: ${result.missingFaces.join(', ')}`;
  } else {
    output.textContent = `Error: ${result.error}`;
  }
});
