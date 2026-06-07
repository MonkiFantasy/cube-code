import { beforeAll, describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { scanPlain } from '../src/quickscan.js';
import { composeStickers, splitImageIntoStickers } from '../src/sticker-pack.js';
import { DATA_TYPE_TEXT, decodeCubeCode } from '../src/decoder.js';
import { bytesToBase64 } from '../src/encoder-utils.js';
import { buildFacePayload, crc16, splitData } from '../src/utils.js';

beforeAll(() => {
  globalThis.HTMLCanvasElement = globalThis.HTMLCanvasElement || class HTMLCanvasElement {};
  globalThis.ImageData = globalThis.ImageData || class ImageData {
    constructor(data, width, height) {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  };
});

function renderQrImage(data, { scale = 9, margin = 4, errorCorrectionLevel = 'M' } = {}) {
  const qr = QRCode.create(data, { errorCorrectionLevel });
  const moduleCount = qr.modules.size;
  const size = (moduleCount + margin * 2) * scale;
  const rgba = new Uint8ClampedArray(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const mx = Math.floor(x / scale) - margin;
      const my = Math.floor(y / scale) - margin;
      const isDark = mx >= 0 && my >= 0 && mx < moduleCount && my < moduleCount
        ? qr.modules.data[my * moduleCount + mx]
        : false;
      const color = isDark ? 0 : 255;
      const idx = (y * size + x) * 4;
      rgba[idx] = color;
      rgba[idx + 1] = color;
      rgba[idx + 2] = color;
      rgba[idx + 3] = 255;
    }
  }

  return { data: rgba, width: size, height: size };
}

function readQr(image) {
  return jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
}

function reversedCopy(items) {
  return [...items].reverse();
}



function concatBytes(arrays) {
  const totalLen = arrays.reduce((sum, item) => sum + item.length, 0);
  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const item of arrays) {
    out.set(item, offset);
    offset += item.length;
  }
  return out;
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function buildCubeQrImages(data) {
  const dataBytes = new TextEncoder().encode(data);
  const crc = crc16(dataBytes);
  const fullPayload = concatBytes([
    new Uint8Array([1]),
    new Uint8Array([DATA_TYPE_TEXT]),
    dataBytes,
    new Uint8Array([crc >> 8, crc & 0xff]),
  ]);

  return splitData(fullPayload, 6).map((chunk, index) => {
    const qrText = bytesToBase64(buildFacePayload(index, chunk));
    return renderQrImage(qrText, { errorCorrectionLevel: 'M' });
  });
}

describe('sticker-pack QR reconstruction', () => {
  it('splits one QR face into 3x3 stickers and restores a jsQR-readable image', () => {
    const text = 'cube unlock sticker face';
    const source = renderQrImage(text);
    const pack = splitImageIntoStickers(source, { rows: 3, cols: 3 });

    expect(pack.stickers).toHaveLength(9);
    expect(pack.stickers.map((sticker) => [sticker.row, sticker.col])).toEqual([
      [0, 0], [0, 1], [0, 2],
      [1, 0], [1, 1], [1, 2],
      [2, 0], [2, 1], [2, 2],
    ]);

    // Array order may be scrambled while the cube is unsolved; recomposition
    // uses each sticker's solved row/col coordinate.
    const restored = composeStickers(reversedCopy(pack.stickers), { rows: 3, cols: 3 });

    expect(restored.width).toBe(source.width);
    expect(restored.height).toBe(source.height);
    expect(restored.data).toEqual(source.data);
    expect(readQr(restored)?.data).toBe(text);
  });

  it('restored sticker face is recognized by existing scanPlain upload path', () => {
    const text = 'scanPlain restored 3x3 QR sticker face';
    const source = renderQrImage(text, { errorCorrectionLevel: 'Q' });
    const { stickers } = splitImageIntoStickers(source, { rows: 3, cols: 3 });
    const restored = composeStickers(reversedCopy(stickers), { rows: 3, cols: 3 });

    expect(scanPlain(restored)).toMatchObject({ found: true, data: text });
  });

  it('decodes a full six-face cube code after every face is cut into restored 3x3 stickers', () => {
    const text = 'restore all six cube sticker faces';
    const restoredFaces = buildCubeQrImages(text).map((source) => {
      const { stickers } = splitImageIntoStickers(source, { rows: 3, cols: 3 });
      return composeStickers(reversedCopy(stickers), { rows: 3, cols: 3 });
    });

    const payloads = restoredFaces.map((image, index) => {
      const code = readQr(image);
      expect(code?.data, `restored face ${index + 1} should scan`).toBeTruthy();
      return base64ToBytes(code.data);
    });

    expect(decodeCubeCode(payloads, 6)).toMatchObject({
      success: true,
      dataType: DATA_TYPE_TEXT,
      data: text,
    });
  });
});
