// @ts-nocheck
import type { CapacitorConfig } from "@capacitor/cli";

/**
 * اگر متغیر CAPACITOR_SERVER_URL تنظیم شده باشد، اپ مستقیماً نسخه وب را بارگذاری می‌کند.
 * در غیر این صورت، صفحه راه‌اندازی همراه اپ نمایش داده می‌شود تا کاربر آدرس سرور را وارد کند.
 */
const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "ir.kishavarhesab.app",
  appName: "کشاورزحساب",
  webDir: "capacitor-web",
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false,
  },
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: false,
          androidScheme: "https",
          allowNavigation: [new URL(serverUrl).host],
        },
      }
    : {
        server: {
          allowNavigation: ["*"],
        },
      }),
};

export default config;