import jsQR from 'jsqr';
import { base64ToBytes } from './encoder-utils.js';

/**
 * Start camera scanning. Calls onScan(payloadBytes) for each new face detected.
 * @param {HTMLVideoElement} videoEl
 * @param {HTMLCanvasElement} canvasEl
 * @param {function} onScan - called with (payloadBytes, faceId) for each new face
 * @param {object} opts - { quick: boolean, plain: boolean }
 *   quick mode scans extra regions; plain mode returns ordinary QR text.
 * @returns {{ stop, reset }}
 */
export function startScanner(videoEl, canvasEl, onScan, opts = {}) {
  const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
  let animId = null;
  let stream = null;
  let scanning = true;
  const seenAt = new Map(); // QR text -> last processed timestamp
  const seenCooldownMs = opts.plain ? 1200 : 450;

  async function init() {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: 640, height: 480 },
    });

    if (!scanning) {
      mediaStream.getTracks().forEach((t) => t.stop());
      return;
    }

    stream = mediaStream;
    videoEl.srcObject = stream;
    await videoEl.play();

    if (!scanning) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    canvasEl.width = videoEl.videoWidth || 640;
    canvasEl.height = videoEl.videoHeight || 480;
    tick();
  }

  function tick() {
    if (!scanning) return;

    if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
      ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
      const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);

      // Always try full-frame single QR detection
      tryDecodeQR(imageData, canvasEl.width, canvasEl.height);

      // In quick mode, also scan regions for multiple QR codes
      if (opts.quick) {
        scanRegions(imageData, canvasEl.width, canvasEl.height);
      }
    }

    animId = requestAnimationFrame(tick);
  }

  function tryDecodeQR(imageData, w, h) {
    const code = jsQR(imageData.data, w, h);
    handleDecodedCode(code);
  }

  function scanRegions(imageData, w, h) {
    // Try a grid of overlapping regions to find multiple QR codes
    const gridCols = 3;
    const gridRows = 3;
    const cellW = Math.floor(w / gridCols);
    const cellH = Math.floor(h / gridRows);

    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const x = c * cellW;
        const y = r * cellH;
        const regionData = extractRegion(imageData, x, y, cellW, cellH);
        const code = jsQR(regionData.data, cellW, cellH);
        handleDecodedCode(code);
      }
    }
  }

  function handleDecodedCode(code) {
    if (!code?.data || isCoolingDown(code.data)) return;

    if (opts.plain) {
      onScan(code.data, null);
      return;
    }

    const result = decodePayload(code.data);
    if (result) {
      onScan(result.bytes, result.faceId);
    }
  }

  function isCoolingDown(data) {
    const now = Date.now();
    const lastSeen = seenAt.get(data) || 0;
    if (now - lastSeen < seenCooldownMs) return true;
    seenAt.set(data, now);

    for (const [value, time] of seenAt) {
      if (now - time > seenCooldownMs * 4) seenAt.delete(value);
    }
    return false;
  }

  function decodePayload(base64Str) {
    try {
      const bytes = base64ToBytes(base64Str);
      const bits = Array.from(bytes).map((b) => b.toString(2).padStart(8, '0')).join('');
      const faceId = parseInt(bits.slice(0, 3), 2);
      if (faceId >= 1 && faceId <= 6) {
        return { bytes, faceId };
      }
    } catch {
      // not a valid cube code
    }
    return null;
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

  function stop() {
    scanning = false;
    if (animId) cancelAnimationFrame(animId);
    if (stream) stream.getTracks().forEach((t) => t.stop());
  }

  init();

  return {
    stop,
    reset() {
      seenAt.clear();
    },
  };
}
