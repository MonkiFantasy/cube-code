/* global __APP_VERSION__, __APP_COMMIT__ */
import { registerSW } from 'virtual:pwa-register';
import { DATA_TYPE_URL, decodeCubeCode } from './decoder.js';
import { renderCrossNet, downloadCrossNet } from './crossnet.js';
import { t, toggleLang } from './i18n/index.js';
import { getExternalUrlInfo, isSafeUrlOrDeepLink } from './url-utils.js';
import { extractFaceIdFromPayload, replaceScannedPayloadBatch, resetScannedPayloads, upsertScannedPayload } from './scan-state.js';

let encoderModulePromise = null;
let cube3dModulePromise = null;
let scannerModulePromise = null;
let quickscanModulePromise = null;
let stickerPackModulePromise = null;

function loadEncoderModule() {
  encoderModulePromise ||= import('./encoder.js');
  return encoderModulePromise;
}

function loadCube3dModule() {
  cube3dModulePromise ||= import('./cube3d.js');
  return cube3dModulePromise;
}

function loadScannerModule() {
  scannerModulePromise ||= import('./scanner.js');
  return scannerModulePromise;
}

function loadQuickscanModule() {
  quickscanModulePromise ||= import('./quickscan.js');
  return quickscanModulePromise;
}

function loadStickerPackModule() {
  stickerPackModulePromise ||= import('./sticker-pack.js');
  return stickerPackModulePromise;
}

let cube3d = null;
let qrCanvases = [];
let showCross = false;
let quickScanMode = false;
let plainScanMode = false;
let colorMode = 'colorful'; // 'colorful' | 'bw' | 'inverted' | 'inverted-colorful'
const COLOR_MODES = ['colorful', 'bw', 'inverted', 'inverted-colorful'];
const COLOR_MODE_KEYS = { colorful: 'modeColorful', bw: 'modeBW', inverted: 'modeInverted', 'inverted-colorful': 'modeInvertedColorful' };
const MATERIAL_MODES = ['standard', 'glass', 'rubik', 'gene'];
const MATERIAL_MODE_KEYS = { standard: 'standardMaterial', glass: 'glassMaterial', rubik: 'rubikMaterial', gene: 'geneMaterial' };
let singleFaceIdx = 0;
let showSingle = false;
let currentIcon = null;
let emptyFaceImage = null;
let materialMode = 'standard';
let geneColor = 'purple';
let netLayout = 'classic';
let numFaces = 6;
let independentMode = false;
let errorLevel = 'M';
let decodedCopyText = '';

// QR Code version 40 byte-mode capacities. The qrcode library chooses the
// smallest version automatically up to V40; these values give a practical upper
// bound for user-facing hints.
const QR_V40_BYTE_CAPACITY = { L: 2953, M: 2331, Q: 1663, H: 1273 };

function getEncodeOptions() {
  return {
    mode: materialMode === 'gene' ? 'gene' : colorMode,
    icon: currentIcon,
    numFaces,
    independent: independentMode,
    errorLevel,
    geneColor,
    emptyFaceImage,
  };
}

function renderEncodedResults(results) {
  qrCanvases = [];
  const output = document.getElementById('qr-output');
  output.innerHTML = '';
  for (const { faceId, canvas } of results) {
    const cell = document.createElement('div');
    cell.className = 'qr-cell';
    cell.appendChild(canvas);
    const label = document.createElement('div');
    label.className = 'face-label';
    label.textContent = `${t('face')} ${faceId}`;
    cell.appendChild(label);
    output.appendChild(cell);
    qrCanvases.push(canvas);
  }
}

async function reencodeCurrent() {
  const input = document.getElementById('input-data').value.trim();
  if (!input) return;

  const { encodeToCubeCode } = await loadEncoderModule();
  const results = await encodeToCubeCode(input, getEncodeOptions());
  renderEncodedResults(results);

  if (showSingle) {
    renderSingleFace();
  }
  if (showCross) {
    renderCrossNet(crossContainer, qrCanvases, { mode: getEncodeOptions().mode, layout: netLayout });
  }
  if (cubeContainer.style.display !== 'none') {
    const cubeEl = document.getElementById('cube-3d');
    if (cube3d) cube3d.dispose();
    cubeEl.innerHTML = '';
    const { createCube } = await loadCube3dModule();
    cube3d = createCube(cubeEl, qrCanvases, { materialMode, geneColor });
      updateRubikControls();
  }
}

// --- i18n ---

function renderAppVersion() {
  const el = document.getElementById('app-version');
  if (!el) return;
  const version = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
  const commit = typeof __APP_COMMIT__ === 'string' ? __APP_COMMIT__ : 'dev';
  el.textContent = `v${version} · ${commit}`;
  el.title = `${t('versionInfo')}: v${version} (${commit})`;
}

