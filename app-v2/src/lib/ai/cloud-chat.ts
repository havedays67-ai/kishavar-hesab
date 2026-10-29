/**
 * پل اتصال به کشاورزیار (مغز زندهٔ برنامه)
 * ------------------------------------------------------------
 * • هیچ کلیدی در برنامه نیست؛ فقط دو آدرس عمومی Worker.
 * • خروجی می‌تواند «متن» یا «برنامهٔ کنش» باشد.
 * • این تابع هیچ‌وقت پاسخ ساختگی نمی‌سازد؛ فقط پاسخ مغز یا خطای شفاف.
 */
export const CLOUD_ENDPOINTS = [
  "https://ai.tivachat-vflash-ai.ir/api/chat",
  "https://kishavar-ai.indistinctiveeee.workers.dev/api/chat",
];

export type CloudSection =
  | "assistant" | "crops" | "parties" | "finance" | "inventory" | "trade" | "rentals" | "documents" | "reports";

export interface CloudHistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export interface CloudPartyFact {
  id: string;
  name: string;
  kind: "debtor" | "creditor";
  balance: number;
}

export interface CloudRequest {
  message: string;
  history?: CloudHistoryTurn[];
  section?: CloudSection;
  mode?: "auto" | "text" | "action";
  image?: string;
  context?: { today?: string; parties?: CloudPartyFact[]; profile?: { city?: string } };
}

export type CloudResult =
  | { ok: true; mode: "text"; text: string; latencyMs: number }
  | { ok: true; mode: "action"; plan: unknown; latencyMs: number }
  | { ok: false; error: string; latencyMs: number };

const ATTEMPT_TIMEOUT_MS = 45_000;

async function attempt(endpoint: string, request: CloudRequest): Promise<CloudResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
  const started = Date.now();
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: request.message,
        history: (request.history ?? []).slice(-8),
        section: request.section ?? "assistant",
        mode: request.mode ?? "auto",
        image: request.image,
        context: request.context,
        maxTokens: 700,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { ok: false, error: `HTTP ${response.status} ${body.slice(0, 100)}`, latencyMs: Date.now() - started };
    }
    const data = (await response.json()) as {
      ok?: boolean;
      mode?: string;
      text?: string;
      plan?: unknown;
      error?: string;
    };
    if (!data?.ok) return { ok: false, error: String(data?.error ?? "پاسخ نامعتبر"), latencyMs: Date.now() - started };
    if (data.mode === "action" && data.plan) {
      return { ok: true, mode: "action", plan: data.plan, latencyMs: Date.now() - started };
    }
    const text = String(data.text ?? "").trim();
    if (!text) return { ok: false, error: "پاسخ خالی", latencyMs: Date.now() - started };
    return { ok: true, mode: "text", text, latencyMs: Date.now() - started };
  } catch (error) {
    const detail = error instanceof Error ? (error.name === "AbortError" ? "زمان انتظار تمام شد" : error.message) : String(error);
    return { ok: false, error: detail.slice(0, 140), latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

export async function askCloud(request: CloudRequest): Promise<CloudResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, error: "اینترنت دستگاه قطع است", latencyMs: 0 };
  }
  const errors: string[] = [];
  for (const endpoint of CLOUD_ENDPOINTS) {
    const result = await attempt(endpoint, request);
    if (result.ok) return result;
    errors.push(result.error);
  }
  return { ok: false, error: errors.join(" | "), latencyMs: 0 };
}
