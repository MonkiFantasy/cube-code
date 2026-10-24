const DEFAULT_OPTIONS = {
  dpi: 300,
  cubeFaceMm: 57,
  stickerGapMm: 1.2,
  sheetMarginMm: 8,
  faceSpacingMm: 7,
  labelBandMm: 7,
  cols: 3,
  filename: 'cube-code-sticker-pack.png',
  faceLabels: ['Face 1 Front', 'Face 2 Back', 'Face 3 Top', 'Face 4 Bottom', 'Face 5 Left', 'Face 6 Right'],
};

/**
 * Render a printable 3x3 sticker sheet for a real 3x3 Rubik's cube.
 * Each QR face is split visually into 9 stickers with cut gaps/guides, so the
 * printed pieces can be pasted on physical cubies. When the cube is restored,
 * the 9 pieces form the original QR face again.
 *
 * @param {HTMLCanvasElement[]} qrCanvases - 6 QR canvases, index 0 = face 1.
 * @param {Partial<typeof DEFAULT_OPTIONS>} options
 * @returns {HTMLCanvasElement}
 */
export function renderStickerPackCanvas(qrCanvases, options = {}) {
  if (!Array.isArray(qrCanvases) || qrCanvases.length === 0) {
    throw new TypeError('qrCanvases must be a non-empty array');
  }

  const config = { ...DEFAULT_OPTIONS, ...options };
  const pxPerMm = config.dpi / 25.4;
  const faceSize = mmToPx(config.cubeFaceMm, pxPerMm);
  const gap = mmToPx(config.stickerGapMm, pxPerMm);
  const margin = mmToPx(config.sheetMarginMm, pxPerMm);
  const spacing = mmToPx(config.faceSpacingMm, pxPerMm);
  const labelBand = mmToPx(config.labelBandMm, pxPerMm);
  const cols = Math.max(1, Math.min(6, config.cols || 3));
  const rows = Math.ceil(qrCanvases.length / cols);
  const blockW = faceSize;
  const blockH = faceSize + labelBand;
  const width = margin * 2 + cols * blockW + (cols - 1) * spacing;
  const height = margin * 2 + rows * blockH + (rows - 1) * spacing;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  qrCanvases.forEach((faceCanvas, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = margin + col * (blockW + spacing);
    const y = margin + row * (blockH + spacing);
    const label = config.faceLabels?.[index] || `Face ${index + 1}`;
    drawStickerFace(ctx, faceCanvas, x, y, faceSize, gap, label, index + 1);
  });

  drawSheetTitle(ctx, width, margin, 'Cube Code · 3x3 real cube sticker pack');
  return canvas;
}

export function downloadStickerPack(qrCanvases, options = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const canvas = renderStickerPackCanvas(qrCanvases, config);
  const dataUrl = canvas.toDataURL('image/png');

  if (window.Capacitor) {
    showImageOverlay(dataUrl);
    return;
  }

  const link = document.createElement('a');
  link.download = config.filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function drawStickerFace(ctx, sourceCanvas, x, y, faceSize, gap, label, faceId) {
  const stickerSize = (faceSize - gap * 2) / 3;

  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - 1, y - 1, faceSize + 2, faceSize + 2);

  // Draw the QR as nine separated stickers. The source is sliced without data
  // loss; only the printed sheet has physical gaps between pieces.
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const sx = Math.floor((sourceCanvas.width * col) / 3);
      const sy = Math.floor((sourceCanvas.height * row) / 3);
      const sr = Math.floor((sourceCanvas.width * (col + 1)) / 3);
      const sb = Math.floor((sourceCanvas.height * (row + 1)) / 3);
      const dx = x + col * (stickerSize + gap);
      const dy = y + row * (stickerSize + gap);
      ctx.drawImage(sourceCanvas, sx, sy, sr - sx, sb - sy, dx, dy, stickerSize, stickerSize);
      drawStickerBorder(ctx, dx, dy, stickerSize);
    }
  }

  drawCutGuides(ctx, x, y, faceSize, stickerSize, gap);
  drawFaceLabel(ctx, x, y + faceSize + 6, faceSize, label, faceId);
  drawTopArrow(ctx, x + faceSize - 38, y + 10);
  ctx.restore();
}

