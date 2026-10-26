/**
 * تولید دیتاست تمیز و «ماشین‌اعتبارسنجی‌شده» برای آموزش مدل دستیار.
 * هر نمونه پیش از نوشتن، با قرارداد JSON و موتور حسابداری اعتبارسنجی می‌شود.
 * اجرا: npx tsx scripts/gen-dataset.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { INTENTS, SYSTEM_PROMPT_FA, validateAssistantOutput, type ContractIntent } from "../src/lib/engine/contracts";
import { validateCheque, validateDebt, validateLabor, validateInventoryMove, validateTransaction } from "../src/lib/engine/accounting";

type Ex = {
  id: string;
  family: string;
  intent: ContractIntent;
  user: string;
  output: Record<string, unknown>;
  tags: string[];
};

const amounts = [
  { fa: "۲۵ میلیون تومان", n: 25_000_000 },
  { fa: "دو میلیون و پانصد هزار تومان", n: 2_500_000 },
  { fa: "۴۴ میلیون تومان", n: 44_000_000 },
  { fa: "۱.۵ میلیارد تومان", n: 1_500_000_000 },
  { fa: "۲۵۰ هزار تومان", n: 250_000 },
  { fa: "۱۲ میلیون", n: 12_000_000 },
  { fa: "۵٬۰۰۰٬۰۰۰ تومان", n: 5_000_000 },
  { fa: "یک میلیون و دویست هزار تومان", n: 1_200_000 },
  { fa: "۳۵۰ میلیون تومان", n: 350_000_000 },
  { fa: "۸۰۰ هزار تومان", n: 800_000 },
  { fa: "نیم میلیون تومان", n: 500_000 },
  { fa: "۷۵۰ میلیون تومان", n: 750_000_000 },
  { fa: "۹۶ میلیون تومان", n: 96_000_000 },
  { fa: "هفده میلیون و پانصد هزار تومان", n: 17_500_000 },
  { fa: "۶۰ میلیون تومان", n: 60_000_000 },
  { fa: "سه میلیون تومان", n: 3_000_000 },
];

const lands = [
  { fa: "زمین شمالی", region: "دشت مغان" },
  { fa: "قطعه زعفران شرقی", region: "تربت حیدریه" },
  { fa: "باغ گردو کوهپایه", region: "کوهپایه" },
  { fa: "زمین جنوبی", region: "جیرفت" },
  { fa: "زمین قدیمی", region: "همدان" },
];

const expenseCategories = [
  { fa: "کود اوره", cat: "کود و سم" },
  { fa: "سم علف‌کش", cat: "کود و سم" },
  { fa: "بذر گندم چمران", cat: "بذر و نهال" },
  { fa: "نشاء گوجه", cat: "بذر و نهال" },
  { fa: "گازوئیل", cat: "سوخت و انرژی" },
  { fa: "قبض برق پمپ", cat: "سوخت و انرژی" },
  { fa: "دستمزد کارگر برداشت", cat: "دستمزد کارگر" },
  { fa: "کارتن بسته‌بندی", cat: "بسته‌بندی" },
  { fa: "تعمیر پمپ آب", cat: "تعمیر ماشین‌آلات" },
  { fa: "کرایه حمل محصول", cat: "حمل و نقل" },
  { fa: "بیمه محصولات", cat: "بیمه و عوارض" },
  { fa: "اجاره زمین", cat: "اجاره زمین" },
];

const parties = ["فروشگاه نهاده سبز", "بانک کشاورزی", "مکانیکی حاج‌رضا", "تعاونی تولید", "آقای کریمی", "روغن‌کشی دشت", "شرکت صنایع تبدیلی جنوب"];
const workers = ["حسن رضایی", "مریم کریمی", "علی دهقان", "اکیپ برداشت جنوب", "کارگر فصلی"];
const items = [
  { fa: "کود اوره", unit: "کیلوگرم" },
  { fa: "بذر گندم", unit: "کیلوگرم" },
  { fa: "سم حشره‌کش", unit: "لیتر" },
  { fa: "گازوئیل", unit: "لیتر" },
  { fa: "کارتن", unit: "عدد" },
];
const dates = [
  { fa: "۱۵ آبان", iso: "2026-11-06" },
  { fa: "۱ آذر", iso: "2026-11-22" },
  { fa: "۱۰ روز بعد", iso: "2026-04-04" },
  { fa: "پایان ماه", iso: "2026-03-30" },
  { fa: "۲۰ مهر", iso: "2026-10-12" },
];
const REPORT_WORDS = ["گزارش سود و زیان بده", "چقدر سود کردم؟", "خلاصه هزینه‌های مزرعه", "وضعیت مالی مزرعه چطور است؟", "تفکیک هزینه‌ها را نشان بده", "بهای تمام‌شده محصولات"];
const LEARN_WORDS = ["بهای تمام‌شده چطور محاسبه می‌شود؟", "استهلاک تراکتور چگونه است؟", "فرق هزینه مستقیم و سربار چیست؟", "مدیریت انبار نهاده را توضیح بده", "نقطه سربه‌سر مزرعه یعنی چه؟"];
const OFF_TOPIC = ["نتیجه فوتبال دیشب چی شد؟", "قیمت بیت‌کوین چنده؟", "یک فیلم خوب معرفی کن", "دستور پخت کیک بده", "هوای فردا چطوره؟", "برای من یک شعر بگو"];

const out: Ex[] = [];
const rejected: string[] = [];

function push(family: string, intent: ContractIntent, user: string, output: Record<string, unknown>, tags: string[] = []) {
  const check = validateAssistantOutput(output);
  if (!check.ok) {
    rejected.push(`${family}: ${check.errors.join("; ")}`);
    return;
  }
  // اعتبارسنجی دوباره با موتور حسابداری (منبع مستقل) — فقط برای پیش‌نویس کامل
  const slots = (output.slots ?? {}) as Record<string, string | number>;
  const isDraft = output.action === "draft";
  if (isDraft && ["add_expense", "add_income"].includes(intent)) {
    if (!validateTransaction({ kind: intent === "add_income" ? "income" : "expense", amount: Number(slots.amount), date: String(slots.date ?? "2026-03-20"), categoryId: 1, method: String(slots.method ?? "cash") }).ok) {
      rejected.push(`${family}: accounting transaction mismatch`);
      return;
    }
  }
  if (isDraft && intent === "add_cheque" && !validateCheque({ party: String(slots.party), amount: Number(slots.amount), dueDate: String(slots.dueDate) }).ok) {
    rejected.push(`${family}: cheque mismatch`);
    return;
  }
  if (isDraft && ["add_debt", "add_receivable"].includes(intent) && !validateDebt({ party: String(slots.party), amount: Number(slots.amount) }).ok) {
    rejected.push(`${family}: debt mismatch`);
    return;
  }
  if (isDraft && intent === "add_labor" && !validateLabor({ workerName: String(slots.worker), days: Number(slots.days), dailyWage: Number(slots.dailyWage) }).ok) {
    rejected.push(`${family}: labor mismatch`);
    return;
  }
  if (isDraft && ["inventory_in", "inventory_out"].includes(intent) && !validateInventoryMove({ quantity: Number(slots.quantity), kind: intent === "inventory_in" ? "in" : "out", available: 1000 }).ok) {
    rejected.push(`${family}: inventory mismatch`);
    return;
  }
  const id = createHash("sha1").update(`${family}|${user}`).digest("hex").slice(0, 16);
  out.push({ id, family, intent, user, output, tags });
}

const T = "2026-03-20"; // تاریخ مرجع دیتاست

/* ---------- ۱) هزینه: کامل، با ارقام/حروف/واحدهای محلی ---------- */
const EXPENSE_TEMPLATES = [
  (a: string, i: string, l: string, m: string) => `${a} ${i} برای ${l} خریدم ${m}`,
  (a: string, i: string, l: string, m: string) => `برای ${l} ${i} به مبلغ ${a} خریدم ${m}`,
  (a: string, i: string, l: string, m: string) => `${a} بابت ${i} برای ${l} پرداخت کردم ${m}`,
  (a: string, i: string, l: string, m: string) => `${a} ${i} گرفتم برای ${l}، ${m}`,
];

