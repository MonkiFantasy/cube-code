export function resetScannedPayloads(scannedPayloads) {
  scannedPayloads.length = 0;
}

export function replaceScannedPayloadBatch(scannedPayloads, payloadEntries) {
  resetScannedPayloads(scannedPayloads);
  const seenFaces = new Set();

  for (const [faceId, payload] of payloadEntries) {
    if (seenFaces.has(faceId)) continue;
    seenFaces.add(faceId);
    scannedPayloads.push(payload);
  }

  return scannedPayloads.length;
}

export function upsertScannedPayload(scannedPayloads, faceId, payload) {
  const index = scannedPayloads.findIndex((item) => extractFaceIdFromPayload(item) === faceId);
  if (index === -1) {
    scannedPayloads.push(payload);
    return 'added';
  }

  if (!payloadsEqual(scannedPayloads[index], payload)) {
    scannedPayloads[index] = payload;
    return 'replaced';
  }

  return 'unchanged';
}

export function extractFaceIdFromPayload(payloadBytes) {
  const bits = Array.from(payloadBytes)
    .map((b) => b.toString(2).padStart(8, '0'))
    .join('');
  return parseInt(bits.slice(0, 3), 2);
}

function payloadsEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
