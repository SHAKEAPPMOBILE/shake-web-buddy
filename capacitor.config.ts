import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shakeapp.shakeapp',
  appName: 'SHAKE',
  webDir: 'dist',
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    CapacitorPurchases: {
      androidKey: 'YOUR_GOOGLE_PLAY_PUBLIC_KEY', // Add later
      iosKey: 'YOUR_APPLE_APP_STORE_KEY', // Add later
    }
  },
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
};

export default config;