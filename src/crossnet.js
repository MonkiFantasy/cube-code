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
export function renderCrossNet(container, qrCanvases) {
  container.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'crossnet';

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
 * Capture the cross net container as a single canvas (for quick scan).
 */
export function captureCrossNet(container) {
  const img = container.querySelector('.crossnet');
  if (!img) return null;

  const rect = img.getBoundingClientRect();
  const canvas = document.createElement('canvas');
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  const ctx = canvas.getContext('2d');
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  // Draw background
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, rect.width, rect.height);

  // Draw all QR code images
  const cells = img.querySelectorAll('.crossnet-cell img');
  cells.forEach((cellImg) => {
    const cellRect = cellImg.getBoundingClientRect();
    const x = cellRect.left - rect.left;
    const y = cellRect.top - rect.top;
    ctx.drawImage(cellImg, x, y, cellRect.width, cellRect.height);
  });

  return canvas;
}
