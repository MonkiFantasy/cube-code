import QRCode from 'qrcode';
import { splitData, buildFacePayload, crc16 } from './utils.js';
import { bytesToBase64 } from './encoder-utils.js';

const PROTOCOL_VERSION = 1;
const DATA_TYPE_TEXT = 0x00;

/**
 * Encode data into 6 QR code canvases.
 * Returns an array of { faceId, canvas } objects.
 */
export async function encodeToCubeCode(data) {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);

  // Build full payload: [version][type][content][crc16]
  const versionByte = new Uint8Array([PROTOCOL_VERSION]);
  const typeByte = new Uint8Array([DATA_TYPE_TEXT]);
  const crc = crc16(dataBytes);
  const crcBytes = new Uint8Array([crc >> 8, crc & 0xFF]);

  const fullPayload = concatBytes([versionByte, typeByte, dataBytes, crcBytes]);

  // Split into 6 chunks
  const chunks = splitData(fullPayload);

  // Generate QR codes
  const results = [];
  for (let i = 0; i < 6; i++) {
    const facePayload = buildFacePayload(i, chunks[i]);
    const base64 = bytesToBase64(facePayload);
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, base64, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 256,
    });
    results.push({ faceId: i + 1, canvas });
  }

  return results;
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

