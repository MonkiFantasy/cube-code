import { describe, it, expect } from 'vitest';
import {
  splitData,
  buildFacePayload,
  parseFacePayload,
  crc16,
  verifyCrc,
  bytesToBits,
  bitsToBytes,
} from '../src/utils.js';

describe('splitData', () => {
  it('splits data into 6 chunks', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const chunks = splitData(data);
    expect(chunks).toHaveLength(6);
    expect(chunks[0]).toEqual(new Uint8Array([1, 2]));
    expect(chunks[5]).toEqual(new Uint8Array([11, 12]));
  });

  it('handles data shorter than 6 bytes', () => {
    const data = new Uint8Array([10, 20]);
    const chunks = splitData(data);
    expect(chunks).toHaveLength(6);
    expect(chunks[0]).toEqual(new Uint8Array([10]));
    expect(chunks[1]).toEqual(new Uint8Array([20]));
    expect(chunks[2]).toEqual(new Uint8Array([]));
  });
});

describe('buildFacePayload / parseFacePayload', () => {
  it('round-trips face ID and data', () => {
    const data = new Uint8Array([0xAB, 0xCD, 0xEF]);
    const payload = buildFacePayload(2, data); // face 3 (index 2)
    const { faceId, dataBytes } = parseFacePayload(payload);
    expect(faceId).toBe(3);
    expect(dataBytes).toEqual(data);
  });

  it('handles face 1 (index 0)', () => {
    const data = new Uint8Array([42]);
    const payload = buildFacePayload(0, data);
    const { faceId, dataBytes } = parseFacePayload(payload);
    expect(faceId).toBe(1);
    expect(dataBytes).toEqual(data);
  });

  it('handles face 6 (index 5)', () => {
    const data = new Uint8Array([0xFF]);
    const payload = buildFacePayload(5, data);
    const { faceId, dataBytes } = parseFacePayload(payload);
    expect(faceId).toBe(6);
    expect(dataBytes).toEqual(data);
  });

  it('handles empty data', () => {
    const data = new Uint8Array([]);
    const payload = buildFacePayload(0, data);
    const { faceId, dataBytes } = parseFacePayload(payload);
    expect(faceId).toBe(1);
    expect(dataBytes).toEqual(data);
  });
});

describe('crc16', () => {
  it('computes CRC for known input', () => {
    const data = new TextEncoder().encode('Hello');
    const crc = crc16(data);
    expect(crc).toBeGreaterThan(0);
    expect(crc).toBeLessThan(0xFFFF);
  });

  it('verifyCrc returns true for matching data', () => {
    const data = new TextEncoder().encode('Test data');
    const crc = crc16(data);
    expect(verifyCrc(data, crc)).toBe(true);
  });

  it('verifyCrc returns false for tampered data', () => {
    const data = new TextEncoder().encode('Test data');
    const crc = crc16(data);
    data[0] ^= 0xFF;
    expect(verifyCrc(data, crc)).toBe(false);
  });
});

describe('bits/bytes conversion', () => {
  it('converts bytes to bits and back', () => {
    const original = new Uint8Array([0xAB, 0xCD]);
    const bits = bytesToBits(original);
    expect(bits).toBe('1010101111001101');
    const restored = bitsToBytes(bits);
    expect(restored).toEqual(original);
  });

  it('handles empty input', () => {
    expect(bytesToBits(new Uint8Array([]))).toBe('');
    expect(bitsToBytes('')).toEqual(new Uint8Array([]));
  });
});
