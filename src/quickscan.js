import jsQR from 'jsqr';
import { getNetLayout, getNetLayoutNames } from './crossnet.js';

function getImageData(source) {
  if (source instanceof HTMLCanvasElement) {
    const ctx = source.getContext('2d');
    return { imageData: ctx.getImageData(0, 0, source.width, source.height), width: source.width, height: source.height };
  }
  return { imageData: source, width: source.width, height: source.height };
}

/**
 * Scan a cross net image for all 6 QR codes.
 * Divides the image into 6 regions based on the cross layout and scans each.
 */
export function scanCrossNet(source, { layout = 'auto' } = {}) {
  const { imageData, width, height } = getImageData(source);
  const variants = buildEnhancedVariants(imageData, width, height);

  let best = { found: 0, payloads: new Map(), layout: layout === 'auto' ? 'classic' : layout, variant: 'original' };
  for (const variant of variants) {
    const result = layout === 'auto'
      ? scanAutoNetLayout(variant.imageData, variant.width, variant.height)
      : scanKnownNetLayout(variant.imageData, variant.width, variant.height, layout);

    if (result.found > best.found) {
      best = { ...result, variant: variant.name };
    }
    if (best.found === 6) break;
  }

  return best;
}

function scanAutoNetLayout(imageData, width, height) {
  let best = { found: 0, payloads: new Map(), layout: 'classic' };
  for (const layoutName of getNetLayoutNames()) {
    const result = scanKnownNetLayout(imageData, width, height, layoutName);
    if (result.found > best.found) {
      best = result;
    }
    if (best.found === 6) break;
  }
  return best;
}

function scanKnownNetLayout(imageData, width, height, layoutName) {
  const payloads = new Map();
  const net = getNetLayout(layoutName);
  const cellW = width / net.cols;
  const cellH = height / net.rows;

  for (const { row, col } of net.cells) {
    const x = Math.floor(col * cellW);
    const y = Math.floor(row * cellH);
    const w = Math.floor(cellW);
    const h = Math.floor(cellH);
    const regionData = extractRegion(imageData, x, y, w, h);
    const code = decodeQr(regionData, w, h);

    if (code && code.data) {
      try {
        const bytes = base64ToBytes(code.data);
        const faceId = extractFaceId(bytes);
        if (faceId >= 1 && faceId <= 6) {
          payloads.set(faceId, bytes);
        }
      } catch {
        // skip invalid QR
      }
    }
  }

  return { found: payloads.size, payloads, layout: layoutName };
}

/**
 * Scan a single QR code from a video frame.
 * Tries the whole frame as one image.
 */
export function scanSingle(source) {
  const { imageData, width, height } = getImageData(source);
  const code = decodeQr(imageData, width, height);

  if (code && code.data) {
    try {
      const bytes = base64ToBytes(code.data);
      const faceId = extractFaceId(bytes);
      if (faceId >= 1 && faceId <= 6) {
        return { found: 1, payloads: new Map([[faceId, bytes]]) };
      }
    } catch {
      // not a valid cube code
    }
  }

  return { found: 0, payloads: new Map() };
}

/**
 * Scan a plain/ordinary QR code and return its raw text content.
 */
export function scanPlain(source) {
  const { imageData, width, height } = getImageData(source);
  const variants = buildEnhancedVariants(imageData, width, height);

  for (const variant of variants) {
    const whole = decodeQr(variant.imageData, variant.width, variant.height);
    if (whole && whole.data) {
      return { found: true, data: whole.data, variant: variant.name };
    }

    // Uploaded photos often contain a QR somewhere in the frame rather than
    // tightly cropped. Try centered crops, overlapping grids and enhanced image
    // variants before giving up.
    const candidates = [
      centeredRegion(variant.width, variant.height, 0.9),
      centeredRegion(variant.width, variant.height, 0.75),
      centeredRegion(variant.width, variant.height, 0.6),
      centeredRegion(variant.width, variant.height, 0.45),
      ...gridRegions(variant.width, variant.height, 3, 3, 0),
      ...gridRegions(variant.width, variant.height, 4, 4, 0.18),
      ...gridRegions(variant.width, variant.height, 5, 5, 0.22),
    ];

    for (const region of candidates) {
      const regionData = extractRegion(variant.imageData, region.x, region.y, region.w, region.h);
      const code = decodeQr(regionData, region.w, region.h);
      if (code && code.data) {
        return { found: true, data: code.data, variant: variant.name };
      }
    }
  }

  return { found: false, data: null };
}

/**
 * Scan from camera video frame — crops and scans the cross net area.
 */
export function scanVideoFrame(videoEl, canvasEl, overlayRect) {
  const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
  canvasEl.width = videoEl.videoWidth || 640;
  canvasEl.height = videoEl.videoHeight || 480;
  ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);

  // If overlay rect provided, crop to that area
  if (overlayRect) {
    const scaleX = canvasEl.width / overlayRect.containerWidth;
    const scaleY = canvasEl.height / overlayRect.containerHeight;
    const sx = overlayRect.x * scaleX;
    const sy = overlayRect.y * scaleY;
    const sw = overlayRect.width * scaleX;
    const sh = overlayRect.height * scaleY;

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = Math.floor(sw);
    cropCanvas.height = Math.floor(sh);
    const cropCtx = cropCanvas.getContext('2d');
    cropCtx.drawImage(canvasEl, sx, sy, sw, sh, 0, 0, cropCanvas.width, cropCanvas.height);

    return scanCrossNet(cropCanvas);
  }

  return scanCrossNet(canvasEl);
}