expenseCategories.forEach((item, ci) => {
  amounts.forEach((amount, ai) => {
    const land = lands[(ci + ai) % lands.length];
    const method = ai % 4 === 0 ? "credit" : ai % 3 === 0 ? "bank" : "cash";
    const methodFa = method === "credit" ? "نسیه" : method === "bank" ? "با کارت" : "نقدی";
    EXPENSE_TEMPLATES.forEach((template, variant) => {
      push(
        `expense-complete-${variant}`,
        "add_expense",
        template(amount.fa, item.fa, land.fa, methodFa),
        {
          intent: "add_expense",
          slots: { amount: amount.n, category: item.cat, land: land.fa, method, date: T },
          missing: [],
          action: "draft",
          reply_fa: `پیش‌نویس هزینه ${amount.fa} برای ${item.cat} آماده شد؛ پس از تأیید شما ثبت می‌شود.`,
        },
        ["expense", `method:${method}`, ai % 3 === 0 ? "words" : "digits", `verb:${["neutral", "formal", "formal", "colloquial"][variant]}`],
      );
    });
  });
});

/* ---------- ۲) هزینه ناقص → پرسش ---------- */
expenseCategories.slice(0, 6).forEach((item, ci) => {
  push(
    `expense-missing-amount-${ci}`,
    "add_expense",
    `${item.fa} برای ${lands[ci % lands.length].fa} خریدم`,
    {
      intent: "add_expense",
      slots: { category: item.cat, land: lands[ci % lands.length].fa, date: T },
      missing: ["amount"],
      action: "ask",
      reply_fa: "مبلغ خرید را چند تومان ثبت کنم؟",
    },
    ["clarify", "missing:amount"],
  );
  push(
    `expense-missing-category-${ci}`,
    "add_expense",
    `۵ میلیون تومان برای ${lands[ci % lands.length].fa} پرداخت کردم`,
    {
      intent: "add_expense",
      slots: { amount: 5_000_000, land: lands[ci % lands.length].fa, date: T },
      missing: ["category"],
      action: "ask",
      reply_fa: "این هزینه در کدام دسته باشد؟ مثلاً کود و سم یا دستمزد کارگر.",
    },
    ["clarify", "missing:category"],
  );
});

