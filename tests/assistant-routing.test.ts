import { describe, expect, it } from "vitest";
import { askKeshavarYar } from "../app-v2/src/lib/ai/engine";
import { emptyLedger } from "../app-v2/src/lib/ledger";
import { numberToPersianWords } from "../app-v2/src/lib/ai/persian-words";

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

describe("کشاورزیار — رفع تطبیق زیررشته‌ای و پاسخ‌های دادهٔ جاافتاده", () => {
  it("«کدام زمین سود بیشتری دارد؟» دیگر به دام و طیور نمی‌رود («دام» داخل «کدام»)", () => {
    const reply = askKeshavarYar("کدام زمین سود بیشتری دارد؟", context());
    expect(reply.meta.kind).toBe("data");
    expect(reply.meta.matchedId).toBe("data-plots-empty");
  });

  it("«موجودی انبار» پاسخ فروش جو نمی‌گیرد («جو» داخل «موجودی»)", () => {
    const reply = askKeshavarYar("موجودی انبار چقدر است؟", context());
    expect(reply.meta.matchedId).toBe("data-inventory");
  });

  it("«اقساط وام» با گزارش چک‌ها اشتباه نمی‌شود", () => {
    const reply = askKeshavarYar("اقساط وام من کی سررسیده؟", context());
    expect(reply.meta.matchedId).toBe("data-loans");
  });

  it("«هزینهٔ کود چقدر بوده؟» از دفتر (سرفصل) جواب می‌گیرد، نه از راهنمای عمومی", () => {
    const reply = askKeshavarYar("هزینهٔ کود چقدر بوده؟", context());
    expect(reply.meta.matchedId).toBe("data-expense-category");
    expect(reply.text).toContain("کود و سم");
  });

  it("«کی بیشترین بدهی رو به من داره؟» طلب است نه بدهی", () => {
    const reply = askKeshavarYar("کی بیشترین بدهی رو به من داره؟", context());
    expect(reply.meta.matchedId).toBe("data-receivable");
  });

  it("«چطور سند ثبت کنم؟» راهنمای خود برنامه را می‌دهد، نه ارکان قرارداد اجاره", () => {
    const reply = askKeshavarYar("چطور سند ثبت کنم؟", context());
    expect(reply.meta.matchedId).toBe("app-howto-record");
    expect(reply.text).toContain("دفتر مالی");
  });

  it("«چقدر بدهکارم؟» قصد پرداختنی می‌گیرد", () => {
    const reply = askKeshavarYar("چقدر بدهکارم؟", context());
    expect(reply.meta.fastIntent).toBe("report_payable");
  });
});

describe("موتور ریاضی — تبدیل واحد مساحت و سود مرکب", () => {
  it("یک هکتار را ۱۰٬۰۰۰ متر مربع تبدیل می‌کند", () => {
    const reply = askKeshavarYar("یک هکتار چند متر مربع است؟", context());
    expect(reply.meta.matchedId).toBe("math-area");
    expect(reply.text).toContain("۱۰,۰۰۰");
  });

  it("سود مرکب را با فرمول مرکب حساب می‌کند، نه سود ساده", () => {
    const reply = askKeshavarYar("سود مرکب ۱۰ درصد روی ۵ میلیون برای ۳ سال", context());
    expect(reply.meta.matchedId).toBe("math-profit");
    expect(reply.text).toContain("۱,۶۵۵,۰۰۰");
  });
});

describe("مبلغ به حروف — «یک» حذف نمی‌شود", () => {
  it("۱٬۶۵۵٬۰۰۰ به «یک میلیون و ششصد و پنجاه و پنج هزار» تبدیل می‌شود", () => {
    expect(numberToPersianWords(1655000)).toBe("یک میلیون و ششصد و پنجاه و پنج هزار");
  });

  it("۱٬۰۰۰٬۰۰۰ به «یک میلیون» تبدیل می‌شود، نه «میلیون»", () => {
    expect(numberToPersianWords(1000000)).toBe("یک میلیون");
  });

  it("۲٬۵۰۰٬۰۰۰ بدون تغییر درست می‌ماند", () => {
    expect(numberToPersianWords(2500000)).toBe("دو میلیون و پانصد هزار");
  });
});
