import { describe, expect, it, beforeAll } from 'vitest';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { scanPlain } from '../src/quickscan.js';
import { DATA_TYPE_URL, decodeCubeCode } from '../src/decoder.js';
import {
  FACE_COLORS,
  FACE_COLORS_INVERTED,
  FACE_COLORS_INVERTED_COLORFUL,
  GENE_QR_COLORS,
  analyzeEncodeCapacity,
  detectDataType,
} from '../src/encoder.js';
import { bytesToBase64 } from '../src/encoder-utils.js';
import { buildFacePayload, crc16, splitData } from '../src/utils.js';

const PROTOCOL_VERSION = 1;
const DATA_TYPE_TEXT = 0x00;

beforeAll(() => {
  // quickscan.js supports browser canvases, but for these tests we pass a plain
  // ImageData-like object. Define the browser globals it checks for.
  globalThis.HTMLCanvasElement = globalThis.HTMLCanvasElement || class HTMLCanvasElement {};
  globalThis.ImageData = globalThis.ImageData || class ImageData {
    constructor(data, width, height) {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  };
});

function hexToRgb(hex) {
  let value = hex.replace('#', '');
  if (value.length === 3) {
    value = value.split('').map((ch) => ch + ch).join('');
  }
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function renderQrImage(data, {
  dark = '#000000',
  light = '#ffffff',
  errorCorrectionLevel = 'M',
  scale = 10,
  margin = 4,
  icon = false,
} = {}) {
  const qr = QRCode.create(data, { errorCorrectionLevel });
  const moduleCount = qr.modules.size;
  const size = (moduleCount + margin * 2) * scale;
  const rgba = new Uint8ClampedArray(size * size * 4);
  const darkRgb = hexToRgb(dark);
  const lightRgb = hexToRgb(light);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const mx = Math.floor(x / scale) - margin;
      const my = Math.floor(y / scale) - margin;
      const isModule = mx >= 0 && my >= 0 && mx < moduleCount && my < moduleCount
        ? qr.modules.data[my * moduleCount + mx]
        : false;
      const color = isModule ? darkRgb : lightRgb;
      const idx = (y * size + x) * 4;
      rgba[idx] = color[0];
      rgba[idx + 1] = color[1];
      rgba[idx + 2] = color[2];
      rgba[idx + 3] = 255;
    }
  }

  if (icon) {
    drawSyntheticIcon(rgba, size);
  }

  return { data: rgba, width: size, height: size };
}

function drawSyntheticIcon(rgba, size) {
  const iconSize = Math.floor(size * 0.16);
  const pad = Math.floor(size * 0.025);
  const start = Math.floor((size - iconSize) / 2);
  const end = start + iconSize;
  const bgStart = Math.max(0, start - pad);
  const bgEnd = Math.min(size, end + pad);

  for (let y = bgStart; y < bgEnd; y++) {
    for (let x = bgStart; x < bgEnd; x++) {
      const idx = (y * size + x) * 4;
      rgba[idx] = 255;
      rgba[idx + 1] = 255;
      rgba[idx + 2] = 255;
      rgba[idx + 3] = 255;
    }
  }

  for (let y = start; y < end; y++) {
    for (let x = start; x < end; x++) {
      const idx = (y * size + x) * 4;
      rgba[idx] = 79;
      rgba[idx + 1] = 70;
      rgba[idx + 2] = 229;
      rgba[idx + 3] = 255;
    }
  }
}

function readQr(image) {
  return jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
}

function buildCubeQrImages(data, {
  palette = FACE_COLORS,
  errorCorrectionLevel = 'M',
  icon = false,
} = {}) {
  const dataBytes = new TextEncoder().encode(data);
  const crc = crc16(dataBytes);
  const fullPayload = concatBytes([
    new Uint8Array([PROTOCOL_VERSION]),
    new Uint8Array([detectDataType(data)]),
    dataBytes,
    new Uint8Array([crc >> 8, crc & 0xff]),
  ]);

  return splitData(fullPayload, 6).map((chunk, index) => {
    const qrText = bytesToBase64(buildFacePayload(index, chunk));
    const colors = palette[index] || { dark: '#000000', light: '#ffffff' };
    return renderQrImage(qrText, { ...colors, errorCorrectionLevel, icon });
  });
}

function decodeCubeImages(images) {
  const payloads = images.map((image, index) => {
    const code = readQr(image);
    expect(code?.data, `face ${index + 1} should decode`).toBeTruthy();
    return base64ToBytes(code.data);
  });
  return decodeCubeCode(payloads, 6);
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
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

describe('real QR image scanning', () => {
  it('decodes generated cube QR images back into text', () => {
    const decoded = decodeCubeImages(buildCubeQrImages('真实 QR round-trip'));
    expect(decoded).toMatchObject({ success: true, dataType: DATA_TYPE_TEXT, data: '真实 QR round-trip' });
  });

  it('decodes URL/deep-link cube QR images as URL payloads', () => {
    const url = 'myapp://open/cube?id=42';
    const decoded = decodeCubeImages(buildCubeQrImages(url));
    expect(decoded).toMatchObject({ success: true, dataType: DATA_TYPE_URL, data: url });
  });

  it('scans ordinary QR images through the plain upload path', () => {
    const image = renderQrImage('普通二维码上传测试', { errorCorrectionLevel: 'M' });
    expect(scanPlain(image)).toMatchObject({ found: true, data: '普通二维码上传测试' });
  });

  it('keeps generated QR images scannable when a center icon is overlaid', () => {
    const decoded = decodeCubeImages(buildCubeQrImages('icon-safe QR', {
      errorCorrectionLevel: 'H',
      icon: true,
    }));
    expect(decoded).toMatchObject({ success: true, data: 'icon-safe QR' });
  });


  it('uses qrcode actual generation to reject over-capacity input', () => {
    const small = analyzeEncodeCapacity('short text', { errorLevel: 'M' });
    expect(small.ok).toBe(true);
    expect(small.worstVersion).toBeGreaterThan(0);

    const huge = analyzeEncodeCapacity('文'.repeat(20000), { errorLevel: 'H', icon: true });
    expect(huge.ok).toBe(false);
    expect(huge.failures.length).toBeGreaterThan(0);
  });

  it('keeps every configured color palette scannable', () => {
    const palettes = [
      ['colorful', FACE_COLORS],
      ['inverted', FACE_COLORS_INVERTED],
      ['inverted-colorful', FACE_COLORS_INVERTED_COLORFUL],
      ...Object.entries(GENE_QR_COLORS).map(([name, color]) => [`gene-${name}`, Array(6).fill(color)]),
    ];

    for (const [name, palette] of palettes) {
      const images = buildCubeQrImages(`scan color ${name}`, { palette });
      const decoded = decodeCubeImages(images);
      expect(decoded.success, `${name} should scan`).toBe(true);
      expect(decoded.data).toBe(`scan color ${name}`);
    }
  });
});