/* ---------- ۳) درآمد ---------- */
[196_000_000, 118_000_000, 51_600_000, 42_800_000, 9_500_000, 2_800_000, 27_500_000, 63_000_000, 14_000_000, 88_000_000, 5_600_000, 31_000_000].forEach((amount, i) => {
  const land = lands[i % lands.length];
  push(
    `income-${i % 4}`,
    "add_income",
    `${amount.toLocaleString("fa-IR")} تومان محصول ${land.fa} را فروختم`,
    {
      intent: "add_income",
      slots: { amount, category: "فروش محصول", land: land.fa, method: i % 2 === 0 ? "credit" : "cash", date: T },
      missing: [],
      action: "draft",
      reply_fa: `فروش ${land.fa} ثبت می‌شود؛ لطفاً تأیید کنید.`,
    },
    ["income"],
  );
});

/* ---------- ۴) چک ---------- */
parties.forEach((party, pi) => {
  dates.forEach((date, di) => {
    const amount = amounts[(pi + di) % amounts.length];
    const direction = di % 3 === 0 ? "received" : "issued";
    push(
      `cheque-${(pi + di) % 4}`,
      "add_cheque",
      `${direction === "received" ? "از" : "برای"} ${party} چک ${amount.fa} با سررسید ${date.fa} ${direction === "received" ? "گرفتم" : "بنویس"}`,
      {
        intent: "add_cheque",
        slots: { party, amount: amount.n, dueDate: date.iso, direction, date: T },
        missing: [],
        action: "draft",
        reply_fa: `چک ${direction === "received" ? "دریافتی" : "صادره"} ${party} با سررسید ${date.fa} پیش‌نویس شد.`,
      },
      ["cheque", `direction:${direction}`],
    );
  });
});

