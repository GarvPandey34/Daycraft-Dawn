export interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  server?: {
    androidScheme?: string;
  };
  plugins?: Record<string, unknown>;
}

const config: CapacitorConfig = {
  appId: 'com.daycraft.app',
  appName: 'Daycraft',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#C86D51',
      sound: 'beep.wav',
    },
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      androidIsEncryption: false,
    },
  },
};

export default config;