function decodeQr(imageData, width, height) {
  try {
    return jsQR(imageData.data, width, height, { inversionAttempts: 'attemptBoth' });
  } catch {
    return null;
  }
}

function buildEnhancedVariants(imageData, width, height) {
  const variants = [{ name: 'original', imageData, width, height }];
  const enhanced = enhanceContrast(toGrayscale(imageData, width, height), width, height, 1.35);
  variants.push({ name: 'gray-contrast', imageData: enhanced, width, height });
  variants.push({ name: 'inverted', imageData: invertImageData(enhanced, width, height), width, height });

  const maxSide = Math.max(width, height);
  if (maxSide < 1200) {
    const scaled = scaleImageData(imageData, width, height, 1.6);
    variants.push({ name: 'scaled', ...scaled });
    const scaledEnhanced = enhanceContrast(toGrayscale(scaled.imageData, scaled.width, scaled.height), scaled.width, scaled.height, 1.35);
    variants.push({ name: 'scaled-gray-contrast', imageData: scaledEnhanced, width: scaled.width, height: scaled.height });
  }

  return variants;
}

function toGrayscale(imageData, width, height) {
  const out = new Uint8ClampedArray(width * height * 4);
  const src = imageData.data;
  for (let i = 0; i < src.length; i += 4) {
    const gray = Math.round(src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114);
    out[i] = gray;
    out[i + 1] = gray;
    out[i + 2] = gray;
    out[i + 3] = src[i + 3] ?? 255;
  }
  return new ImageData(out, width, height);
}

function enhanceContrast(imageData, width, height, factor) {
  const out = new Uint8ClampedArray(width * height * 4);
  const src = imageData.data;
  for (let i = 0; i < src.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      out[i + c] = clamp((src[i + c] - 128) * factor + 128);
    }
    out[i + 3] = src[i + 3] ?? 255;
  }
  return new ImageData(out, width, height);
}

function invertImageData(imageData, width, height) {
  const out = new Uint8ClampedArray(width * height * 4);
  const src = imageData.data;
  for (let i = 0; i < src.length; i += 4) {
    out[i] = 255 - src[i];
    out[i + 1] = 255 - src[i + 1];
    out[i + 2] = 255 - src[i + 2];
    out[i + 3] = src[i + 3] ?? 255;
  }
  return new ImageData(out, width, height);
}

function scaleImageData(imageData, width, height, factor) {
  const scaledWidth = Math.max(1, Math.round(width * factor));
  const scaledHeight = Math.max(1, Math.round(height * factor));
  const src = imageData.data;
  const out = new Uint8ClampedArray(scaledWidth * scaledHeight * 4);

  for (let y = 0; y < scaledHeight; y++) {
    const srcY = Math.min(height - 1, Math.floor(y / factor));
    for (let x = 0; x < scaledWidth; x++) {
      const srcX = Math.min(width - 1, Math.floor(x / factor));
      const srcIdx = (srcY * width + srcX) * 4;
      const dstIdx = (y * scaledWidth + x) * 4;
      out[dstIdx] = src[srcIdx];
      out[dstIdx + 1] = src[srcIdx + 1];
      out[dstIdx + 2] = src[srcIdx + 2];
      out[dstIdx + 3] = src[srcIdx + 3];
    }
  }

  return { imageData: new ImageData(out, scaledWidth, scaledHeight), width: scaledWidth, height: scaledHeight };
}

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function extractRegion(imageData, x, y, w, h) {
  const src = imageData.data;
  const srcW = imageData.width;
  const srcH = imageData.height;
  const safeX = Math.max(0, Math.min(srcW - 1, x));
  const safeY = Math.max(0, Math.min(srcH - 1, y));
  const safeW = Math.max(1, Math.min(w, srcW - safeX));
  const safeH = Math.max(1, Math.min(h, srcH - safeY));
  const region = new Uint8ClampedArray(safeW * safeH * 4);

  for (let row = 0; row < safeH; row++) {
    for (let col = 0; col < safeW; col++) {
      const srcIdx = ((safeY + row) * srcW + (safeX + col)) * 4;
      const dstIdx = (row * safeW + col) * 4;
      region[dstIdx] = src[srcIdx];
      region[dstIdx + 1] = src[srcIdx + 1];
      region[dstIdx + 2] = src[srcIdx + 2];
      region[dstIdx + 3] = src[srcIdx + 3];
    }
  }

  return new ImageData(region, safeW, safeH);
}

function centeredRegion(width, height, ratio) {
  const w = Math.max(1, Math.floor(width * ratio));
  const h = Math.max(1, Math.floor(height * ratio));
  return {
    x: Math.floor((width - w) / 2),
    y: Math.floor((height - h) / 2),
    w,
    h,
  };
}

function gridRegions(width, height, cols, rows, overlapRatio = 0) {
  const regions = [];
  const cellW = width / cols;
  const cellH = height / rows;
  const expandW = cellW * overlapRatio;
  const expandH = cellH * overlapRatio;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = Math.floor(col * cellW - expandW);
      const y = Math.floor(row * cellH - expandH);
      const right = Math.ceil((col + 1) * cellW + expandW);
      const bottom = Math.ceil((row + 1) * cellH + expandH);
      regions.push({
        x: Math.max(0, x),
        y: Math.max(0, y),
        w: Math.min(width, right) - Math.max(0, x),
        h: Math.min(height, bottom) - Math.max(0, y),
      });
    }
  }

  return regions;
}

function extractFaceId(payloadBytes) {
  const bits = Array.from(payloadBytes)
    .map((b) => b.toString(2).padStart(8, '0'))
    .join('');
  return parseInt(bits.slice(0, 3), 2);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