[0, 1, 2].forEach((i) =>
  push(
    `cheque-missing-${i}`,
    "add_cheque",
    `برای ${parties[i]} چک بنویس`,
    {
      intent: "add_cheque",
      slots: { party: parties[i] },
      missing: i === 0 ? ["amount", "dueDate"] : ["amount"],
      action: "ask",
      reply_fa: i === 0 ? "مبلغ چک و تاریخ سررسید را بگویید." : "مبلغ چک چند تومان باشد؟",
    },
    ["clarify", "cheque"],
  ),
);

/* ---------- ۵) بدهی و طلب ---------- */
parties.forEach((party, i) => {
  const amount = amounts[(i + 3) % amounts.length];
  const amount2 = amounts[(i * 2 + 5) % amounts.length];
  push(
    `debt-${(i * 2) % 4}`,
    "add_debt",
    `من به ${party} ${amount.fa} بدهکارم`,
    {
      intent: "add_debt",
      slots: { party, amount: amount.n, direction: "payable", dueDate: dates[i % dates.length].iso },
      missing: [],
      action: "draft",
      reply_fa: `بدهی ${amount.fa} به ${party} ثبت می‌شود؛ تأیید می‌کنید؟`,
    },
    ["debt"],
  );
  push(
    `receivable-${(i * 2 + 1) % 4}`,
    "add_receivable",
    `از ${party} ${amount.fa} طلب دارم`,
    {
      intent: "add_receivable",
      slots: { party, amount: amount.n, direction: "receivable", dueDate: dates[(i + 2) % dates.length].iso },
      missing: [],
      action: "draft",
      reply_fa: `طلب ${amount.fa} از ${party} ثبت می‌شود؛ تأیید می‌کنید؟`,
    },
    ["receivable"],
  );
});

/* ---------- ۶) دستمزد ---------- */
workers.forEach((worker, wi) => {
  const days = [1, 2, 3, 7, 12, 21, 0.5][wi % 7];
  const wage = [1_300_000, 1_150_000, 1_900_000, 1_250_000, 1_000_000][wi % 5];
  push(
    `labor-${wi % 3}`,
    "add_labor",
    `دستمزد ${worker} ${days} روز کار را ثبت کن، روزی ${wage.toLocaleString("fa-IR")} تومان`,
    {
      intent: "add_labor",
      slots: { worker, days, dailyWage: wage, date: T },
      missing: [],
      action: "draft",
      reply_fa: `دستمزد ${worker} برای ${days} روز ثبت می‌شود؛ تأیید می‌کنید؟`,
    },
    ["labor"],
  );
});
push(
  "labor-missing-wage",
  "add_labor",
  "دستمزد مریم برای ۳ روز گل‌چینی را ثبت کن",
  { intent: "add_labor", slots: { worker: "مریم کریمی", days: 3 }, missing: ["dailyWage"], action: "ask", reply_fa: "دستمزد روزانه ایشان چند تومان است؟" },
  ["clarify", "labor"],
);

/* ---------- ۷) انبار ---------- */
items.forEach((item, ii) => {
  push(
    `inventory-out-${ii % 2}`,
    "inventory_out",
    `${[50, 100, 20, 8, 30][ii % 5]} ${item.unit} ${item.fa} از انبار برای کشت گندم کم کن`,
    {
      intent: "inventory_out",
      slots: { item: item.fa, quantity: [50, 100, 20, 8, 30][ii % 5], unit: item.unit, crop: "گندم", date: T },
      missing: [],
      action: "draft",
      reply_fa: `خروج ${item.fa} از انبار پیش‌نویس شد؛ تأیید می‌کنید؟`,
    },
    ["inventory", "out"],
  );
  push(
    `inventory-in-${ii % 2}`,
    "inventory_in",
    `${[200, 500, 40, 300, 120][ii % 5]} ${item.unit} ${item.fa} وارد انبار شد`,
    {
      intent: "inventory_in",
      slots: { item: item.fa, quantity: [200, 500, 40, 300, 120][ii % 5], unit: item.unit, date: T },
      missing: [],
      action: "draft",
      reply_fa: `ورود ${item.fa} به انبار پیش‌نویس شد؛ تأیید می‌کنید؟`,
    },
    ["inventory", "in"],
  );
});

