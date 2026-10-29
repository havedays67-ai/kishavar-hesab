/**
 * پل اتصال به مدل زنده (GLM 5.3 Flash)
 * ------------------------------------------------------------
 * • هیچ کلیدی در برنامه نیست؛ فقط دو آدرس عمومی Worker.
 * • اول دامنهٔ اختصاصی، اگر نشد آدرس workers.dev (برای وقتی VPN/فیلتر
 *   یکی را می‌بندد).
 * • این تابع هیچ‌وقت پاسخ محلی نمی‌سازد؛ فقط مدل یا خطای شفاف.
 */
export const CLOUD_ENDPOINTS = [
  "https://ai.tivachat-vflash-ai.ir/api/chat",
  "https://kishavar-ai.indistinctiveeee.workers.dev/api/chat",
];

export interface CloudHistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export type CloudResult =
  | { ok: true; text: string; model: string; label: string; latencyMs: number }
  | { ok: false; error: string; latencyMs: number };

const ATTEMPT_TIMEOUT_MS = 35_000;

async function attempt(
  endpoint: string,
  message: string,
  history: CloudHistoryTurn[]
): Promise<{ text: string; model: string; label: string } | { error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, history: history.slice(-8), maxTokens: 700 }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { error: `HTTP ${response.status} ${body.slice(0, 120)}` };
    }
    const data = (await response.json()) as { ok?: boolean; text?: string; model?: string; label?: string; error?: string };
    const text = String(data?.text ?? "").trim();
    if (!data?.ok || text.length < 2) return { error: String(data?.error ?? "پاسخ خالی") };
    return { text, model: String(data.model ?? "glm-5.3-flash"), label: String(data.label ?? "GLM 5.3 Flash") };
  } catch (error) {
    const detail = error instanceof Error ? (error.name === "AbortError" ? "زمان انتظار تمام شد" : error.message) : String(error);
    return { error: detail.slice(0, 160) };
  } finally {
    clearTimeout(timer);
  }
}

export async function askCloud(message: string, history: CloudHistoryTurn[] = []): Promise<CloudResult> {
  const started = Date.now();
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, error: "اینترنت دستگاه قطع است", latencyMs: 0 };
  }
  const errors: string[] = [];
  for (const endpoint of CLOUD_ENDPOINTS) {
    const result = await attempt(endpoint, message, history);
    if ("text" in result) return { ok: true, ...result, latencyMs: Date.now() - started };
    errors.push(result.error);
  }
  return { ok: false, error: errors.join(" | "), latencyMs: Date.now() - started };
}
