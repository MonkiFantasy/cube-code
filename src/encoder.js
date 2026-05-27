import QRCode from 'qrcode';
import { splitData, buildFacePayload, crc16 } from './utils.js';
import { bytesToBase64 } from './encoder-utils.js';

const PROTOCOL_VERSION = 1;
const DATA_TYPE_TEXT = 0x00;

// Rubik's cube colors for each face (face 1-6)
const FACE_COLORS = [
  { dark: '#B71234', light: '#ffffff' }, // face1: red
  { dark: '#FF5800', light: '#ffffff' }, // face2: orange
  { dark: '#505050', light: '#ffffff' }, // face3: white (dark gray for visibility)
  { dark: '#FFD500', light: '#ffffff' }, // face4: yellow
  { dark: '#009B48', light: '#ffffff' }, // face5: green
  { dark: '#0046AD', light: '#ffffff' }, // face6: blue
];

/**
 * Encode data into 6 QR code canvases with Rubik's cube colors.
 * Returns an array of { faceId, canvas } objects.
 */
export async function encodeToCubeCode(data, { colorful = true } = {}) {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);

  const versionByte = new Uint8Array([PROTOCOL_VERSION]);
  const typeByte = new Uint8Array([DATA_TYPE_TEXT]);
  const crc = crc16(dataBytes);
  const crcBytes = new Uint8Array([crc >> 8, crc & 0xFF]);

  const fullPayload = concatBytes([versionByte, typeByte, dataBytes, crcBytes]);
  const chunks = splitData(fullPayload);

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

    if (colorful) {
      opts.color = FACE_COLORS[i];
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