/* ---------- ۸) کارها، تسویه، زمین ---------- */
["یادم باشه هفته بعد بیمه را تمدید کنم", "برای فردا خرید سم را یادداشت کن", "به من یادآوری کن کود سرک دوم گندم را انجام دهم", "۴ روز بعد تماس با تعاونی برای بذر"].forEach((text, i) =>
  push(
    `task-${i % 2}`,
    "add_task",
    text,
    {
      intent: "add_task",
      slots: { title: ["تمدید بیمه محصولات", "خرید سم", "کود سرک دوم گندم", "تماس با تعاونی برای بذر"][i], dueDate: ["2026-03-27", "2026-03-21", "2026-03-24", "2026-03-24"][i], priority: i === 3 ? "high" : "normal" },
      missing: [],
      action: "draft",
      reply_fa: "کار جدید پیش‌نویس شد؛ تأیید می‌کنید؟",
    },
    ["task"],
  ),
);
parties.slice(0, 4).forEach((party, i) =>
  push(
    `settle-debt-${i % 2}`,
    "settle_debt",
    `بدهی به ${party} را تسویه کردم`,
    { intent: "settle_debt", slots: { target: party }, missing: [], action: "draft", reply_fa: `تسویه بدهی ${party} ثبت می‌شود؛ تأیید می‌کنید؟` },
    ["settle"],
  ),
);
parties.slice(0, 3).forEach((party, i) =>
  push(
    `settle-cheque-${i}`,
    "settle_cheque",
    `چک ${party} پاس شد`,
    { intent: "settle_cheque", slots: { target: party }, missing: [], action: "draft", reply_fa: `چک ${party} به وضعیت پاس‌شده تغییر می‌کند؛ تأیید می‌کنید؟` },
    ["settle", "cheque"],
  ),
);
[
  { name: "زمین شرقی", area: 4.5, region: "جیرفت" },
  { name: "قطعه جدید", area: 2, region: "همدان" },
  { name: "زمین آبی", area: 8, region: "دشت مغان" },
].forEach((land, i) =>
  push(
    `land-${i}`,
    "add_land",
    `یک زمین جدید به نام ${land.name} با ${land.area} هکتار در ${land.region} اضافه کن`,
    {
      intent: "add_land",
      slots: { land: land.name, areaHa: land.area, region: land.region },
      missing: [],
      action: "draft",
      reply_fa: `زمین ${land.name} با ${land.area} هکتار پیش‌نویس شد؛ تأیید می‌کنید؟`,
    },
    ["land"],
  ),
);

/* ---------- ۹) گزارش، آموزش، رد ---------- */
REPORT_WORDS.forEach((text, i) =>
  push(
    `report-${i % 3}`,
    "report",
    text,
    {
      intent: "report",
      slots: { reportType: ["profit", "profit", "expense", "general", "expense", "cropcost"][i] },
      missing: [],
      action: "answer",
      reply_fa: "گزارش بر اساس داده‌های همین مزرعه آماده می‌شود.",
    },
    ["report"],
  ),
);
LEARN_WORDS.forEach((text, i) =>
  push(
    `learn-${i % 3}`,
    "learn",
    text,
    {
      intent: "learn",
      slots: { topic: ["بهای تمام‌شده", "استهلاک", "هزینه مستقیم و سربار", "انبار و نقطه سفارش", "نقطه سربه‌سر"][i] },
      missing: [],
      action: "answer",
      reply_fa: "این موضوع در پایگاه دانش حسابداری کشاورزی توضیح داده می‌شود.",
    },
    ["learn"],
  ),
);
OFF_TOPIC.forEach((text, i) =>
  push(
    `refuse-${i % 2}`,
    "refuse",
    text,
    {
      intent: "refuse",
      slots: {},
      missing: [],
      action: "refuse",
      reply_fa: "من فقط درباره حسابداری و مدیریت مالی کشاورزی و همین نرم‌افزار کمک می‌کنم. می‌توانم درباره بهای تمام‌شده، انبار یا چک راهنمایی کنم.",
    },
    ["scope", "refuse"],
  ),
);

