import { parseFacePayload, verifyCrc } from './utils.js';

/**
 * Reassemble data from scanned face payloads.
 * facePayloads: array of Uint8Array, one per scanned face.
 * Returns { success, data, missingFaces }.
 */
export function decodeCubeCode(facePayloads) {
  const faces = new Map();

  for (const payload of facePayloads) {
    const { faceId, dataBytes } = parseFacePayload(payload);
    if (faceId >= 1 && faceId <= 6) {
      faces.set(faceId, dataBytes);
    }
  }

  const missingFaces = [];
  for (let i = 1; i <= 6; i++) {
    if (!faces.has(i)) {
      missingFaces.push(i);
    }
  }

  if (missingFaces.length > 0) {
    return { success: false, data: null, missingFaces };
  }

  // Concatenate in order
  const ordered = [];
  for (let i = 1; i <= 6; i++) {
    ordered.push(faces.get(i));
  }
  const fullBytes = concatBytes(ordered);

  // Parse: [version][type][content][crc16]
  if (fullBytes.length < 4) {
    return { success: false, data: null, missingFaces: [], error: 'Payload too short' };
  }

  const version = fullBytes[0];
  const dataType = fullBytes[1];
  const crcReceived = (fullBytes[fullBytes.length - 2] << 8) | fullBytes[fullBytes.length - 1];
  const content = fullBytes.slice(2, fullBytes.length - 2);

  if (!verifyCrc(content, crcReceived)) {
    return { success: false, data: null, missingFaces: [], error: 'CRC mismatch' };
  }

  const decoder = new TextDecoder();
  const text = decoder.decode(content);

  return { success: true, data: text, missingFaces: [], version, dataType };
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
