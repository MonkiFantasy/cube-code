import { describe, it, expect } from 'vitest';
import { decodeCubeCode } from '../src/decoder.js';
import { splitData, buildFacePayload, crc16 } from '../src/utils.js';

function buildProtocolPayload(text, numFaces = 6) {
  const content = new TextEncoder().encode(text);
  const crc = crc16(content);
  const fullPayload = new Uint8Array(2 + content.length + 2);
  fullPayload[0] = 1; // version
  fullPayload[1] = 0x00; // text
  fullPayload.set(content, 2);
  fullPayload[fullPayload.length - 2] = crc >> 8;
  fullPayload[fullPayload.length - 1] = crc & 0xFF;

  return splitData(fullPayload, numFaces).map((chunk, index) => buildFacePayload(index, chunk));
}

describe('decodeCubeCode protocol round-trip', () => {
  it('reassembles all six faces back into the original text', () => {
    const payloads = buildProtocolPayload('Hello Cube Code');
    const decoded = decodeCubeCode(payloads, 6);
    expect(decoded.success).toBe(true);
    expect(decoded.data).toBe('Hello Cube Code');
    expect(decoded.version).toBe(1);
    expect(decoded.dataType).toBe(0x00);
  });

  it('reassembles faces even when scanned out of order', () => {
    const payloads = buildProtocolPayload('out of order faces');
    const shuffled = [payloads[4], payloads[1], payloads[5], payloads[0], payloads[3], payloads[2]];
    const decoded = decodeCubeCode(shuffled, 6);
    expect(decoded.success).toBe(true);
    expect(decoded.data).toBe('out of order faces');
  });

  it('reports missing faces when not all required faces are present', () => {
    const payloads = buildProtocolPayload('missing one face');
    const decoded = decodeCubeCode(payloads.slice(0, 5), 6);
    expect(decoded.success).toBe(false);
    expect(decoded.missingFaces).toEqual([6]);
  });

  it('rejects tampered payloads with CRC mismatch', () => {
    const payloads = buildProtocolPayload('do not tamper');
    const tampered = payloads.map((p) => new Uint8Array(p));
    tampered[2][tampered[2].length - 1] ^= 0x01;

    const decoded = decodeCubeCode(tampered, 6);
    expect(decoded.success).toBe(false);
    expect(decoded.error).toBe('CRC mismatch');
  });

  it('preserves unicode and emoji text', () => {
    const text = '你好，魔方码 😀🚀';
    const payloads = buildProtocolPayload(text);
    const decoded = decodeCubeCode(payloads, 6);
    expect(decoded.success).toBe(true);
    expect(decoded.data).toBe(text);
  });
});
