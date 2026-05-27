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

/**
 * Encode data into 6 QR code canvases with Rubik's cube colors.
 * Returns an array of { faceId, canvas } objects.
 */
export async function encodeToCubeCode(data, { mode = 'colorful' } = {}) {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);

  const versionByte = new Uint8Array([PROTOCOL_VERSION]);
  const typeByte = new Uint8Array([DATA_TYPE_TEXT]);
  const crc = crc16(dataBytes);
  const crcBytes = new Uint8Array([crc >> 8, crc & 0xFF]);

  const fullPayload = concatBytes([versionByte, typeByte, dataBytes, crcBytes]);
  const chunks = splitData(fullPayload);

  const colorMap = mode === 'inverted' ? FACE_COLORS_INVERTED
    : mode === 'inverted-colorful' ? FACE_COLORS_INVERTED_COLORFUL
    : FACE_COLORS;

  const results = [];
  for (let i = 0; i < 6; i++) {
    const facePayload = buildFacePayload(i, chunks[i]);
    const base64 = bytesToBase64(facePayload);
    const canvas = document.createElement('canvas');

    const opts = {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 256,
    };

    if (mode !== 'bw') {
      opts.color = colorMap[i];
    }

    await QRCode.toCanvas(canvas, base64, opts);
    results.push({ faceId: i + 1, canvas });
  }

  return results;
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

