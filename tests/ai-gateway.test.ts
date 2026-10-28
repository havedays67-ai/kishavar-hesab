import { describe, expect, it, vi } from "vitest";
import {
  OUT_OF_DOMAIN_REPLY,
  buildMemoryContext,
  createGateway,
  isInDomain,
  orderProviders,
  routeRequest,
  verifyReply,
  type ChatRequest,
  type ProviderConfig,
} from "../app-v2/src/lib/ai/gateway";

const providers: ProviderConfig[] = [
  { id: "p1", label: "یک", model: "m1" },
  { id: "p2", label: "دو", model: "m2" },
  { id: "p3", label: "سه", model: "m3" },
];

const request: ChatRequest = { messages: [{ role: "user", content: "قیمت گندم؟" }], maxTokens: 200 };

describe("دروازهٔ هوش — جابه‌جایی خودکار", () => {
  it("اگر اولی خطا داد، دومی جواب می‌دهد و حافظه حفظ می‌شود", async () => {
    const seen: ChatRequest[] = [];
    const transport = vi.fn(async (provider: ProviderConfig, req: ChatRequest) => {
      seen.push(req);
      if (provider.id === "p1") throw new Error("timeout");
      return { text: "پاسخ دو", providerId: provider.id, latencyMs: 5 };
    });

    const gateway = createGateway({ providers, transport, now: () => 1000 });
    const result = await gateway.chat(request);

    expect(result.text).toBe("پاسخ دو");
    expect(result.providerId).toBe("p2");
    expect(transport).toHaveBeenCalledTimes(2);
    // همان پیام کامل برای ارائه‌دهندهٔ دوم دوباره فرستاده شد.
    expect(seen[1].messages).toEqual(request.messages);
  });

  it("بعد از استراحت کوتاه، دوباره از ارائه‌دهندهٔ اول شروع می‌شود", async () => {
    let failing = true;
    let clock = 5000;
    const transport = vi.fn(async (provider: ProviderConfig) => {
      if (provider.id === "p1" && failing) throw new Error("500");
      return { text: "ok", providerId: provider.id, latencyMs: 3 };
    });
    const gateway = createGateway({ providers, transport, retryAfterMs: 1000, now: () => clock });

    const first = await gateway.chat(request);
    expect(first.providerId).toBe("p2");

    failing = false;
    clock += 2000; // پنجرهٔ استراحت گذشت
    const second = await gateway.chat(request);

    expect(second.providerId).toBe("p1");
    expect(gateway.health().find((row, index) => providers[index].id === "p1")?.failures).toBe(0);
  });

  it("بعد از دو خطای پیاپی، مدار باز می‌شود و بقیه امتحان می‌شوند", async () => {
    const transport = vi.fn(async (provider: ProviderConfig) => {
      if (provider.id === "p1") throw new Error("boom");
      return { text: "سالم", providerId: provider.id, latencyMs: 4 };
    });
    const gateway = createGateway({ providers, transport, failureThreshold: 2, cooldownMs: 10_000, retryAfterMs: 0, now: () => 1000 });

    await gateway.chat(request);
    await gateway.chat(request);
    expect(gateway.health().find((row, index) => providers[index].id === "p1")?.openUntil).toBe(11_000);

    // در مدار باز، p1 حتی امتحان هم نمی‌شود.
    const callsBefore = transport.mock.calls.length;
    await gateway.chat(request);
    const tried = transport.mock.calls.slice(callsBefore).map(([provider]) => provider.id);
    expect(tried).not.toContain("p1");
    expect(tried).toContain("p2");
  });

  it("وقتی همه خطا دادند، خطای واضح می‌دهد و رسیدگی به لایهٔ محلی می‌رسد", async () => {
    const gateway = createGateway({
      providers,
      transport: async () => {
        throw new Error("offline");
      },
      now: () => 0,
    });
    await expect(gateway.chat(request)).rejects.toThrow(/همهٔ ارائه‌دهنده‌ها/);
  });

  it("مرتب‌سازی: سالم سریع‌تر، بعد نیمه‌باز، و مدار باز آخر", () => {
    const ordered = orderProviders(
      providers,
      {
        p1: { failures: 2, openUntil: 9000, skipUntil: 0, latencyMs: 10, lastError: "x" },
        p2: { failures: 0, openUntil: 0, skipUntil: 0, latencyMs: 120, lastError: "" },
        p3: { failures: 1, openUntil: 0, skipUntil: 2000, latencyMs: 40, lastError: "y" },
      },
      1000
    );
    expect(ordered.map((provider) => provider.id)).toEqual(["p2", "p3", "p1"]);
  });
});

describe("دروازهٔ هوش — مصرف توکن", () => {
  it("پرسش محلی هیچ توکنی مصرف نمی‌کند", () => {
    expect(routeRequest("سلام").kind).toBe("local");
    expect(routeRequest("چقدر طلب دارم؟", { hasLocalAnswer: true })).toMatchObject({ kind: "local", maxTokens: 0 });
  });

  it("پرسش قیمت/زمان کشت جست‌وجو لازم دارد", () => {
    const decision = routeRequest("قیمت گندم در پارس‌آباد چقدر است؟");
    expect(decision.needsSearch).toBe(true);
    expect(decision.maxTokens).toBeGreaterThan(0);
  });

  it("تصمیم چندعاملی عمیق و گران‌تر است", () => {
    const deep = routeRequest("برای ۵ هکتار زمین بهترین برنامه کشت با توجه به آب کم چیست؟");
    expect(deep.kind).toBe("deep");
    expect(deep.maxTokens).toBeGreaterThan(routeRequest("قیمت کود اوره؟").maxTokens);
  });

  it("حافظهٔ بلند بریده و عددها ماسک می‌شوند", () => {
    const turns = Array.from({ length: 20 }, (_, index) => ({
      role: (index % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `پرداخت ${index} میلیون تومان بابت کود`,
    }));
    const context = buildMemoryContext(turns, { maxTurns: 5, maxChars: 200 });
    expect(context.length).toBeLessThanOrEqual(5);
    expect(context.every((turn) => !/\d/.test(turn.content))).toBe(true);
  });
});

describe("دروازهٔ هوش — نگهبان دامنه و اعتبارسنجی", () => {
  it("کشاورزی و دفتر مالی مجاز است", () => {
    expect(isInDomain("چه زمانی گندم بکارم؟")).toBe(true);
    expect(isInDomain("چقدر بدهی دارم؟")).toBe(true);
  });

  it("خارج از دامنه رد می‌شود", () => {
    expect(isInDomain("کد پایتون برای مرتب‌سازی بنویس")).toBe(false);
    expect(OUT_OF_DOMAIN_REPLY).toContain("کشاورزی");
  });

  it("پاسخ خالی/ناامن/JSON نامعتبر رد می‌شود", () => {
    expect(verifyReply("").ok).toBe(false);
    expect(verifyReply("<script>alert(1)</script>").ok).toBe(false);
    expect(verifyReply("نتیجه است", { json: true }).ok).toBe(false);
    expect(verifyReply('{"intent":"add_expense"}', { json: true }).ok).toBe(true);
    expect(verifyReply("```json\n{\"a\":1}\n```", { json: true }).ok).toBe(true);
  });
});