function applyLang() {
  document.getElementById('title').textContent = t('title');
  document.getElementById('subtitle').textContent = t('subtitle');
  document.getElementById('tab-encode').textContent = t('tabEncode');
  document.getElementById('tab-decode').textContent = t('tabDecode');
  document.getElementById('input-data').placeholder = t('inputPlaceholder');
  document.getElementById('btn-encode').textContent = t('btnEncode');
  document.getElementById('btn-decode').textContent = t('btnDecode');
  document.getElementById('decode-mode-hint').textContent = plainScanMode ? t('plainModeHint') : t('cubeModeHint');
  document.getElementById('scan-label').textContent = t('scanned');
  document.getElementById('rotate-hint').textContent = t('rotateHint');
  document.getElementById('lang-switch').textContent = t('langSwitch');
  document.getElementById('btn-cross').textContent = showCross ? t('viewGrid') : t('viewCross');
  document.getElementById('btn-scan-mode').textContent = quickScanMode ? t('cameraMode') : t('quickScan');
  document.getElementById('btn-cube-mode').textContent = t('cubeQrScan');
  document.getElementById('btn-plain-mode').textContent = t('plainQrScan');
  document.getElementById('quickscan-hint').textContent = plainScanMode ? t('plainModeHint') : t('quickScanHint');
  document.getElementById('btn-color-mode').textContent = t(COLOR_MODE_KEYS[colorMode]);
  document.getElementById('btn-single').textContent = t('viewSingle');
  document.getElementById('btn-icon').textContent = currentIcon ? t('removeIcon') : t('addIcon');
  document.getElementById('btn-material').textContent = t(MATERIAL_MODE_KEYS[materialMode]);
  const dynamicIds = new Set(['btn-cross', 'btn-scan-mode', 'btn-cube-mode', 'btn-plain-mode', 'btn-color-mode', 'btn-single', 'btn-icon', 'btn-material']);
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (key && !dynamicIds.has(el.id)) {
      el.textContent = t(key);
    }
  });
  document.documentElement.lang = t('langSwitch') === 'EN' ? 'zh-CN' : 'en';
  renderAppVersion();
}

function getEffectiveErrorLevel() {
  return currentIcon ? 'H' : errorLevel;
}

function estimateCapacityBytes() {
  const qrCapacity = QR_V40_BYTE_CAPACITY[getEffectiveErrorLevel()] || QR_V40_BYTE_CAPACITY.M;

  if (independentMode) {
    // Independent mode stores the raw text in every used ordinary QR, so one
    // QR's byte capacity is the limiting factor.
    return qrCapacity;
  }

  // Normal mode stores binary face payloads as base64 text in QR codes.
  // Each face has a 2-byte face header before base64 expansion, and the full
  // reassembled payload has 4 bytes of protocol overhead.
  const perFaceChunkBytes = Math.max(0, Math.floor(qrCapacity / 4) * 3 - 2);
  return Math.max(0, perFaceChunkBytes * 6 - 4);
}

let capacityCheckSeq = 0;
let capacityCheckTimer = null;

function updateCapacityHint() {
  const inputEl = document.getElementById('input-data');
  const hint = document.getElementById('capacity-hint');
  if (!inputEl || !hint) return;

  const input = inputEl.value.trim();
  const byteLen = new TextEncoder().encode(input).length;
  const maxBytes = estimateCapacityBytes();
  const pct = maxBytes ? Math.min(999, Math.round((byteLen / maxBytes) * 100)) : 0;
  const approxOver = byteLen > maxBytes;

  hint.classList.toggle('over', approxOver);
  hint.textContent = `${approxOver ? t('capacityOver') : t('capacityOk')}: ${byteLen} / ${maxBytes} bytes (${t('approx')} ${pct}%)`;

  const seq = ++capacityCheckSeq;
  window.clearTimeout(capacityCheckTimer);
  if (!input) return;
  capacityCheckTimer = window.setTimeout(async () => {
    try {
      const analysis = await analyzeCurrentCapacity(input);
      if (seq !== capacityCheckSeq) return;
      renderCapacityAnalysis(analysis);
    } catch {
      // Keep the approximate hint if the lazy exact check fails.
    }
  }, 220);
}

async function analyzeCurrentCapacity(input = document.getElementById('input-data').value.trim()) {
  const { analyzeEncodeCapacity } = await loadEncoderModule();
  return analyzeEncodeCapacity(input, getEncodeOptions());
}

