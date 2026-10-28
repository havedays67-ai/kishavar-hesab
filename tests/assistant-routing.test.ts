import { describe, expect, it } from "vitest";
import { askKeshavarYar } from "../app-v2/src/lib/ai/engine";
import { emptyLedger } from "../app-v2/src/lib/ledger";

const context = () => ({ ledger: emptyLedger(), trades: [], plots: [], contracts: [] }) as never;

describe("کشاورزیار — مسیردهی درست پرسش‌های کشاورزی و دفتری", () => {
  it("پرسش آبیاری گندم را با دادهٔ فروش اشتباه جواب نمی‌دهد", () => {
    const reply = askKeshavarYar("آبیاری گندم چند نوبت لازم دارد؟", context());
    expect(reply.meta.matchedId).toBe("boost-irrigation-plan");
    expect(reply.text).toContain("متر مکعب");
    expect(reply.text).not.toContain("معاملهٔ محصولی ثبت نشده");
  });

  it("رطوبت برداشت را از دانش کشاورزی پاسخ می‌دهد، نه از دادهٔ فروش", () => {
    const reply = askKeshavarYar("رطوبت برداشت گندم چقدر باشد؟", context());
    expect(reply.meta.matchedId).toBe("boost-harvest-moisture");
    expect(reply.text).toContain("۱۴ درصد");
  });

  it("پرسش رسید را به راهنمای رسید پیوندخورده به رکورد می‌برد", () => {
    const reply = askKeshavarYar("از مهدی طلب دارم، رسیدش را کجا آپلود کنم؟", context());
    expect(reply.meta.matchedId).toBe("boost-receipt-where");
    expect(reply.text).toContain("مشاهده");
    expect(reply.text).toContain("دانلود");
    expect(reply.text).toContain("حذف");
  });

  it("سود دفتر را با عدد پاسخ می‌دهد حتی وقتی زمینی ثبت نشده", () => {
    const reply = askKeshavarYar("سود این فصل چقدر است؟", context());
    expect(reply.meta.matchedId).toBe("data-profit");
    expect(reply.meta.confidence).toBeGreaterThanOrEqual(90);
  });

  it("پرسش طلب همچنان از دفتر واقعی خوانده می‌شود", () => {
    const reply = askKeshavarYar("چقدر طلب دارم؟", context());
    expect(reply.meta.matchedId).toBe("data-receivable");
  });
});
