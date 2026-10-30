/** بررسی اینکه استان/شهر پروفایل واقعی است؛ خطای شبکه مانع تحلیل نمی‌شود. */
const ENDPOINTS = ["https://ai.tivachat-vflash-ai.ir/api/place", "https://kishavar-ai.indistinctiveeee.workers.dev/api/place"];

export type PlaceCheck = "valid" | "not-found" | "unknown";

export async function verifyProfilePlace(province: string, city: string): Promise<PlaceCheck> {
  if (!province && !city) return "not-found";
  for (const endpoint of ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ province, city }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.ok) return data.found ? "valid" : "not-found";
    } catch {
      /* try next */
    } finally {
      clearTimeout(timer);
    }
  }
  return "unknown";
}