function renderCapacityAnalysis(analysis) {
  const hint = document.getElementById('capacity-hint');
  if (!hint) return;

  hint.classList.toggle('over', !analysis.ok);
  if (analysis.ok) {
    hint.textContent = `${t('capacityOk')}: ${analysis.byteLen} bytes · ${t('exactOk')} · QR V${analysis.worstVersion || '-'} · ${t('errorLevelShort')} ${analysis.effectiveErrorLevel}`;
    return;
  }

  hint.textContent = `${t('capacityOver')}: ${analysis.byteLen} bytes · ${t('exactFail')} · ${buildCapacitySuggestionText()}`;
}

function buildCapacitySuggestionText() {
  const suggestions = [];
  if (currentIcon) suggestions.push(t('suggestRemoveIcon'));
  if (getEffectiveErrorLevel() !== 'L') suggestions.push(t('suggestLowerError'));
  suggestions.push(t('suggestShorten'));
  if (!isSafeUrlOrDeepLink(document.getElementById('input-data').value.trim())) suggestions.push(t('suggestUseUrl'));
  return `${t('suggestions')}: ${suggestions.join(' / ')}`;
}

function setDecodedText(value = '') {
  const output = document.getElementById('decoded-output');
  decodedCopyText = String(value || '');
  output.textContent = decodedCopyText;
  updateCopyButton();
}

function clearDecodedOutput() {
  const output = document.getElementById('decoded-output');
  decodedCopyText = '';
  output.textContent = '';
  updateCopyButton();
}

function getDecodedPlainText() {
  return decodedCopyText.trim();
}

function updateCopyButton() {
  const copyButton = document.getElementById('btn-copy-output');
  if (!copyButton) return;
  copyButton.hidden = !getDecodedPlainText();
}

let toastTimer = null;
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2200);
}

function renderDecodedOutput(output, decoded) {
  decodedCopyText = '';
  output.textContent = '';
  updateCopyButton();

  if (decoded?.dataType === DATA_TYPE_URL && isSafeUrlOrDeepLink(decoded.data)) {
    renderUrlOrDeepLink(output, decoded.data);
    return;
  }

  decodedCopyText = decoded?.data ?? '';
  output.textContent = decodedCopyText;
  updateCopyButton();
}

function renderPlainQrOutput(output, data) {
  decodedCopyText = '';
  output.textContent = '';

  if (isSafeUrlOrDeepLink(data)) {
    renderUrlOrDeepLink(output, data);
    return;
  }

  decodedCopyText = String(data || '');
  output.textContent = decodedCopyText;
  updateCopyButton();
}

function renderUrlOrDeepLink(output, value) {
  const url = String(value || '').trim();
  decodedCopyText = url;
  const wrap = document.createElement('div');
  wrap.className = 'decoded-url';

  const link = document.createElement('a');
  link.href = url;
  link.textContent = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.addEventListener('click', async (event) => {
    event.preventDefault();
    await confirmAndOpenExternalUrl(url);
  });

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = t('openLinkOrApp');
  button.addEventListener('click', () => {
    confirmAndOpenExternalUrl(url);
  });

  wrap.appendChild(link);
  wrap.appendChild(button);
  output.appendChild(wrap);
  updateCopyButton();
}

let pendingExternalUrl = '';

async function confirmAndOpenExternalUrl(url) {
  const ok = await showExternalLinkConfirm(url);
  if (ok) {
    window.location.href = url;
  }
}

function showExternalLinkConfirm(url) {
  const modal = document.getElementById('external-link-modal');
  if (!modal) return Promise.resolve(window.confirm(url));

  const info = getExternalUrlInfo(url);
  pendingExternalUrl = info.raw;
  document.getElementById('external-link-message').textContent = info.isWeb ? t('externalWebMessage') : t('externalAppMessage');
  document.getElementById('external-link-scheme').textContent = info.scheme;
  document.getElementById('external-link-host').textContent = info.host || info.pathname || info.raw;
  document.getElementById('external-link-warning').textContent = info.isKnownExternal ? t('externalKnownWarning') : t('externalUnknownWarning');

  const fallbackRow = document.getElementById('external-link-fallback-row');
  const fallback = document.getElementById('external-link-fallback');
  const fallbackButton = document.getElementById('external-link-fallback-open');
  fallbackRow.hidden = !info.fallbackUrl;
  fallbackButton.hidden = !info.fallbackUrl;
  fallback.textContent = info.fallbackUrl || '';

  modal.hidden = false;

  return new Promise((resolve) => {
    const cancel = document.getElementById('external-link-cancel');
    const confirm = document.getElementById('external-link-confirm');
    const fallbackButton = document.getElementById('external-link-fallback-open');

    const cleanup = (value) => {
      modal.hidden = true;
      cancel.removeEventListener('click', onCancel);
      confirm.removeEventListener('click', onConfirm);
      fallbackButton.removeEventListener('click', onFallback);
      modal.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKeydown);
      resolve(value);
    };
    const onCancel = () => cleanup(false);
    const onConfirm = () => cleanup(pendingExternalUrl === info.raw);
    const onFallback = () => {
      if (info.fallbackUrl) {
        window.location.href = info.fallbackUrl;
        cleanup(false);
      }
    };
    const onBackdrop = (event) => {
      if (event.target === modal) cleanup(false);
    };
    const onKeydown = (event) => {
      if (event.key === 'Escape') cleanup(false);
    };

    cancel.addEventListener('click', onCancel);
    confirm.addEventListener('click', onConfirm);
    fallbackButton.addEventListener('click', onFallback);
    modal.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKeydown);
  });
}


