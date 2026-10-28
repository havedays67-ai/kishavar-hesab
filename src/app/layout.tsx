import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { ensureSeeded } from "@/lib/seed";

export const metadata: Metadata = {
  title: "کشاورزحساب | حسابداری هوشمند کشاورزی",
  description:
    "نرم‌افزار حرفه‌ای حسابداری کشاورزی با دستیار هوشمند: مدیریت زمین، کشت، هزینه، درآمد، انبار، کارگر، ماشین‌آلات، بدهی و چک.",
  manifest: "/manifest.webmanifest",
  applicationName: "کشاورزحساب",
  keywords: ["حسابداری کشاورزی", "مدیریت مزرعه", "کشاورز", "هوش مصنوعی", "بهای تمام شده"],
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon-192.png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#1e5827",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  await ensureSeeded();
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
