/**
 * Render QR code canvases in selectable flat layouts.
 * The standard layout is a real cube net; the playful layouts are scan-friendly
 * presentation layouts. Upload decoding can auto-try all layouts below.
 */

export const NET_LAYOUTS = {
  classic: {
    labelKey: 'netClassic',
    cols: 4,
    rows: 3,
    cells: [
      { face: 3, row: 0, col: 1 },
      { face: 5, row: 1, col: 0 },
      { face: 1, row: 1, col: 1 },
      { face: 6, row: 1, col: 2 },
      { face: 2, row: 1, col: 3 },
      { face: 4, row: 2, col: 1 },
    ],
  },
  windmill: {
    labelKey: 'netWindmill',
    cols: 3,
    rows: 4,
    cells: [
      { face: 3, row: 0, col: 1 },
      { face: 5, row: 1, col: 0 },
      { face: 1, row: 1, col: 1 },
      { face: 6, row: 1, col: 2 },
      { face: 4, row: 2, col: 1 },
      { face: 2, row: 3, col: 1 },
    ],
  },
  stair: {
    labelKey: 'netStair',
    cols: 3,
    rows: 4,
    cells: [
      { face: 3, row: 0, col: 0 },
      { face: 5, row: 1, col: 0 },
      { face: 1, row: 1, col: 1 },
      { face: 6, row: 2, col: 1 },
      { face: 2, row: 2, col: 2 },
      { face: 4, row: 3, col: 2 },
    ],
  },
  snake: {
    labelKey: 'netSnake',
    cols: 4,
    rows: 3,
    cells: [
      { face: 3, row: 0, col: 0 },
      { face: 1, row: 0, col: 1 },
      { face: 6, row: 0, col: 2 },
      { face: 2, row: 1, col: 2 },
      { face: 4, row: 1, col: 1 },
      { face: 5, row: 2, col: 1 },
    ],
  },
  tower: {
    labelKey: 'netTower',
    cols: 2,
    rows: 5,
    cells: [
      { face: 3, row: 0, col: 0 },
      { face: 1, row: 1, col: 0 },
      { face: 6, row: 2, col: 0 },
      { face: 2, row: 3, col: 0 },
      { face: 5, row: 2, col: 1 },
      { face: 4, row: 4, col: 0 },
    ],
  },
};

export function getNetLayout(layoutName = 'classic') {
  return NET_LAYOUTS[layoutName] || NET_LAYOUTS.classic;
}

export function getNetLayoutNames() {
  return Object.keys(NET_LAYOUTS);
}

/**
 * Render the selected net into a container.
 * @param {HTMLElement} container
 * @param {HTMLCanvasElement[]} qrCanvases - 6 canvases, index 0 = face 1
 * @returns {HTMLElement} the grid element
 */
export function renderCrossNet(container, qrCanvases, { mode = 'colorful', layout = 'classic' } = {}) {
  container.innerHTML = '';

  const net = getNetLayout(layout);
  const grid = document.createElement('div');
  grid.className = 'crossnet';
  grid.style.gridTemplateColumns = `repeat(${net.cols}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${net.rows}, 1fr)`;
  grid.style.aspectRatio = `${net.cols} / ${net.rows}`;
  if (mode === 'inverted') grid.classList.add('inverted');

  for (const { face, row, col } of net.cells) {
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
 * Render the selected net into a high-resolution canvas for download.
 * @param {HTMLCanvasElement[]} qrCanvases - 6 canvases, index 0 = face 1
 * @param {number} cellSize - size of each QR cell in pixels
 * @returns {HTMLCanvasElement}
 */
export function renderCrossNetCanvas(qrCanvases, { cellSize = 512, mode = 'colorful', layout = 'classic' } = {}) {
  const net = getNetLayout(layout);
  const gap = 8;
  const canvas = document.createElement('canvas');
  canvas.width = net.cols * cellSize + (net.cols - 1) * gap;
  canvas.height = net.rows * cellSize + (net.rows - 1) * gap;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = mode === 'inverted' ? '#1a1a1a' : '#f5f5f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const { face, row, col } of net.cells) {
    const x = col * (cellSize + gap);
    const y = row * (cellSize + gap);

    const qrCanvas = qrCanvases[face - 1];
    if (qrCanvas) {
      ctx.drawImage(qrCanvas, x, y, cellSize, cellSize);
    }

    ctx.fillStyle = mode === 'inverted' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)';
    ctx.font = `bold ${Math.floor(cellSize * 0.06)}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(String(face), x + cellSize - 8, y + cellSize - 8);
  }

  return canvas;
}

/**
 * Download the selected net as a PNG image.
 */
export function downloadCrossNet(qrCanvases, mode = 'colorful', layout = 'classic') {
  const canvas = renderCrossNetCanvas(qrCanvases, { mode, layout });
  const dataUrl = canvas.toDataURL('image/png');

  if (window.Capacitor) {
    showImageOverlay(dataUrl);
    return;
  }

  const link = document.createElement('a');
  link.download = `cube-code-${layout}-net.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

let activeOverlay = null;

function showImageOverlay(dataUrl) {
  if (activeOverlay) {
    activeOverlay.remove();
    activeOverlay = null;
  }

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.9);display:flex;flex-direction:column;align-items:center;justify-content:center';
  activeOverlay = overlay;

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'position:absolute;top:1rem;right:1rem;background:rgba(255,255,255,0.2);color:#fff;border:none;border-radius:50%;width:36px;height:36px;font-size:1.2rem;cursor:pointer;z-index:10001';
  closeBtn.addEventListener('click', (e) => { e.stopPropagation(); overlay.remove(); activeOverlay = null; });

  const img = document.createElement('img');
  img.src = dataUrl;
  img.style.cssText = 'max-width:95vw;max-height:80vh;object-fit:contain;border-radius:8px';
  img.addEventListener('click', (e) => e.stopPropagation());

  const hint = document.createElement('p');
  hint.textContent = '长按图片保存到相册 / Long press to save';
  hint.style.cssText = 'color:#fff;margin-top:1rem;font-size:0.9rem';

  overlay.appendChild(closeBtn);
  overlay.appendChild(img);
  overlay.appendChild(hint);
  overlay.addEventListener('click', () => { overlay.remove(); activeOverlay = null; });
  document.body.appendChild(overlay);
}