let applyServiceWorkerUpdate = null;

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    showPwaUpdatePrompt();
  },
  onOfflineReady() {
    showToast(t('offlineReady'), 'success');
  },
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      window.setInterval(() => registration.update(), 60 * 60 * 1000);
    }
  },
  onRegisterError(error) {
    console.warn('Service worker registration failed', error);
  },
});
applyServiceWorkerUpdate = updateSW;

function showPwaUpdatePrompt() {
  const banner = document.getElementById('update-banner');
  if (banner) banner.hidden = false;
}

function hidePwaUpdatePrompt() {
  const banner = document.getElementById('update-banner');
  if (banner) banner.hidden = true;
}

document.getElementById('update-refresh')?.addEventListener('click', () => {
  if (applyServiceWorkerUpdate) applyServiceWorkerUpdate(true);
});

document.getElementById('update-dismiss')?.addEventListener('click', hidePwaUpdatePrompt);


if (import.meta.env.DEV) {
  window.__cubeCodeTestHooks = {
    showPwaUpdatePrompt,
    showExternalLinkConfirm,
    shouldUsePwaOfflineBanner,
  };
}

document.getElementById('lang-switch').addEventListener('click', () => {
  toggleLang();
  applyLang();
});

applyLang();
updateCapacityHint();
setupPwaOfflineBanner();

document.getElementById('input-data').addEventListener('input', updateCapacityHint);

function setupPwaOfflineBanner() {
  if (!shouldUsePwaOfflineBanner()) {
    setOfflineState(false);
    return;
  }

  checkNetworkReachable();
  window.addEventListener('online', () => checkNetworkReachable());
  window.addEventListener('offline', () => setOfflineState(true));
  document.getElementById('offline-retry')?.addEventListener('click', () => {
    checkNetworkReachable({ reloadOnSuccess: true });
  });
  window.setInterval(() => checkNetworkReachable(), 15000);
}

function shouldUsePwaOfflineBanner() {
  // The in-app offline banner is only useful for an installed browser PWA.
  // In Capacitor's Android WebView all assets are bundled locally; probing a
  // fake network URL can fail on launch and incorrectly report "offline".
  if (isCapacitorNativeShell()) return false;
  return isInstalledPwa();
}

function isCapacitorNativeShell() {
  return Boolean(window.Capacitor)
    || window.location.protocol === 'capacitor:'
    || window.location.protocol === 'ionic:';
}

function isInstalledPwa() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.matchMedia?.('(display-mode: fullscreen)').matches
    || window.navigator.standalone === true;
}

function setOfflineState(isOffline) {
  const banner = document.getElementById('offline-banner');
  if (banner) {
    banner.hidden = !isOffline;
  }
}

async function checkNetworkReachable({ reloadOnSuccess = false } = {}) {
  const controller = new window.AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6000);

  try {
    const pingUrl = new URL('__network-check__', window.location.origin + import.meta.env.BASE_URL);
    pingUrl.searchParams.set('t', Date.now().toString());

    // Do not trust navigator.onLine: some browsers report false while online,
    // and some report true after the network is gone. This request intentionally
    // targets a non-cached URL; any HTTP response means the network is reachable.
    await window.fetch(pingUrl.href, {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    });

    setOfflineState(false);
    if (reloadOnSuccess) window.location.reload();
  } catch {
    setOfflineState(true);
  } finally {
    window.clearTimeout(timeout);
  }
}

// --- Tab switching ---
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

// --- Face count selector ---
const faceCountSelect = document.getElementById('face-count');
faceCountSelect.disabled = true;
faceCountSelect.addEventListener('change', (e) => {
  numFaces = parseInt(e.target.value, 10);
  updateCapacityHint();
});

// --- Independent mode toggle ---
const independentModeCheckbox = document.getElementById('independent-mode');
independentModeCheckbox.addEventListener('change', (e) => {
  independentMode = e.target.checked;
  faceCountSelect.disabled = !independentMode;
  const emptyFaceButton = document.getElementById('btn-empty-face');
  if (emptyFaceButton) {
    emptyFaceButton.style.display = independentMode ? '' : 'none';
  }
  if (!independentMode) {
    numFaces = 6;
    faceCountSelect.value = '6';
  }
  updateCapacityHint();
});

