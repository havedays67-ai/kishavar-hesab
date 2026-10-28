import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // رسید/فاکتور عکس است و در همان فرم رکورد ارسال می‌شود؛ سقف پیش‌فرض
    // Server Actions (۱ مگابایت) باعث خطای آپلود عکس موبایل می‌شد.
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
