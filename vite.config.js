import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import { execSync } from 'child_process';
import packageJson from './package.json' with { type: 'json' };

const httpsConfig = !process.env.NO_HTTPS && fs.existsSync('.certs/key.pem')
  ? {
      key: fs.readFileSync('.certs/key.pem'),
      cert: fs.readFileSync('.certs/cert.pem'),
    }
  : undefined;
const basePath = process.env.BASE_PATH || '/';
const normalizedBase = basePath === '/'
  ? 'root'
  : basePath.replace(/^\/|\/$/g, '').replaceAll('/', '-') || 'root';
const isDevPath = normalizedBase !== 'root';
const gitCommit = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
})();

export default defineConfig({
  base: basePath,
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __APP_COMMIT__: JSON.stringify(gitCommit),
  },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      manifestFilename: 'manifest.json',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: '魔方码 - 3D QR Code',
        short_name: isDevPath ? 'Cube Dev' : 'Cube Code',
        description: '3D QR code system - encode data across six faces of a cube',
        id: basePath,
        start_url: basePath,
        scope: basePath,
        display: 'standalone',
        background_color: '#f5f5f5',
        theme_color: '#333333',
        orientation: 'portrait-primary',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/__network-check__/],
        globPatterns: ['**/*.{js,css,html,png,svg,ico,json}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => ['style', 'script', 'worker'].includes(request.destination),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: `cube-code-assets-${normalizedBase}`,
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: `cube-code-images-${normalizedBase}`,
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  build: {
    // After lazy loading, the only >500 kB file is the optional Three.js core
    // chunk loaded when users open 3D view. Keep warnings focused on chunks
    // that exceed that known vendor cost.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) {
            if (id.includes('/examples/jsm/')) return 'three-addons';
            return 'three-core';
          }
          if (id.includes('/node_modules/jsqr/')) return 'jsQR';
          if (id.includes('/node_modules/qrcode/')) return 'qrcode';
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    https: httpsConfig,
  },
  test: {
    globals: true,
    exclude: ['node_modules/**', 'dist/**', 'e2e/**', 'test-results/**'],
  },
});
