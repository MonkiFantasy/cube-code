const NUM_FACES = 6;

/**
 * Split data into 6 chunks.
 * Each chunk gets a 3-bit face ID prepended (001–110).
 */
export function splitData(data) {
  const chunks = [];
  const chunkSize = Math.ceil(data.length / NUM_FACES);

  for (let i = 0; i < NUM_FACES; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, data.length);
    chunks.push(data.slice(start, end));
  }

  return chunks;
}

/**
 * Build the binary payload for one face:
 * [3-bit face ID][13-bit data length][data bytes]
 */
export function buildFacePayload(faceIndex, dataBytes) {
  const faceId = faceIndex + 1; // 1–6
  const idBits = faceId.toString(2).padStart(3, '0');
  const lenBits = dataBytes.length.toString(2).padStart(13, '0');
  const dataBits = bytesToBits(dataBytes);
  const combined = idBits + lenBits + dataBits;
  return bitsToBytes(combined);
}

/**
 * Parse a face payload: extract face ID and data bytes.
 */
export function parseFacePayload(payloadBytes) {
  const allBits = bytesToBits(payloadBytes);
  const faceId = parseInt(allBits.slice(0, 3), 2);
  const dataLen = parseInt(allBits.slice(3, 16), 2);
  const dataBits = allBits.slice(16, 16 + dataLen * 8);
  const dataBytes = bitsToBytes(dataBits);
  return { faceId, dataBytes };
}

/**
 * CRC-16/CCITT-FALSE
 */
export function crc16(data) {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i] << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xFFFF;
    }
  }
  return crc;
}

/**
 * Verify CRC: returns true if data's CRC matches expected.
 */
export function verifyCrc(dataBytes, expectedCrc) {
  return crc16(dataBytes) === expectedCrc;
}

export function bytesToBits(bytes) {
  let bits = '';
  for (const b of bytes) {
    bits += b.toString(2).padStart(8, '0');
  }
  return bits;
}

export function bitsToBytes(bits) {
  const padLen = (8 - (bits.length % 8)) % 8;
  bits = bits + '0'.repeat(padLen);
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}
