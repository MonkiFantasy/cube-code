import QRCode from 'qrcode';
import { splitData, buildFacePayload, crc16 } from './utils.js';
import { bytesToBase64 } from './encoder-utils.js';
import { isSafeUrlOrDeepLink } from './url-utils.js';

const PROTOCOL_VERSION = 1;
export const DATA_TYPE_TEXT = 0x00;
export const DATA_TYPE_URL = 0x02;

// Rubik's cube colors for each face (face 1-6)
// dark = module color, light = background color
const FACE_COLORS = [
  { dark: '#B71234', light: '#ffffff' }, // face1: red
  { dark: '#CC7700', light: '#ffffff' }, // face2: orange
  { dark: '#505050', light: '#ffffff' }, // face3: dark gray
  { dark: '#6B4F00', light: '#ffffff' }, // face4: scan-safe amber
  { dark: '#009B48', light: '#ffffff' }, // face5: green
  { dark: '#002B6B', light: '#ffffff' }, // face6: scan-safe blue
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
  // Keep backgrounds intentionally dark: white-on-bright colors looks nice
  // but is unreliable for camera decoders. These hues preserve the theme
  // while keeping enough luminance contrast for jsQR/phone scanners.
  { dark: '#ffffff', light: '#400000' }, // face1: white on deep red
  { dark: '#ffffff', light: '#401000' }, // face2: white on deep orange
  { dark: '#ffffff', light: '#101010' }, // face3: white on black gray
  { dark: '#ffffff', light: '#281800' }, // face4: white on deep amber
  { dark: '#ffffff', light: '#002000' }, // face5: white on deep green
  { dark: '#ffffff', light: '#001030' }, // face6: white on deep blue
];

const GENE_QR_COLORS = {
  // 贪：深紫琉璃；嗔：朱红琥珀；痴：蓝绿色青玉
  purple: { dark: '#7C2DFF', light: '#ffffff' },
  red: { dark: '#E7352A', light: '#ffffff' },
  blue: { dark: '#0F766E', light: '#ffffff' },
};

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
 * @param {string} options.geneColor - Gene material color: purple/red/blue
 * @param {HTMLImageElement|HTMLCanvasElement} options.emptyFaceImage - Optional image for unused independent faces
 */
export async function encodeToCubeCode(data, { mode = 'colorful', icon = null, numFaces = 6, independent = false, errorLevel = 'M', geneColor = 'purple', emptyFaceImage = null } = {}) {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);
  const dataType = detectDataType(data);

  const versionByte = new Uint8Array([PROTOCOL_VERSION]);
  const typeByte = new Uint8Array([dataType]);
  const crc = crc16(dataBytes);
  const crcBytes = new Uint8Array([crc >> 8, crc & 0xFF]);

  const fullPayload = concatBytes([versionByte, typeByte, dataBytes, crcBytes]);

  const chunks = splitData(fullPayload, numFaces);

  const selectedGeneColor = GENE_QR_COLORS[geneColor] || GENE_QR_COLORS.purple;
  const geneColorMap = Array(6).fill(selectedGeneColor);

  const colorMap = mode === 'inverted' ? FACE_COLORS_INVERTED
    : mode === 'inverted-colorful' ? FACE_COLORS_INVERTED_COLORFUL
    : mode === 'gene' ? geneColorMap
    : FACE_COLORS;

  // Use error correction level H when icon is present to allow center overlay.
  // But allow user override via errorLevel parameter
  const finalErrorLevel = icon ? 'H' : errorLevel;

  const results = [];
  const totalFaces = independent ? 6 : numFaces;
  for (let i = 0; i < totalFaces; i++) {
    const canvas = document.createElement('canvas');
    const isEmptyIndependentFace = independent && i >= numFaces;

    if (isEmptyIndependentFace) {
      drawEmptyFace(canvas, emptyFaceImage);
      results.push({ faceId: i + 1, canvas });
      continue;
    }

    const opts = {
      errorCorrectionLevel: finalErrorLevel,
      margin: 2,
      width: 256,
    };

    if (mode !== 'bw') {
      opts.color = colorMap[i];
    }

    // Independent mode intentionally creates ordinary QR codes containing the
    // raw user text, so any phone scanner can read a single face directly.
    // Non-independent mode keeps the Cube Code protocol for face IDs, splitting
    // and CRC-protected reassembly.
    const qrData = independent
      ? data
      : bytesToBase64(buildFacePayload(i, chunks[i]));

    await QRCode.toCanvas(canvas, qrData, opts);

    // Overlay icon on center if provided
    if (icon) {
      overlayIcon(canvas, icon);
    }

    results.push({ faceId: i + 1, canvas });
  }

  return results;
}

function drawEmptyFace(canvas, image) {
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!image) return;

  const srcW = image.naturalWidth || image.width;
  const srcH = image.naturalHeight || image.height;
  const scale = Math.max(canvas.width / srcW, canvas.height / srcH);
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  ctx.drawImage(image, (canvas.width - drawW) / 2, (canvas.height - drawH) / 2, drawW, drawH);
}

/**
 * Overlay an icon image on the center of a QR code canvas.
 * @param {HTMLCanvasElement} canvas - The QR code canvas
 * @param {HTMLImageElement|HTMLCanvasElement} icon - The icon to overlay
 */
function overlayIcon(canvas, icon) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const iconSize = size * 0.16; // Keep icon small enough for reliable QR scanning
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

export { FACE_COLORS, FACE_COLORS_INVERTED, FACE_COLORS_INVERTED_COLORFUL, GENE_QR_COLORS };

export function detectDataType(data) {
  return isSafeUrlOrDeepLink(data) ? DATA_TYPE_URL : DATA_TYPE_TEXT;
}

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
