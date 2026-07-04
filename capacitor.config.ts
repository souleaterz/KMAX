import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kmax.streaming',
  appName: 'KMAX',
  webDir: 'dist',
  backgroundColor: '#08080a',
  android: {
    allowMixedContent: false,
  },
};

export default config;
