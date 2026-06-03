const BLOCKED_URL_PROTOCOLS = new Set([
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
  'blob:',
  'about:',
  'chrome:',
  'edge:',
  'devtools:',
]);

/**
 * Returns true for normal web URLs and app deep links such as:
 * - https://example.com
 * - myapp://open?id=1
 * - intent://scan/#Intent;scheme=zxing;package=com.google.zxing.client.android;end
 * - mailto:test@example.com
 * - tel:+123456789
 */
export function isSafeUrlOrDeepLink(value) {
  const text = String(value || '').trim();
  if (!text) return false;

  try {
    const url = new URL(text);
    return isAllowedProtocol(url.protocol);
  } catch {
    return false;
  }
}

export function isAllowedProtocol(protocol) {
  const normalized = String(protocol || '').toLowerCase();
  if (!normalized || BLOCKED_URL_PROTOCOLS.has(normalized)) return false;

  // Require a real URL scheme like `myapp:`. This blocks plain text and keeps
  // app links possible without maintaining a huge per-app whitelist.
  return /^[a-z][a-z0-9+.-]*:$/.test(normalized);
}
