import { Capacitor } from "@capacitor/core";

/**
 * تأیید هویت با بیومتریک دستگاه (اثر انگشت/چهره ثبت‌شده در خود گوشی).
 *
 * محدودیت واقعی و مهم:
 * اندروید تصویر یا الگوی اثر انگشت را در اختیار برنامه‌ها قرار نمی‌دهد. برنامه فقط می‌تواند از سیستم
 * بخواهد «مالک دستگاه» را با یکی از اثر انگشت‌های ثبت‌شده تأیید کند و نتیجه موفق/ناموفق را بگیرد.
 * بنابراین در این برنامه «ثبت ۳ اثر انگشت» به‌معنای امکان استفاده از هر یک از اثر انگشت‌های ثبت‌شده در
 * گوشی و تا ۳ تلاش مجدد است، نه ذخیره تصویر اثر انگشت.
 */

export type BiometricStatus = "available" | "unavailable" | "not-native" | "no-hardware" | "error";

export interface BiometricAvailability {
  status: BiometricStatus;
  biometryType: number;
  deviceIsSecure: boolean;
  label: string;
  note: string;
}

export interface BiometricResult {
  ok: boolean;
  reason:
    | "verified"
    | "cancelled"
    | "failed"
    | "not_available"
    | "not_native"
    | "unsupported"
    | "error";
  attemptsUsed: number;
  message: string;
  verifiedAt: string;
  device: string;
}

const BIOMETRY_LABELS: Record<number, string> = {
  0: "بدون بیومتریک",
  1: "لمس (Touch ID)",
  2: "چهره (Face ID)",
  3: "اثر انگشت",
  4: "تشخیص چهره",
  5: "عنبیه",
};

function plugin(): Promise<typeof import("@capgo/capacitor-native-biometric")> {
  return import("@capgo/capacitor-native-biometric");
}

export async function checkBiometric(): Promise<BiometricAvailability> {
  if (!Capacitor.isNativePlatform()) {
    return {
      status: "not-native",
      biometryType: 0,
      deviceIsSecure: false,
      label: "فقط در اپ اندروید",
      note: "در مرورگر امکان فراخوانی حسگر اثر انگشت وجود ندارد. این دکمه در APK فعال می‌شود.",
    };
  }
  try {
    const { NativeBiometric } = await plugin();
    const result = await NativeBiometric.isAvailable({ useFallback: false });
    if (!result.isAvailable) {
      return {
        status: "unavailable",
        biometryType: result.biometryType ?? 0,
        deviceIsSecure: Boolean(result.deviceIsSecure),
        label: "بدون بیومتریک ثبت‌شده",
        note: "در تنظیمات امنیتی گوشی، اثر انگشت یا چهره ثبت کنید و دوباره تلاش کنید. تا آن زمان می‌توانید با امضای دستی و کد تأیید کار کنید.",
      };
    }
    return {
      status: "available",
      biometryType: result.biometryType ?? 0,
      deviceIsSecure: Boolean(result.deviceIsSecure),
      label: BIOMETRY_LABELS[result.biometryType ?? 0] ?? "بیومتریک دستگاه",
      note: "هر یک از اثر انگشت‌های ثبت‌شده در گوشی پذیرفته می‌شود؛ تا ۳ تلاش مجاز است.",
    };
  } catch {
    return {
      status: "error",
      biometryType: 0,
      deviceIsSecure: false,
      label: "خطا در دسترسی",
      note: "دسترسی به حسگر بیومتریک ممکن نشد؛ امضای دستی به‌عنوان جایگزین در دسترس است.",
    };
  }
}

export async function verifyBiometric(reason: string, maxAttempts = 3): Promise<BiometricResult> {
  const availability = await checkBiometric();
  const now = new Date().toISOString();
  if (availability.status === "not-native") {
    return { ok: false, reason: "not_native", attemptsUsed: 0, message: availability.note, verifiedAt: now, device: "مرورگر" };
  }
  if (availability.status !== "available") {
    return { ok: false, reason: "not_available", attemptsUsed: 0, message: availability.note, verifiedAt: now, device: availability.label };
  }
  try {
    const { NativeBiometric } = await plugin();
    await NativeBiometric.verifyIdentity({
      reason,
      title: "تأیید هویت امضاکننده",
      subtitle: "نتیجه با اثر انگشت یا بیومتریک ثبت‌شده گوشی",
      description: "انگشت خود را روی حسگر قرار دهید یا از چهره استفاده کنید.",
      maxAttempts,
      useFallback: false,
    });
    return {
      ok: true,
      reason: "verified",
      attemptsUsed: 1,
      message: "هویت با بیومتریک دستگاه تأیید شد.",
      verifiedAt: new Date().toISOString(),
      device: availability.label,
    };
  } catch {
    return {
      ok: false,
      reason: "failed",
      attemptsUsed: maxAttempts,
      message: "اثر انگشت تأیید نشد یا تلاش لغو شد. انگشت تمیز و خشک را روی حسگر بگذارید، اثر انگشت دیگری که در گوشی ثبت کرده‌اید امتحان کنید، یا از امضای دستی استفاده کنید.",
      verifiedAt: new Date().toISOString(),
      device: availability.label,
    };
  }
}

export function hasNativeBiometricPlugin(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("NativeBiometric");
}

export function deviceFingerprintLabel(): string {
  if (typeof navigator === "undefined") return "دستگاه ناشناس";
  const platform = Capacitor.getPlatform();
  return `${platform} · ${navigator.platform || "web"}`;
}
