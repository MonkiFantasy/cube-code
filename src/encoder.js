import QRCode from 'qrcode';
import { splitData, buildFacePayload, crc16 } from './utils.js';
import { bytesToBase64 } from './encoder-utils.js';

const PROTOCOL_VERSION = 1;
const DATA_TYPE_TEXT = 0x00;

// Rubik's cube colors for each face (face 1-6)
// dark = module color, light = background color
const FACE_COLORS = [
  { dark: '#B71234', light: '#ffffff' }, // face1: red
  { dark: '#CC7700', light: '#ffffff' }, // face2: orange
  { dark: '#505050', light: '#ffffff' }, // face3: dark gray
  { dark: '#B8860B', light: '#ffffff' }, // face4: yellow
  { dark: '#009B48', light: '#ffffff' }, // face5: green
  { dark: '#0046AD', light: '#ffffff' }, // face6: blue
];

// Inverted: swap dark/light — white modules on black background
const FACE_COLORS_INVERTED = [
  { dark: '#ffffff', light: '#000000' },
  { dark: '#ffffff', light: '#000000' },
  { dark: '#ffffff', light: '#000000' },
  { dark: '#ffffff', light: '#000000' },
  { dark: '#ffffff', light: '#000000' },
  { dark: '#ffffff', light: '#000000' },
];

// Inverted colorful: white modules on colored backgrounds
const FACE_COLORS_INVERTED_COLORFUL = [
  { dark: '#ffffff', light: '#B71234' }, // face1: white on red
  { dark: '#ffffff', light: '#CC7700' }, // face2: white on orange
  { dark: '#ffffff', light: '#505050' }, // face3: white on gray
  { dark: '#ffffff', light: '#B8860B' }, // face4: white on yellow
  { dark: '#ffffff', light: '#009B48' }, // face5: white on green
  { dark: '#ffffff', light: '#0046AD' }, // face6: white on blue
];

// Gene code mode colors (tech/cyber aesthetic)
const FACE_COLORS_GENE = [
  { dark: '#00ff88', light: '#001122' }, // face1: neon green on dark blue
  { dark: '#00ccff', light: '#001122' }, // face2: cyan on dark blue
  { dark: '#ff00ff', light: '#001122' }, // face3: magenta on dark blue
  { dark: '#ffff00', light: '#001122' }, // face4: yellow on dark blue
  { dark: '#ff6600', light: '#001122' }, // face5: orange on dark blue
  { dark: '#ff0066', light: '#001122' }, // face6: pink on dark blue
];

/**
 * Encode data into QR code canvases with Rubik's cube colors.
 * Returns an array of { faceId, canvas } objects.
 * @param {string} data - The data to encode
 * @param {Object} options
 * @param {string} options.mode - Color mode
 * @param {HTMLImageElement|HTMLCanvasElement} options.icon - Optional icon to overlay
 * @param {number} options.numFaces - Number of faces (1-6, default 6)
 * @param {boolean} options.independent - If true, each QR contains full data independently
 * @param {string} options.errorLevel - Error correction level: 'L', 'M', 'Q', 'H' (default 'M')
 */
export async function encodeToCubeCode(data, { mode = 'colorful', icon = null, numFaces = 6, independent = false, errorLevel = 'M' } = {}) {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);

  const versionByte = new Uint8Array([PROTOCOL_VERSION]);
  const typeByte = new Uint8Array([DATA_TYPE_TEXT]);
  const crc = crc16(dataBytes);
  const crcBytes = new Uint8Array([crc >> 8, crc & 0xFF]);

  const fullPayload = concatBytes([versionByte, typeByte, dataBytes, crcBytes]);

  // In independent mode, each face gets the full payload
  const chunks = independent
    ? Array(numFaces).fill(fullPayload)
    : splitData(fullPayload, numFaces);

  const colorMap = mode === 'inverted' ? FACE_COLORS_INVERTED
    : mode === 'inverted-colorful' ? FACE_COLORS_INVERTED_COLORFUL
    : mode === 'gene' ? FACE_COLORS_GENE
    : FACE_COLORS;

  // Use error correction level H when icon is present or gene mode to allow center overlay
  // But allow user override via errorLevel parameter
  const finalErrorLevel = (icon || mode === 'gene') ? 'H' : errorLevel;

  const results = [];
  for (let i = 0; i < numFaces; i++) {
    const facePayload = buildFacePayload(i, chunks[i]);
    const base64 = bytesToBase64(facePayload);
    const canvas = document.createElement('canvas');

    const opts = {
      errorCorrectionLevel: finalErrorLevel,
      margin: 2,
      width: 256,
    };

    if (mode !== 'bw') {
      opts.color = colorMap[i];
    }

    await QRCode.toCanvas(canvas, base64, opts);

    // Overlay icon on center if provided
    if (icon) {
      overlayIcon(canvas, icon);
    }

    // Add gene code center pattern if in gene mode
    if (mode === 'gene') {
      overlayGenePattern(canvas, i);
    }

    results.push({ faceId: i + 1, canvas });
  }

  return results;
}

/**
 * Overlay an icon image on the center of a QR code canvas.
 * @param {HTMLCanvasElement} canvas - The QR code canvas
 * @param {HTMLImageElement|HTMLCanvasElement} icon - The icon to overlay
 */
function overlayIcon(canvas, icon) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const iconSize = size * 0.25; // Icon is 25% of QR code size
  const x = (size - iconSize) / 2;
  const y = (size - iconSize) / 2;

  // Draw white background circle for icon
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, iconSize / 2 + 4, 0, Math.PI * 2);
  ctx.fill();

  // Draw icon
  ctx.drawImage(icon, x, y, iconSize, iconSize);
}

/**
 * Overlay a gene code pattern on the center of a QR code canvas.
 * Creates a tech/cyber aesthetic with geometric shapes.
 * @param {HTMLCanvasElement} canvas - The QR code canvas
 * @param {number} faceIndex - The face index (0-5) for color variation
 */
function overlayGenePattern(canvas, faceIndex) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const centerX = size / 2;
  const centerY = size / 2;
  const patternSize = size * 0.3; // Pattern is 30% of QR code size

  // Clear center area
  ctx.fillStyle = '#001122';
  ctx.beginPath();
  ctx.arc(centerX, centerY, patternSize / 2 + 4, 0, Math.PI * 2);
  ctx.fill();

  // Draw hexagon pattern
  const colors = ['#00ff88', '#00ccff', '#ff00ff', '#ffff00', '#ff6600', '#ff0066'];
  const color = colors[faceIndex % colors.length];

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 - 30) * Math.PI / 180;
    const x = centerX + (patternSize / 2) * Math.cos(angle);
    const y = centerY + (patternSize / 2) * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  // Draw inner hexagon
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 - 30) * Math.PI / 180;
    const x = centerX + (patternSize / 4) * Math.cos(angle);
    const y = centerY + (patternSize / 4) * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  // Draw connecting lines
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 - 30) * Math.PI / 180;
    const x1 = centerX + (patternSize / 4) * Math.cos(angle);
    const y1 = centerY + (patternSize / 4) * Math.sin(angle);
    const x2 = centerX + (patternSize / 2) * Math.cos(angle);
    const y2 = centerY + (patternSize / 2) * Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Draw center dot
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
  ctx.fill();
}

export { FACE_COLORS };

function concatBytes(arrays) {
  const totalLen = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

