import { parseFacePayload, verifyCrc } from './utils.js';

/**
 * Reassemble data from scanned face payloads.
 * facePayloads: array of Uint8Array, one per scanned face.
 * numFaces: expected number of faces (1-6, default 6)
 * independent: if true, each face contains full data independently
 * Returns { success, data, missingFaces }.
 */
export function decodeCubeCode(facePayloads, numFaces = 6, independent = false) {
  const faces = new Map();

  for (const payload of facePayloads) {
    const { faceId, dataBytes } = parseFacePayload(payload);
    if (faceId >= 1 && faceId <= numFaces) {
      faces.set(faceId, dataBytes);
    }
  }

  // In independent mode, we only need one face to decode
  if (independent) {
    if (faces.size === 0) {
      return { success: false, data: null, missingFaces: [], error: 'No faces scanned' };
    }

    // Use the first available face
    const firstFace = faces.values().next().value;
    return parseIndependentPayload(firstFace);
  }

  const missingFaces = [];
  for (let i = 1; i <= numFaces; i++) {
    if (!faces.has(i)) {
      missingFaces.push(i);
    }
  }

  if (missingFaces.length > 0) {
    return { success: false, data: null, missingFaces };
  }

  // Concatenate in order
  const ordered = [];
  for (let i = 1; i <= numFaces; i++) {
    ordered.push(faces.get(i));
  }
  const fullBytes = concatBytes(ordered);

  return parseIndependentPayload(fullBytes);
}

function parseIndependentPayload(fullBytes) {
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
