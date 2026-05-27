import jsQR from 'jsqr';

/**
 * Scan a cross net image for all 6 QR codes.
 * Divides the image into 6 regions based on the cross layout and scans each.
 *
 * @param {ImageData|HTMLCanvasElement} source
 * @returns {{ found: number, payloads: Map<number, Uint8Array> }}
 */
export function scanCrossNet(source) {
  let imageData;
  let width;
  let height;

  if (source instanceof HTMLCanvasElement) {
    const ctx = source.getContext('2d');
    width = source.width;
    height = source.height;
    imageData = ctx.getImageData(0, 0, width, height);
  } else {
    imageData = source;
    width = source.width;
    height = source.height;
  }

  const payloads = new Map();

  // Cross net layout: 3 rows x 4 cols
  // Row 0: col 1 = face 3
  // Row 1: col 0 = face 5, col 1 = face 1, col 2 = face 6, col 3 = face 2
  // Row 2: col 1 = face 4
  const regions = [
    { face: 3, row: 0, col: 1, cols: 1 },
    { face: 5, row: 1, col: 0, cols: 1 },
    { face: 1, row: 1, col: 1, cols: 1 },
    { face: 6, row: 1, col: 2, cols: 1 },
    { face: 2, row: 1, col: 3, cols: 1 },
    { face: 4, row: 2, col: 1, cols: 1 },
  ];

  const cellW = width / 4;
  const cellH = height / 3;

  for (const { row, col } of regions) {
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

  return { found: payloads.size, payloads };
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
