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
