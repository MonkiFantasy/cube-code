import { describe, expect, it } from 'vitest';
import { replaceScannedPayloadBatch, resetScannedPayloads, upsertScannedPayload } from '../src/scan-state.js';

describe('scan state helpers', () => {
  it('replaces old uploaded scan payloads instead of merging with them', () => {
    const scannedPayloads = [new Uint8Array([1, 11]), new Uint8Array([2, 22])];
    const newFace1 = new Uint8Array([1, 99]);
    const newFace2 = new Uint8Array([2, 88]);

    const count = replaceScannedPayloadBatch(scannedPayloads, [
      [1, newFace1],
      [2, newFace2],
    ]);

    expect(count).toBe(2);
    expect(scannedPayloads).toEqual([newFace1, newFace2]);
  });

  it('deduplicates faces within a single uploaded scan result', () => {
    const scannedPayloads = [];
    const first = new Uint8Array([1, 1]);
    const duplicate = new Uint8Array([1, 2]);

    replaceScannedPayloadBatch(scannedPayloads, [
      [1, first],
      [1, duplicate],
    ]);

    expect(scannedPayloads).toEqual([first]);
  });

  it('upserts a scanned face payload so a corrected same-face scan can replace stale data', () => {
    const scannedPayloads = [];
    const face1Old = new Uint8Array([0b00100000, 1]);
    const face1New = new Uint8Array([0b00100000, 2]);

    expect(upsertScannedPayload(scannedPayloads, 1, face1Old)).toBe('added');
    expect(upsertScannedPayload(scannedPayloads, 1, face1Old)).toBe('unchanged');
    expect(upsertScannedPayload(scannedPayloads, 1, face1New)).toBe('replaced');
    expect(scannedPayloads).toEqual([face1New]);
  });

  it('clears payload state in place', () => {
    const scannedPayloads = [new Uint8Array([1])];
    resetScannedPayloads(scannedPayloads);
    expect(scannedPayloads).toEqual([]);
  });
});
