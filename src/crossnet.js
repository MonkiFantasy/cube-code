/**
 * Render 6 QR code canvases in a cross-shaped net layout.
 *
 * Cross net layout (standard cube net):
 *         [3]
 *   [5] [1] [6] [2]
 *         [4]
 */

const NET_LAYOUT = [
  { face: 3, row: 0, col: 1 },
  { face: 5, row: 1, col: 0 },
  { face: 1, row: 1, col: 1 },
  { face: 6, row: 1, col: 2 },
  { face: 2, row: 1, col: 3 },
  { face: 4, row: 2, col: 1 },
];

/**
 * Render the cross net into a container.
 * @param {HTMLElement} container
 * @param {HTMLCanvasElement[]} qrCanvases - 6 canvases, index 0 = face 1
 * @returns {HTMLElement} the grid element
 */
export function renderCrossNet(container, qrCanvases, { mode = 'colorful' } = {}) {
  container.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'crossnet';
  if (mode === 'inverted') grid.classList.add('inverted');

  // 3 rows x 4 cols grid
  for (const { face, row, col } of NET_LAYOUT) {
    const cell = document.createElement('div');
    cell.className = 'crossnet-cell';
    cell.style.gridRow = row + 1;
    cell.style.gridColumn = col + 1;

    const canvas = qrCanvases[face - 1];
    if (canvas) {
      const img = document.createElement('img');
      img.src = canvas.toDataURL('image/png');
      img.alt = `Face ${face}`;
      img.draggable = false;
      cell.appendChild(img);
    }

    const label = document.createElement('span');
    label.className = 'crossnet-label';
    label.textContent = face;
    cell.appendChild(label);

    grid.appendChild(cell);
  }

  container.appendChild(grid);
  return grid;
}

/**
 * Render the cross net into a high-resolution canvas for download.
 * @param {HTMLCanvasElement[]} qrCanvases - 6 canvases, index 0 = face 1
 * @param {number} cellSize - size of each QR cell in pixels
 * @returns {HTMLCanvasElement}
 */
export function renderCrossNetCanvas(qrCanvases, { cellSize = 512, mode = 'colorful' } = {}) {
  const cols = 4;
  const rows = 3;
  const gap = 8;
  const canvas = document.createElement('canvas');
  canvas.width = cols * cellSize + (cols - 1) * gap;
  canvas.height = rows * cellSize + (rows - 1) * gap;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = mode === 'inverted' ? '#1a1a1a' : '#f5f5f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const { face, row, col } of NET_LAYOUT) {
    const x = col * (cellSize + gap);
    const y = row * (cellSize + gap);

    const qrCanvas = qrCanvases[face - 1];
    if (qrCanvas) {
      ctx.drawImage(qrCanvas, x, y, cellSize, cellSize);
    }

    // Face number label
    ctx.fillStyle = mode === 'inverted' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)';
    ctx.font = `bold ${Math.floor(cellSize * 0.06)}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(String(face), x + cellSize - 8, y + cellSize - 8);
  }

  return canvas;
}

/**
 * Show a toast notification.
 */
function showToast(msg, duration = 3000) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:0.6rem 1.2rem;border-radius:8px;font-size:0.85rem;z-index:10000;pointer-events:none;opacity:0;transition:opacity 0.3s';
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; });
  window.setTimeout(() => { t.style.opacity = '0'; window.setTimeout(() => t.remove(), 300); }, duration);
}

/**
 * Download the cross net as a PNG image.
 */
export async function downloadCrossNet(qrCanvases, mode = 'colorful') {
  const canvas = renderCrossNetCanvas(qrCanvases, { mode });
  const dataUrl = canvas.toDataURL('image/png');

  // Capacitor (Android/iOS) — save file and show confirmation
  if (window.Capacitor) {
    try {
      const { Filesystem } = await import('@capacitor/filesystem');
      const base64 = dataUrl.split(',')[1];
      await Filesystem.writeFile({
        path: 'cube-code-crossnet.png',
        data: base64,
        directory: 'Pictures',
      });
      showToast('图片已保存到相册 / Saved to Pictures');
    } catch (err) {
      console.warn('Filesystem save failed:', err);
      showToast('保存失败，尝试显示预览 / Save failed');
      // Fallback: show overlay for manual save
      showImageOverlay(dataUrl);
    }
    return;
  }

  // Browser — standard download
  const link = document.createElement('a');
  link.download = 'cube-code-crossnet.png';
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Show image in a full-screen overlay with close button.
 */
function showImageOverlay(dataUrl) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.9);display:flex;flex-direction:column;align-items:center;justify-content:center';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'position:absolute;top:1rem;right:1rem;background:rgba(255,255,255,0.2);color:#fff;border:none;border-radius:50%;width:36px;height:36px;font-size:1.2rem;cursor:pointer;z-index:10001';
  closeBtn.addEventListener('click', (e) => { e.stopPropagation(); overlay.remove(); });

  const img = document.createElement('img');
  img.src = dataUrl;
  img.style.cssText = 'max-width:95vw;max-height:80vh;object-fit:contain;border-radius:8px';

  const hint = document.createElement('p');
  hint.textContent = '长按图片保存 / Long press to save';
  hint.style.cssText = 'color:#fff;margin-top:1rem;font-size:0.9rem';

  overlay.appendChild(closeBtn);
  overlay.appendChild(img);
  overlay.appendChild(hint);
  // Tap background to close (not the image)
  overlay.addEventListener('click', () => overlay.remove());
  img.addEventListener('click', (e) => e.stopPropagation());
  document.body.appendChild(overlay);
}
