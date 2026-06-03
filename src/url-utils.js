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

const WEB_PROTOCOLS = new Set(['http:', 'https:']);
const KNOWN_EXTERNAL_PROTOCOLS = new Set(['mailto:', 'tel:', 'sms:', 'geo:', 'market:', 'intent:']);

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

export function getExternalUrlInfo(value) {
  const raw = String(value || '').trim();
  const url = new URL(raw);
  const protocol = url.protocol.toLowerCase();
  const fallbackUrl = protocol === 'intent:' ? extractIntentFallback(raw) : '';

  return {
    raw,
    protocol,
    scheme: protocol.replace(':', ''),
    host: url.host || '',
    pathname: url.pathname || '',
    isWeb: WEB_PROTOCOLS.has(protocol),
    isKnownExternal: KNOWN_EXTERNAL_PROTOCOLS.has(protocol) || WEB_PROTOCOLS.has(protocol),
    isAppLink: !WEB_PROTOCOLS.has(protocol),
    fallbackUrl,
  };
}

function extractIntentFallback(value) {
  const match = String(value).match(/S\.browser_fallback_url=([^;]+)/);
  if (!match) return '';

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}
