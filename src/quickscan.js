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

  if (layout !== 'auto') {
    return scanKnownNetLayout(imageData, width, height, layout);
  }

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
    const code = jsQR(regionData.data, w, h);

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
  const code = jsQR(imageData.data, width, height);

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
  const whole = jsQR(imageData.data, width, height);

  if (whole && whole.data) {
    return { found: true, data: whole.data };
  }

  // Uploaded photos often contain a QR somewhere in the frame rather than
  // tightly cropped. Try centered crops and grid regions before giving up.
  const candidates = [
    centeredRegion(width, height, 0.85),
    centeredRegion(width, height, 0.7),
    centeredRegion(width, height, 0.55),
    ...gridRegions(width, height, 3, 3),
    ...gridRegions(width, height, 4, 4),
  ];

  for (const region of candidates) {
    const regionData = extractRegion(imageData, region.x, region.y, region.w, region.h);
    const code = jsQR(regionData.data, region.w, region.h);
    if (code && code.data) {
      return { found: true, data: code.data };
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

function extractRegion(imageData, x, y, w, h) {
  const src = imageData.data;
  const srcW = imageData.width;
  const region = new Uint8ClampedArray(w * h * 4);

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const srcIdx = ((y + row) * srcW + (x + col)) * 4;
      const dstIdx = (row * w + col) * 4;
      region[dstIdx] = src[srcIdx];
      region[dstIdx + 1] = src[srcIdx + 1];
      region[dstIdx + 2] = src[srcIdx + 2];
      region[dstIdx + 3] = src[srcIdx + 3];
    }
  }

  return new ImageData(region, w, h);
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

function gridRegions(width, height, cols, rows) {
  const regions = [];
  const cellW = Math.floor(width / cols);
  const cellH = Math.floor(height / rows);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      regions.push({
        x: col * cellW,
        y: row * cellH,
        w: col === cols - 1 ? width - col * cellW : cellW,
        h: row === rows - 1 ? height - row * cellH : cellH,
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
