/**
 * پل اتصال به مدل زنده (Cloudflare Worker)
 * ------------------------------------------------------------
 * • هیچ کلیدی در برنامه نیست؛ فقط یک آدرس عمومی.
 * • اگر اینترنت نبود یا مدل جواب نداد، بی‌صدا null برمی‌گردد و
 *   برنامه به موتور محلی کشاورزیار تکیه می‌کند.
 * • پرسش‌های دفتری (مبلغ، طلب، بدهی) هرگز به ابر نمی‌روند؛
 *   تصمیمش با فراخواننده است.
 */
export const CLOUD_CHAT_ENDPOINT = "https://ai.tivachat-vflash-ai.ir/api/chat";

export interface CloudReply {
  text: string;
  model: string;
  label: string;
  latencyMs: number;
}

export interface CloudHistoryTurn {
  role: "user" | "assistant";
  content: string;
}

const DEFAULT_TIMEOUT_MS = 60_000;

export async function cloudAvailable(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  try {
    const response = await fetch(`${CLOUD_CHAT_ENDPOINT.replace("/api/chat", "/health")}`, { method: "GET", cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function askCloud(
  message: string,
  history: CloudHistoryTurn[] = [],
  options: { timeoutMs?: number } = {}
): Promise<CloudReply | null> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const started = Date.now();
  try {
    const response = await fetch(CLOUD_CHAT_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message,
        history: history.slice(-8),
        maxTokens: 700,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { ok?: boolean; text?: string; model?: string; label?: string };
    const text = String(data?.text ?? "").trim();
    if (!data?.ok || text.length < 2) return null;
    return { text, model: String(data.model ?? "cloud"), label: String(data.label ?? data.model ?? "مدل زنده"), latencyMs: Date.now() - started };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