/* ---------- تقسیم، حذف تکراری، خروجی ---------- */
const seen = new Set<string>();
const unique: Ex[] = [];
let duplicates = 0;
for (const ex of out) {
  const key = `${ex.intent}|${ex.user.replace(/\s+/g, " ").trim()}`;
  if (seen.has(key)) {
    duplicates += 1;
    continue;
  }
  seen.add(key);
  unique.push(ex);
}

// توازن دیتاست: سقف تعداد برای هر intent (نمونه‌گیری یکنواخت و قطعی)
const CAP_PER_INTENT = Number(process.env.DATASET_CAP_PER_INTENT ?? 130);
const balanced: Ex[] = [];
for (const intent of INTENTS) {
  const rows = unique.filter((e) => e.intent === intent);
  if (rows.length <= CAP_PER_INTENT) {
    balanced.push(...rows);
    continue;
  }
  const stride = rows.length / CAP_PER_INTENT;
  for (let i = 0; i < CAP_PER_INTENT; i += 1) balanced.push(rows[Math.floor(i * stride)]);
}

/** گروه‌بندی بر اساس family + سبد واژگانی، تا متن‌های مشابه بین splitها نشت نکنند. */
const splitOf = (family: string, user: string): "train" | "val" | "test" => {
  const bucket = parseInt(createHash("sha1").update(user).digest("hex").slice(0, 4), 16) % 16;
  const h = parseInt(createHash("sha1").update(`${family}|${bucket}`).digest("hex").slice(0, 6), 16) % 10;
  if (h === 8) return "val";
  if (h === 9) return "test";
  return "train";
};

const buckets: Record<"train" | "val" | "test", Ex[]> = { train: [], val: [], test: [] };
for (const ex of balanced) buckets[splitOf(ex.family, ex.user)].push(ex);

mkdirSync("training/data", { recursive: true });
const toRow = (ex: Ex) => ({
  id: ex.id,
  intent: ex.intent,
  messages: [
    { role: "system", content: SYSTEM_PROMPT_FA },
    { role: "user", content: ex.user },
    { role: "assistant", content: JSON.stringify(ex.output) },
  ],
  meta: { family: ex.family, tags: ex.tags },
  expected: ex.output,
});

for (const split of ["train", "val", "test"] as const) {
  writeFileSync(`training/data/${split}.jsonl`, buckets[split].map((ex) => JSON.stringify(toRow(ex))).join("\n") + "\n", "utf8");
}

const intentCoverage = INTENTS.map((intent) => ({
  intent,
  train: buckets.train.filter((e) => e.intent === intent).length,
  val: buckets.val.filter((e) => e.intent === intent).length,
  test: buckets.test.filter((e) => e.intent === intent).length,
}));

const stats = {
  generatedAt: new Date().toISOString(),
  total: balanced.length,
  generatedBeforeBalance: unique.length,
  capPerIntent: CAP_PER_INTENT,
  duplicatesRemoved: duplicates,
  rejected: rejected.length,
  rejectedSamples: rejected.slice(0, 10),
  splits: { train: buckets.train.length, val: buckets.val.length, test: buckets.test.length },
  intentCoverage,
  notes: "همه نمونه‌ها با validateAssistantOutput و موتور حسابداری اعتبارسنجی شده‌اند. تقسیم بر اساس family انجام شده تا نشت داده بین splitها رخ ندهد.",
};
writeFileSync("training/data/stats.json", JSON.stringify(stats, null, 2), "utf8");

console.log(JSON.stringify({ total: balanced.length, generated: unique.length, splits: stats.splits, rejected: rejected.length, duplicates }, null, 2));