function drawStickerBorder(ctx, x, y, size) {
  ctx.strokeStyle = 'rgba(20, 20, 20, 0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
}

function drawCutGuides(ctx, x, y, faceSize, stickerSize, gap) {
  ctx.save();
  ctx.strokeStyle = '#ff3b30';
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(x - 4, y - 4, faceSize + 8, faceSize + 8);

  for (let i = 1; i <= 2; i++) {
    const guide = x + i * stickerSize + (i - 0.5) * gap;
    ctx.beginPath();
    ctx.moveTo(guide, y - 5);
    ctx.lineTo(guide, y + faceSize + 5);
    ctx.stroke();
  }
  for (let i = 1; i <= 2; i++) {
    const guide = y + i * stickerSize + (i - 0.5) * gap;
    ctx.beginPath();
    ctx.moveTo(x - 5, guide);
    ctx.lineTo(x + faceSize + 5, guide);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFaceLabel(ctx, x, y, width, label, faceId) {
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x, y);
  ctx.fillStyle = '#6b7280';
  ctx.font = '18px sans-serif';
  ctx.fillText(`Face ${faceId} · keep TOP arrow upward`, x, y + 28);
}

function drawTopArrow(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = 'rgba(17, 24, 39, 0.78)';
  ctx.beginPath();
  ctx.moveTo(x + 14, y);
  ctx.lineTo(x + 28, y + 22);
  ctx.lineTo(x + 18, y + 22);
  ctx.lineTo(x + 18, y + 34);
  ctx.lineTo(x + 10, y + 34);
  ctx.lineTo(x + 10, y + 22);
  ctx.lineTo(x, y + 22);
  ctx.closePath();
  ctx.fill();
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TOP', x + 14, y + 48);
  ctx.restore();
}

function drawSheetTitle(ctx, width, margin, title) {
  ctx.save();
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(title, width / 2, Math.max(4, margin * 0.25));
  ctx.restore();
}

function mmToPx(mm, pxPerMm) {
  return Math.round(mm * pxPerMm);
}

let activeOverlay = null;
function showImageOverlay(dataUrl) {
  if (activeOverlay) activeOverlay.remove();
  activeOverlay = document.createElement('div');
  activeOverlay.className = 'image-save-overlay';
  activeOverlay.innerHTML = `
    <div class="image-save-card">
      <p>长按图片保存到相册</p>
      <img alt="Cube Code sticker pack" src="${dataUrl}">
      <button type="button">关闭</button>
    </div>
  `;
  activeOverlay.querySelector('button')?.addEventListener('click', () => {
    activeOverlay?.remove();
    activeOverlay = null;
  });
  document.body.appendChild(activeOverlay);
}

/**
 * Split an ImageData-like RGBA image into a fixed sticker grid.
 *
 * The returned stickers keep their solved row/col coordinates so callers may
 * shuffle them during a "cube unlock" flow and later restore by coordinates.
 *
 * @param {{data: Uint8ClampedArray|Uint8Array, width: number, height: number}} imageData
 * @param {{rows?: number, cols?: number}} options
 * @returns {{rows: number, cols: number, stickers: Array<{row: number, col: number, data: Uint8ClampedArray, width: number, height: number}>}}
 */
export function splitImageIntoStickers(imageData, { rows = 3, cols = 3 } = {}) {
  assertImageDataLike(imageData);
  assertPositiveInteger(rows, 'rows');
  assertPositiveInteger(cols, 'cols');

  const stickers = [];
  for (let row = 0; row < rows; row++) {
    const y = Math.floor((imageData.height * row) / rows);
    const bottom = Math.floor((imageData.height * (row + 1)) / rows);
    for (let col = 0; col < cols; col++) {
      const x = Math.floor((imageData.width * col) / cols);
      const right = Math.floor((imageData.width * (col + 1)) / cols);
      stickers.push({
        row,
        col,
        width: right - x,
        height: bottom - y,
        data: copyRegion(imageData, x, y, right - x, bottom - y),
      });
    }
  }

  return { rows, cols, stickers };
}

/**
 * Recompose a sticker grid into one complete ImageData-like RGBA image.
 * Stickers are placed by their solved row/col coordinates rather than array
 * order, which lets tests model a shuffled cube that has been restored.
 *
 * @param {Array<{row: number, col: number, data: Uint8ClampedArray|Uint8Array, width: number, height: number}>} stickers
 * @param {{rows?: number, cols?: number}} options
 * @returns {{data: Uint8ClampedArray, width: number, height: number}}
 */
export function composeStickers(stickers, { rows = 3, cols = 3 } = {}) {
  if (!Array.isArray(stickers)) throw new TypeError('stickers must be an array');
  assertPositiveInteger(rows, 'rows');
  assertPositiveInteger(cols, 'cols');
  if (stickers.length !== rows * cols) {
    throw new Error(`expected ${rows * cols} stickers, got ${stickers.length}`);
  }

  const byPosition = new Map();
  for (const sticker of stickers) {
    assertSticker(sticker, rows, cols);
    const key = `${sticker.row},${sticker.col}`;
    if (byPosition.has(key)) throw new Error(`duplicate sticker at ${key}`);
    byPosition.set(key, sticker);
  }

  const columnWidths = [];
  const rowHeights = [];
  for (let col = 0; col < cols; col++) {
    const width = byPosition.get(`0,${col}`)?.width;
    if (!width) throw new Error(`missing sticker at 0,${col}`);
    columnWidths.push(width);
  }
  for (let row = 0; row < rows; row++) {
    const height = byPosition.get(`${row},0`)?.height;
    if (!height) throw new Error(`missing sticker at ${row},0`);
    rowHeights.push(height);
  }

  const width = columnWidths.reduce((sum, item) => sum + item, 0);
  const height = rowHeights.reduce((sum, item) => sum + item, 0);
  const out = new Uint8ClampedArray(width * height * 4);

  let dstY = 0;
  for (let row = 0; row < rows; row++) {
    let dstX = 0;
    for (let col = 0; col < cols; col++) {
      const sticker = byPosition.get(`${row},${col}`);
      if (!sticker) throw new Error(`missing sticker at ${row},${col}`);
      if (sticker.width !== columnWidths[col] || sticker.height !== rowHeights[row]) {
        throw new Error(`sticker size mismatch at ${row},${col}`);
      }
      pasteRegion(out, width, sticker, dstX, dstY);
      dstX += sticker.width;
    }
    dstY += rowHeights[row];
  }

  return { data: out, width, height };
}

function copyRegion(imageData, x, y, width, height) {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const srcIdx = ((y + row) * imageData.width + (x + col)) * 4;
      const dstIdx = (row * width + col) * 4;
      out[dstIdx] = imageData.data[srcIdx];
      out[dstIdx + 1] = imageData.data[srcIdx + 1];
      out[dstIdx + 2] = imageData.data[srcIdx + 2];
      out[dstIdx + 3] = imageData.data[srcIdx + 3];
    }
  }
  return out;
}

