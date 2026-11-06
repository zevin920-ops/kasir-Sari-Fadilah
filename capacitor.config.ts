import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "id.ruangkasir.app",
  appName: "RuangKasir",
  webDir: "dist",
  bundledWebRuntime: false,
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: "Library/CapacitorDatabase",
      androidIsEncryption: false
    }
  }
};
export default config;