// --- Error level selector ---
const errorLevelSelect = document.getElementById('error-level');
errorLevelSelect.addEventListener('change', (e) => {
  errorLevel = e.target.value;
  updateCapacityHint();
});

// --- Face navigation buttons ---
document.querySelectorAll('.face-nav button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const face = btn.dataset.face;
    if (cube3d && face) {
      cube3d.snapToFace(face);
    }
  });
});

// --- Encode ---
const btnEncode = document.getElementById('btn-encode');
const btnCross = document.getElementById('btn-cross');
const btnSave = document.getElementById('btn-save');
const btnStickerPack = document.getElementById('btn-sticker-pack');
const btnSingle = document.getElementById('btn-single');
const toolbar = document.getElementById('encode-toolbar');
const cubeContainer = document.getElementById('cube-container');
const crossContainer = document.getElementById('cross-container');
const singleContainer = document.getElementById('single-container');
const singleQr = document.getElementById('single-qr');
const faceCounter = document.getElementById('face-counter');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const rubikControls = document.getElementById('rubik-controls');

btnEncode.addEventListener('click', async () => {
  const input = document.getElementById('input-data').value.trim();
  if (!input) return;

  const output = document.getElementById('qr-output');
  output.innerHTML = t('generating');
  cubeContainer.style.display = 'none';
  updateRubikControls();
  crossContainer.style.display = 'none';
  singleContainer.style.display = 'none';
  toolbar.style.display = 'none';
  showSingle = false;
  btnSingle.classList.remove('active');

  try {
    const { encodeToCubeCode, analyzeEncodeCapacity } = await loadEncoderModule();
    const analysis = analyzeEncodeCapacity(input, getEncodeOptions());
    renderCapacityAnalysis(analysis);
    if (!analysis.ok) {
      output.innerHTML = `${t('capacityOver')}: ${t('exactFail')}<br>${buildCapacitySuggestionText()}`;
      return;
    }

    const results = await encodeToCubeCode(input, getEncodeOptions());
    output.innerHTML = '';

    if (cube3d) {
      cube3d.dispose();
      cube3d = null;
    }

    renderEncodedResults(results);
    updateRubikControls();

    toolbar.style.display = 'flex';

    if (showCross) {
      crossContainer.style.display = 'block';
      renderCrossNet(crossContainer, qrCanvases, { mode: getEncodeOptions().mode, layout: netLayout });
    } else {
      cubeContainer.style.display = 'block';
      const cubeEl = document.getElementById('cube-3d');
      cubeEl.innerHTML = '';
      const { createCube } = await loadCube3dModule();
      cube3d = createCube(cubeEl, qrCanvases, { materialMode, geneColor });
    }
  } catch (err) {
    output.innerHTML = `${t('error')}: ${err.message}`;
  }
});

// Single face view
function updateRubikControls() {
  if (rubikControls) rubikControls.hidden = materialMode !== 'rubik' || qrCanvases.length === 0 || cubeContainer.style.display === 'none';
}

function renderSingleFace() {
  if (qrCanvases.length === 0) return;
  singleQr.innerHTML = '';
  const src = qrCanvases[singleFaceIdx];
  const img = document.createElement('img');
  img.src = src.toDataURL('image/png');
  img.style.maxWidth = '280px';
  img.style.width = '100%';
  singleQr.appendChild(img);
  faceCounter.textContent = `${singleFaceIdx + 1} / ${qrCanvases.length}`;
  btnPrev.disabled = singleFaceIdx === 0;
  btnNext.disabled = singleFaceIdx === qrCanvases.length - 1;
}

async function renderCubeView() {
  if (qrCanvases.length === 0) return;
  if (cube3d) { cube3d.dispose(); cube3d = null; }
  cubeContainer.style.display = 'block';
  updateRubikControls();
  const cubeEl = document.getElementById('cube-3d');
  cubeEl.innerHTML = '';
  const { createCube } = await loadCube3dModule();
  cube3d = createCube(cubeEl, qrCanvases, { materialMode, geneColor });
}

btnSingle.addEventListener('click', async () => {
  showSingle = !showSingle;
  btnSingle.classList.toggle('active', showSingle);

  if (showSingle) {
    showCross = false;
    btnCross.classList.remove('active');
    if (cube3d) { cube3d.dispose(); cube3d = null; }
    cubeContainer.style.display = 'none';
    updateRubikControls();
    crossContainer.style.display = 'none';
    singleContainer.style.display = 'flex';
    document.getElementById('qr-output').style.display = 'none';
    singleFaceIdx = 0;
    renderSingleFace();
  } else {
    singleContainer.style.display = 'none';
    document.getElementById('qr-output').style.display = '';
    if (showCross) {
      crossContainer.style.display = 'block';
    } else {
      await renderCubeView();
    }
  }
});

