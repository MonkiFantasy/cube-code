import { describe, expect, it } from 'vitest';
import { getExternalUrlInfo, isSafeUrlOrDeepLink } from '../src/url-utils.js';

describe('url utils', () => {
  it('allows web URLs and common deep links', () => {
    expect(isSafeUrlOrDeepLink('https://example.com/a')).toBe(true);
    expect(isSafeUrlOrDeepLink('mailto:test@example.com')).toBe(true);
    expect(isSafeUrlOrDeepLink('myapp://open?id=1')).toBe(true);
  });

  it('blocks dangerous schemes', () => {
    expect(isSafeUrlOrDeepLink('javascript:alert(1)')).toBe(false);
    expect(isSafeUrlOrDeepLink('data:text/html,hi')).toBe(false);
    expect(isSafeUrlOrDeepLink('file:///etc/passwd')).toBe(false);
  });

  it('extracts external link confirmation details', () => {
    const info = getExternalUrlInfo('myapp://open/cube?id=42');
    expect(info).toMatchObject({ scheme: 'myapp', host: 'open', isAppLink: true, isKnownExternal: false });
  });

  it('extracts Android intent fallback URL', () => {
    const info = getExternalUrlInfo('intent://scan/#Intent;scheme=zxing;S.browser_fallback_url=https%3A%2F%2Fexample.com%2Ffallback;end');
    expect(info.scheme).toBe('intent');
    expect(info.fallbackUrl).toBe('https://example.com/fallback');
  });
});
