/** تبدیل مختصات به استان/شهر؛ فقط از مسیر سرور خودمان برای پایداری و CORS. */
const ENDPOINTS = ["https://ai.tivachat-vflash-ai.ir/api/reverse", "https://kishavar-ai.indistinctiveeee.workers.dev/api/reverse"];
const TIMEOUT_MS = 15_000;

export interface ReversePlace {
  ok: true;
  province: string;
  city: string;
  village: string;
  display: string;
}

export async function reversePlace(latitude: number, longitude: number): Promise<ReversePlace | { ok: false; message: string }> {
  let lastError = "موقعیت مکانی به استان/شهر تبدیل نشد.";
  for (const endpoint of ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lat: latitude, lon: longitude }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.ok && (data.province || data.city || data.village)) {
        return { ok: true, province: String(data.province ?? ""), city: String(data.city || data.village || ""), village: String(data.village ?? ""), display: String(data.display ?? "") };
      }
      lastError = String(data?.error || lastError);
    } catch (error) {
      lastError = error instanceof Error && error.name === "AbortError" ? "درخواست موقعیت زمان‌بر شد." : "ارتباط با سرویس موقعیت برقرار نشد.";
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, message: lastError };
}
