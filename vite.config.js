import { defineConfig } from 'vite';
import fs from 'fs';

const httpsConfig = fs.existsSync('.certs/key.pem')
  ? {
      key: fs.readFileSync('.certs/key.pem'),
      cert: fs.readFileSync('.certs/cert.pem'),
    }
  : undefined;

export default defineConfig({
  base: process.env.BASE_PATH || '/cube-code/',
  server: {
    host: '0.0.0.0',
    https: httpsConfig,
  },
  test: {
    globals: true,
  },
});