btnPrev.addEventListener('click', () => {
  if (singleFaceIdx > 0) { singleFaceIdx--; renderSingleFace(); }
});

btnNext.addEventListener('click', () => {
  if (singleFaceIdx < qrCanvases.length - 1) { singleFaceIdx++; renderSingleFace(); }
});

// Cross net toggle
btnCross.addEventListener('click', async () => {
  showCross = !showCross;
  showSingle = false;
  btnSingle.classList.remove('active');
  btnCross.textContent = showCross ? t('viewGrid') : t('viewCross');
  btnCross.classList.toggle('active', showCross);
  singleContainer.style.display = 'none';
  document.getElementById('qr-output').style.display = '';

  if (showCross) {
    if (cube3d) { cube3d.dispose(); cube3d = null; }
    cubeContainer.style.display = 'none';
    updateRubikControls();
    crossContainer.style.display = 'block';
    renderCrossNet(crossContainer, qrCanvases, { mode: getEncodeOptions().mode, layout: netLayout });
  } else {
    crossContainer.style.display = 'none';
    await renderCubeView();
  }
});

// Color mode toggle
const btnColorMode = document.getElementById('btn-color-mode');
const netLayoutSelect = document.getElementById('net-layout');
netLayoutSelect.addEventListener('change', () => {
  netLayout = netLayoutSelect.value;
  if (showCross && qrCanvases.length > 0) {
    renderCrossNet(crossContainer, qrCanvases, { mode: getEncodeOptions().mode, layout: netLayout });
  }
});

btnColorMode.addEventListener('click', async () => {
  const idx = COLOR_MODES.indexOf(colorMode);
  colorMode = COLOR_MODES[(idx + 1) % COLOR_MODES.length];
  btnColorMode.textContent = t(COLOR_MODE_KEYS[colorMode]);

  if (qrCanvases.length === 0) return;

  const input = document.getElementById('input-data').value.trim();
  if (!input) return;

  await reencodeCurrent();
});

// Icon upload
const btnIcon = document.getElementById('btn-icon');
const iconInput = document.getElementById('icon-input');
const btnEmptyFace = document.getElementById('btn-empty-face');
const emptyFaceInput = document.getElementById('empty-face-input');

btnIcon.addEventListener('click', () => {
  if (currentIcon) {
    currentIcon = null;
    btnIcon.classList.remove('active');
    btnIcon.textContent = t('addIcon');
    updateCapacityHint();

    if (document.getElementById('input-data').value.trim() && qrCanvases.length > 0) {
      reencodeWithIcon();
    }
    return;
  }

  iconInput.click();
});

iconInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const img = new Image();
  img.onload = () => {
    currentIcon = img;
    btnIcon.classList.add('active');
    btnIcon.textContent = t('removeIcon');
    updateCapacityHint();

    // Re-encode with icon if data exists
    const input = document.getElementById('input-data').value.trim();
    if (input && qrCanvases.length > 0) {
      reencodeWithIcon();
    }
  };
  img.src = URL.createObjectURL(file);
  iconInput.value = '';
});

btnEmptyFace.addEventListener('click', () => {
  emptyFaceInput.click();
});

emptyFaceInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const img = new Image();
  img.onload = () => {
    emptyFaceImage = img;
    btnEmptyFace.classList.add('active');

    const input = document.getElementById('input-data').value.trim();
    if (input && qrCanvases.length > 0 && independentMode) {
      reencodeCurrent();
    }
  };
  img.src = URL.createObjectURL(file);
  emptyFaceInput.value = '';
});

async function reencodeWithIcon() {
  const input = document.getElementById('input-data').value.trim();
  if (!input) return;

  await reencodeCurrent();
}

// Material mode toggle (standard/glass/gene)
const btnMaterial = document.getElementById('btn-material');
btnMaterial.addEventListener('click', async () => {
  const idx = MATERIAL_MODES.indexOf(materialMode);
  materialMode = MATERIAL_MODES[(idx + 1) % MATERIAL_MODES.length];
  btnMaterial.textContent = t(MATERIAL_MODE_KEYS[materialMode]);
  btnMaterial.classList.toggle('active', materialMode !== 'standard');
  updateRubikControls();

  // Show/hide gene color picker
  const geneColorPicker = document.getElementById('gene-color-picker');
  if (geneColorPicker) {
    geneColorPicker.style.display = materialMode === 'gene' ? 'flex' : 'none';
  }

  // Gene material owns the flat QR palette too, so re-encode when switching
  // into/out of it to keep the 2D QR list consistent with purple/red/blue.
  if (qrCanvases.length > 0) {
    await reencodeCurrent();
  }
});

