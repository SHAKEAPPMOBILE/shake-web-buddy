import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shake.app',
  appName: 'SHAKE',
  webDir: 'dist',
  plugins: {
    CapacitorPurchases: {
      androidKey: 'YOUR_GOOGLE_PLAY_PUBLIC_KEY', // Add later
      iosKey: 'YOUR_APPLE_APP_STORE_KEY', // Add later
    }
  }
};

export default config;