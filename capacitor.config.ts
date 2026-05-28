import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.monkifantasy.cube-code',
  appName: 'Cube Code',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Camera: {
      // Camera permissions for QR scanning
    },
    Filesystem: {
      // Filesystem permissions for saving QR images
    },
  },
};

export default config;