// Gene color picker
const geneColorPicker = document.getElementById('gene-color-picker');
if (geneColorPicker) {
  geneColorPicker.addEventListener('click', async (e) => {
    const btn = e.target.closest('.gene-color-btn');
    if (!btn) return;

    geneColor = btn.dataset.color;

    // Update active state
    geneColorPicker.querySelectorAll('.gene-color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Update cube and flat QR colors with new gene color
    if (qrCanvases.length > 0 && materialMode === 'gene') {
      await reencodeCurrent();
    }
  });
}

// Save cross net as image
rubikControls?.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-turn]');
  if (!button || !cube3d?.twist) return;
  cube3d.twist(button.dataset.turn);
});

btnSave.addEventListener('click', () => {
  if (qrCanvases.length === 0) return;
  downloadCrossNet(qrCanvases, getEncodeOptions().mode, netLayout);
});

btnStickerPack.addEventListener('click', async () => {
  if (qrCanvases.length === 0) return;
  const { downloadStickerPack } = await loadStickerPackModule();
  downloadStickerPack(qrCanvases);
});

// --- Decode ---
const scannedPayloads = [];
let scanner = null;

const faceIndicators = document.getElementById('scanned-faces');
for (let i = 1; i <= 6; i++) {
  const dot = document.createElement('div');
  dot.className = 'face-dot';
  dot.textContent = i;
  dot.dataset.face = i;
  faceIndicators.appendChild(dot);
}

const btnDecode = document.getElementById('btn-decode');
const btnCubeMode = document.getElementById('btn-cube-mode');
const btnScanMode = document.getElementById('btn-scan-mode');
const btnPlainMode = document.getElementById('btn-plain-mode');
const btnUpload = document.getElementById('btn-upload');
const fileInput = document.getElementById('file-input');
const decodeSection = document.getElementById('decode');
const quickscanOverlay = document.getElementById('quickscan-overlay');
const quickscanHint = document.getElementById('quickscan-hint');
const scanStatus = document.getElementById('scan-status');
const copyOutputButton = document.getElementById('btn-copy-output');
const btnReset = document.getElementById('btn-reset');

function setPlainScanMode(enabled) {
  plainScanMode = enabled;
  if (plainScanMode) {
    quickScanMode = false;
  }
  updateDecodeModeUi();
  resetScanState({ resetScanner: false });
  stopCamera();
  startCamera(quickScanMode);
}

function updateDecodeModeUi() {
  btnCubeMode.classList.toggle('active', !plainScanMode);
  btnPlainMode.classList.toggle('active', plainScanMode);
  btnScanMode.textContent = quickScanMode ? t('cameraMode') : t('quickScan');
  btnScanMode.classList.toggle('active', quickScanMode);
  btnScanMode.hidden = plainScanMode;
  btnDecode.hidden = plainScanMode;
  btnReset.hidden = plainScanMode;
  scanStatus.hidden = plainScanMode;
  quickscanOverlay.style.display = quickScanMode && !plainScanMode ? 'block' : 'none';
  quickscanHint.style.display = quickScanMode || plainScanMode ? 'block' : 'none';
  quickscanHint.textContent = plainScanMode ? t('plainModeHint') : t('quickScanHint');
  document.getElementById('decode-mode-hint').textContent = plainScanMode ? t('plainModeHint') : t('cubeModeHint');
}

btnCubeMode.addEventListener('click', () => {
  if (plainScanMode) setPlainScanMode(false);
});

// Quick scan mode toggle
btnScanMode.addEventListener('click', () => {
  quickScanMode = !quickScanMode;
  updateDecodeModeUi();

  // Restart scanner with new mode and avoid mixing faces from the previous mode.
  resetScanState({ resetScanner: false });
  stopCamera();
  startCamera(quickScanMode);
});

// Plain QR mode: scan ordinary QR codes and display raw text directly.
btnPlainMode.addEventListener('click', () => {
  if (!plainScanMode) setPlainScanMode(true);
});

copyOutputButton.addEventListener('click', async () => {
  const text = getDecodedPlainText();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast(t('copied'), 'success');
  } catch {
    showToast(t('copyFailed'), 'error');
  }
});

updateDecodeModeUi();

