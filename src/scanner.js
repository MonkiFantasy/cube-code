import jsQR from 'jsqr';
import { base64ToBytes } from './encoder-utils.js';

/**
 * Start camera scanning. Calls onScan(payloadBytes) for each new face detected.
 * Returns a stop() function.
 */
export function startScanner(videoEl, canvasEl, onScan) {
  const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
  let animId = null;
  let stream = null;
  let scanning = true;
  const seen = new Set();

  async function init() {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: 640, height: 480 },
    });
    videoEl.srcObject = stream;
    await videoEl.play();
    canvasEl.width = videoEl.videoWidth || 640;
    canvasEl.height = videoEl.videoHeight || 480;
    tick();
  }

  function tick() {
    if (!scanning) return;

    if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
      ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
      const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code && code.data && !seen.has(code.data)) {
        seen.add(code.data);
        try {
          const payloadBytes = base64ToBytes(code.data);
          onScan(payloadBytes);
        } catch {
          // not a valid cube code payload, skip
        }
      }
    }

    animId = requestAnimationFrame(tick);
  }

  function stop() {
    scanning = false;
    if (animId) cancelAnimationFrame(animId);
    if (stream) stream.getTracks().forEach((t) => t.stop());
  }

  init();

  return { stop, reset: () => seen.clear() };
}
