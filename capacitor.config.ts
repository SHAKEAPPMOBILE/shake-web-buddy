import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shakeapp.shakeapp',
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