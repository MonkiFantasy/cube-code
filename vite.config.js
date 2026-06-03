import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';

const httpsConfig = fs.existsSync('.certs/key.pem')
  ? {
      key: fs.readFileSync('.certs/key.pem'),
      cert: fs.readFileSync('.certs/cert.pem'),
    }
  : undefined;

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifestFilename: 'manifest.json',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: '魔方码 - 3D QR Code',
        short_name: 'Cube Code',
        description: '3D QR code system - encode data across six faces of a cube',
        start_url: '.',
        scope: '.',
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
        globPatterns: ['**/*.{js,css,html,png,svg,ico,json}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'cube-code-html',
            },
          },
          {
            urlPattern: ({ request }) => ['style', 'script', 'worker'].includes(request.destination),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'cube-code-assets',
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'cube-code-images',
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    https: httpsConfig,
  },
  test: {
    globals: true,
  },
});