function pasteRegion(out, outWidth, sticker, dstX, dstY) {
  for (let row = 0; row < sticker.height; row++) {
    for (let col = 0; col < sticker.width; col++) {
      const srcIdx = (row * sticker.width + col) * 4;
      const dstIdx = ((dstY + row) * outWidth + dstX + col) * 4;
      out[dstIdx] = sticker.data[srcIdx];
      out[dstIdx + 1] = sticker.data[srcIdx + 1];
      out[dstIdx + 2] = sticker.data[srcIdx + 2];
      out[dstIdx + 3] = sticker.data[srcIdx + 3];
    }
  }
}

function assertImageDataLike(imageData) {
  if (!imageData || !imageData.data || !Number.isInteger(imageData.width) || !Number.isInteger(imageData.height)) {
    throw new TypeError('imageData must contain data, width and height');
  }
  if (imageData.width <= 0 || imageData.height <= 0) {
    throw new RangeError('imageData width and height must be positive');
  }
  if (imageData.data.length < imageData.width * imageData.height * 4) {
    throw new RangeError('imageData data is too short for width and height');
  }
}

function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

function assertSticker(sticker, rows, cols) {
  assertImageDataLike(sticker);
  if (!Number.isInteger(sticker.row) || sticker.row < 0 || sticker.row >= rows) {
    throw new RangeError('sticker row is out of range');
  }
  if (!Number.isInteger(sticker.col) || sticker.col < 0 || sticker.col >= cols) {
    throw new RangeError('sticker col is out of range');
  }
}
