import { beforeAll, describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { scanCrossNet, scanPlain } from '../src/quickscan.js';
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


function renderSyntheticStickerPack(images) {
  const scale = 6;
  const totalWmm = 197;
  const totalHmm = 151;
  const width = totalWmm * scale;
  const height = totalHmm * scale;
  const out = new Uint8ClampedArray(width * height * 4);
  out.fill(255);
  const marginX = 8 * scale;
  const marginY = 8 * scale;
  const faceW = 57 * scale;
  const faceH = 57 * scale;
  const spacingX = 7 * scale;
  const blockH = 64 * scale;
  const spacingY = 7 * scale;
  const gap = Math.round(1.2 * scale);
  const stickerW = Math.floor((faceW - gap * 2) / 3);
  const stickerH = Math.floor((faceH - gap * 2) / 3);

  images.forEach((image, face) => {
    const faceCol = face % 3;
    const faceRow = Math.floor(face / 3);
    const faceX = marginX + faceCol * (faceW + spacingX);
    const faceY = marginY + faceRow * (blockH + spacingY);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const sx = Math.floor((image.width * col) / 3);
        const sy = Math.floor((image.height * row) / 3);
        const sr = Math.floor((image.width * (col + 1)) / 3);
        const sb = Math.floor((image.height * (row + 1)) / 3);
        resampleInto(image, sx, sy, sr - sx, sb - sy, out, width, height, faceX + col * (stickerW + gap), faceY + row * (stickerH + gap), stickerW, stickerH);
      }
    }
  });

  return { data: out, width, height };
}

function resampleInto(srcImage, sx, sy, sw, sh, dst, dstW, dstH, dx, dy, dw, dh) {
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const px = Math.min(srcImage.width - 1, Math.floor(sx + ((x + 0.5) / dw) * sw));
      const py = Math.min(srcImage.height - 1, Math.floor(sy + ((y + 0.5) / dh) * sh));
      const srcIdx = (py * srcImage.width + px) * 4;
      const outX = Math.min(dstW - 1, Math.max(0, Math.floor(dx + x)));
      const outY = Math.min(dstH - 1, Math.max(0, Math.floor(dy + y)));
      const dstIdx = (outY * dstW + outX) * 4;
      dst[dstIdx] = srcImage.data[srcIdx];
      dst[dstIdx + 1] = srcImage.data[srcIdx + 1];
      dst[dstIdx + 2] = srcImage.data[srcIdx + 2];
      dst[dstIdx + 3] = 255;
    }
  }
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

  it('scans an exported six-face sticker sheet through scanCrossNet fallback', () => {
    const text = 'scan full printable sticker pack';
    const sheet = renderSyntheticStickerPack(buildCubeQrImages(text));
    const result = scanCrossNet(sheet);

    expect(result).toMatchObject({ found: 6, layout: 'sticker-pack' });
    expect(decodeCubeCode([...result.payloads.values()], 6)).toMatchObject({
      success: true,
      dataType: DATA_TYPE_TEXT,
      data: text,
    });
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
