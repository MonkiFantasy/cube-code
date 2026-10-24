import { expect, test } from '@playwright/test';

test('plain QR mode hides cube-only controls', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '解码' }).click({ force: true });
  await page.getByRole('button', { name: '普通二维码' }).click({ force: true });

  await expect(page.getByText('普通二维码扫到即显示，不需要六面重组。').first()).toBeVisible();
  await expect(page.getByRole('button', { name: '重组数据' })).toBeHidden();
  await expect(page.getByRole('button', { name: '重新扫描' })).toBeHidden();
});

test('capacity hint uses exact qrcode check', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('输入要编码的数据...').fill('hello cube code');
  await expect(page.locator('#capacity-hint')).toContainText('实际可生成');
});

test('external link modal shows intent fallback action', async ({ page }) => {
  await page.goto('/');
  const intentUrl = 'intent://scan/#Intent;scheme=zxing;S.browser_fallback_url=https%3A%2F%2Fexample.com%2Ffallback;end';
  await page.evaluate((url) => { window.__cubeCodeTestHooks.showExternalLinkConfirm(url); }, intentUrl);

  await expect(page.getByRole('heading', { name: '打开外部链接？' })).toBeVisible();
  await expect(page.locator('#external-link-scheme')).toHaveText('intent');
  await expect(page.locator('#external-link-fallback')).toContainText('https://example.com/fallback');
  await expect(page.getByRole('button', { name: '打开备用网页' })).toBeVisible();
  await page.getByRole('button', { name: '取消' }).click({ force: true });
});

test('PWA update prompt can be shown and dismissed', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.__cubeCodeTestHooks.showPwaUpdatePrompt());
  await expect(page.getByText('发现新版本')).toBeVisible();
  await page.getByRole('button', { name: '稍后' }).click({ force: true });
  await expect(page.locator('#update-banner')).toBeHidden();
});


test('shows app version and build hash', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#app-version')).toContainText('v0.1.0');
});


test('offline banner is disabled in normal browser tab', async ({ page }) => {
  await page.goto('/');
  await expect(page.evaluate(() => window.__cubeCodeTestHooks.shouldUsePwaOfflineBanner())).resolves.toBe(false);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.locator('#offline-banner')).toBeHidden();
});