// Upload image for scanning
btnUpload.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const img = new Image();
  img.onload = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const output = document.getElementById('decoded-output');

    if (plainScanMode) {
      const { scanPlain } = await loadQuickscanModule();
      const result = scanPlain(canvas);
      if (result.found) {
        renderPlainQrOutput(output, result.data);
      } else {
        setDecodedText(t('plainQrNotFound'));
      }
      fileInput.value = '';
      return;
    }

    const { scanCrossNet } = await loadQuickscanModule();
    const result = scanCrossNet(canvas);

    // Uploading an image is treated as a fresh batch scan, even if no face is
    // found. Otherwise old scan dots/count can make a failed upload look like
    // it contributed data.
    resetScanState({ resetScanner: false });

    if (result.found > 0) {
      // Uploading an image is treated as a fresh batch scan. Otherwise a second
      // uploaded net with the same face ids would be deduplicated against the
      // previous result and the decoded text would appear stuck until users
      // manually press "重新扫描". Camera scanning still keeps incremental
      // one-face-at-a-time behavior.
      replaceScannedPayloadBatch(scannedPayloads, result.payloads);
      updateScanCount();

      // Auto-decode if all faces found
      if (scannedPayloads.length >= numFaces) {
        const decoded = decodeCubeCode(scannedPayloads, numFaces);
        if (decoded.success) {
          renderDecodedOutput(output, decoded);
        }
      } else {
        clearDecodedOutput();
      }
    } else {
      setDecodedText(t('noFaces'));
    }

    fileInput.value = '';
  };
  img.src = URL.createObjectURL(file);
});

// Decode button
btnReset.addEventListener('click', () => {
  resetScanState();
});

function resetScanState({ resetScanner = true } = {}) {
  resetScannedPayloads(scannedPayloads);
  document.getElementById('scan-count').textContent = `0 / ${numFaces}`;
  clearDecodedOutput();
  document.querySelectorAll('.face-dot').forEach((d) => d.classList.remove('scanned'));
  if (resetScanner && scanner) { scanner.reset(); }
}

btnDecode.addEventListener('click', () => {
  const output = document.getElementById('decoded-output');

  if (scannedPayloads.length === 0) {
    setDecodedText(t('noFaces'));
    return;
  }

  const decoded = decodeCubeCode(scannedPayloads, numFaces);

  if (decoded.success) {
    renderDecodedOutput(output, decoded);
  } else if (decoded.missingFaces.length > 0) {
    setDecodedText(`${t('missingFaces')}: ${decoded.missingFaces.join(', ')}`);
  } else {
    setDecodedText(`${t('error')}: ${decoded.error}`);
  }
});

const observer = new MutationObserver(() => {
  if (decodeSection.classList.contains('active')) {
    if (!scanner) startCamera(quickScanMode);
  } else {
    stopCamera();
  }
});
observer.observe(decodeSection, { attributes: true, attributeFilter: ['class'] });

let scannerStartToken = 0;

function stopCamera() {
  scannerStartToken += 1;
  if (scanner) {
    scanner.stop();
    scanner = null;
  }
}

async function startCamera(quick = false) {
  const token = scannerStartToken + 1;
  scannerStartToken = token;
  const video = document.getElementById('camera-feed');
  const canvas = document.getElementById('scan-canvas');

  try {
    const { startScanner } = await loadScannerModule();
    if (token !== scannerStartToken || !decodeSection.classList.contains('active')) return;

    const nextScanner = startScanner(video, canvas, (_payloadBytes, faceId) => {
      if (plainScanMode) {
        renderPlainQrOutput(document.getElementById('decoded-output'), _payloadBytes);
        return;
      }

      const change = upsertScannedPayload(scannedPayloads, faceId, _payloadBytes);
      if (change === 'unchanged') return;

      updateScanCount();

      // Auto-decode when all 6 faces found
      if (scannedPayloads.length >= numFaces) {
        const decoded = decodeCubeCode(scannedPayloads, numFaces);
        if (decoded.success) {
          renderDecodedOutput(document.getElementById('decoded-output'), decoded);
        } else if (change === 'replaced') {
          clearDecodedOutput();
        }
      }
    }, { quick, plain: plainScanMode });

    if (token !== scannerStartToken || !decodeSection.classList.contains('active')) {
      nextScanner.stop();
      return;
    }
    scanner = nextScanner;
  } catch (err) {
    if (token === scannerStartToken && decodeSection.classList.contains('active')) {
      showToast(`${t('cameraError')}: ${err.message}`, 'error');
    }
  }
}

function updateScanCount() {
  document.getElementById('scan-count').textContent = `${scannedPayloads.length} / ${numFaces}`;

  document.querySelectorAll('.face-dot').forEach((d) => d.classList.remove('scanned'));
  for (const payload of scannedPayloads) {
    const faceId = extractFaceIdFromPayload(payload);
    const dot = document.querySelector(`.face-dot[data-face="${faceId}"]`);
    if (dot) dot.classList.add('scanned');
  }
}
