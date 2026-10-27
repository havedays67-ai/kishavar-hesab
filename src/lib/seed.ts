import { db } from "@/db";
import {
  assistantNotes,
  categories,
  cheques,
  crops,
  debts,
  equipment,
  inventoryItems,
  inventoryMoves,
  knowledge,
  laborLogs,
  lands,
  cropTrades,
  settings,
  tasks,
  tradePayments,
  transactions,
  workers,
} from "@/db/schema";
import { sql } from "drizzle-orm";
import { currentJalaliYear } from "@/lib/format";
import {
  computeTrade,
  defaultPolicy,
  defaultQuality,
  getCrop,
  tradeCode,
  type MarketMode,
  type TradeInput,
} from "@/lib/trade/engine";

const iso = (offsetDays: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const EXPENSE_CATEGORIES: [string, string][] = [
  ["بذر و نهال", "🌱"],
  ["کود و سم", "🧪"],
  ["آبیاری و آب", "💧"],
  ["دستمزد کارگر", "👷"],
  ["اجاره زمین", "📜"],
  ["سوخت و انرژی", "⛽"],
  ["تعمیر ماشین‌آلات", "🔧"],
  ["حمل و نقل", "🚚"],
  ["بیمه و عوارض", "🛡️"],
  ["بسته‌بندی", "📦"],
  ["خرید دام و علوفه", "🐄"],
  ["هزینه متفرقه", "🧾"],
];

const INCOME_CATEGORIES: [string, string][] = [
  ["فروش محصول", "🌾"],
  ["فروش دام و طیور", "🐑"],
  ["یارانه و کمک دولتی", "🏛️"],
  ["اجاره ماشین‌آلات", "🚜"],
  ["فروش ضایعات", "♻️"],
];

const KNOWLEDGE_SEED: {
  topic: string;
  title: string;
  tags: string;
  level: string;
  content: string;
}[] = [
  {
    topic: "مفاهیم پایه",
    title: "هزینه مستقیم و غیرمستقیم در مزرعه",
    tags: "هزینه مستقیم,غیرمستقیم,سربار,تخصیص",
    level: "پایه",
    content:
      "هزینه مستقیم هزینه‌ای است که مستقیماً به یک زمین یا یک محصول قابل نسبت دادن است؛ مثل بذر، کود، سم و دستمزد کارگر آن قطعه. هزینه غیرمستقیم (سربار) بین چند محصول مشترک است؛ مثل استهلاک تراکتور، آب چاه مشترک، بیمه و اجاره دفتر. برای دانستن سود واقعی هر محصول، سربار را با یک مبنای عادلانه تقسیم کنید: هکتار، ساعت کار ماشین یا ارزش فروش. در این نرم‌افزار هنگام ثبت هزینه، زمین و کشت مربوطه را انتخاب کنید تا گزارش سود هر قطعه دقیق باشد و هزینه‌های مشترک را در دسته «هزینه متفرقه» با توضیح مبنا ثبت کنید."
  },
  {
    topic: "مفاهیم پایه",
    title: "بهای تمام‌شده هر کیلوگرم محصول",
    tags: "بهای تمام شده,قیمت تمام شده,کیلوگرم,سود",
    level: "پایه",
    content:
      "فرمول: بهای تمام‌شده هر کیلوگرم = مجموع هزینه‌های همان کشت ÷ مقدار برداشت واقعی (کیلوگرم). هزینه‌ها شامل بذر، کود، سم، آب، انرژی، دستمزد، اجاره، بسته‌بندی، حمل و سهم استهلاک ماشین است. اگر قیمت فروش شما از این عدد کمتر باشد، هر کیلو فروش زیان می‌سازد. بعد از ثبت برداشت واقعی در صفحه «کشت‌ها»، گزارش «بهای تمام‌شده» در بخش گزارش‌ها این عدد را برای هر محصول محاسبه می‌کند. نکته مهم: برای محصول چندساله مانند زعفران، هزینه پیاز و کاشت را روی سال‌های بهره‌برداری سرشکن کنید."
  },
  {
    topic: "مفاهیم پایه",
    title: "سود ناخالص، سود عملیاتی و حاشیه سود",
    tags: "سود ناخالص,حاشیه سود,نسبت مالی,تحلیل",
    level: "میانی",
    content:
      "سود ناخالص = درآمد فروش محصول − هزینه‌های مستقیم همان محصول. سود عملیاتی = سود ناخالص − هزینه‌های سربار و اداری مزرعه. حاشیه سود = سود ÷ درآمد × ۱۰۰. برای یک مزرعه غلات حاشیه ۲۰ تا ۳۵ درصد معمول است، اما در گلخانه و زعفران به دلیل سرمایه‌بر بودن می‌تواند متفاوت باشد. تنها به سود کل تکیه نکنید؛ حاشیه سود نشان می‌دهد در برابر هر ۱۰۰ تومان فروش چقدر باقی می‌ماند و قدرت تحمل افت قیمت را مشخص می‌کند."
  },
  {
    topic: "ماشین‌آلات",
    title: "محاسبه استهلاک ماشین‌آلات کشاورزی (خط مستقیم)",
    tags: "استهلاک,تراکتور,خط مستقیم,هزینه ماشین",
    level: "میانی",
    content:
      "استهلاک سالانه = (بهای خرید − ارزش اسقاط) ÷ عمر مفید (سال). مثال: تراکتور ۲ میلیارد تومانی با ارزش اسقاط ۴۰۰ میلیون و عمر ۱۰ سال: (۲,۰۰۰,۰۰۰,۰۰۰ − ۴۰۰,۰۰۰,۰۰۰) ÷ ۱۰ = ۱۶۰,۰۰۰,۰۰۰ تومان در سال. این مبلغ را روی ساعت کار یا هکتار سرشکن کنید تا هزینه واقعی هر عملیات مشخص شود. سوخت، روغن، لاستیک و تعمیرات جدا از استهلاک ثبت می‌شوند. در صفحه «ماشین‌آلات» استهلاک سالانه و مانده دفتری هر ماشین نمایش داده می‌شود."
  },
  {
    topic: "انبار",
    title: "مدیریت موجودی نهاده‌ها و نقطه سفارش",
    tags: "انبار,موجودی,نقطه سفارش,نهاده,FIFO",
    level: "میانی",
    content:
      "نقطه سفارش = مصرف روزانه × زمان تأمین + موجودی احتیاطی. مثلاً اگر روزانه ۳۰ کیلو کود مصرف می‌شود و تأمین ۱۰ روز طول می‌کشد، کمتر از ۳۰۰ کیلو نباید در انبار بماند. روش «اولین ورود، اولین خروج» (FIFO) برای نهاده‌های فسادپذیر مثل کود مایع و سم دقیق‌تر است. هر بار مصرف نهاده را به‌صورت «خروج از انبار» و همراه با زمین/کشت ثبت کنید؛ این کار هم موجودی را درست نگه می‌دارد و هم هزینه محصول را خودکار می‌سازد. مصرف واقعی هر هکتار را با توصیه فنی مقایسه کنید تا هدررفت مشخص شود."
  },
  {
    topic: "زعفران",
    title: "اقتصاد زعفران: هزینه چندساله و بهای تمام‌شده کلاله",
    tags: "زعفران,پیاز,کلاله,چندساله,بهای تمام شده",
    level: "پیشرفته",
    content:
      "زعفران محصولی چندساله است: سال اول کاشت هزینه بالای پیاز دارد و بازده کم است، سال دوم و سوم بازده به اوج می‌رسد. برای گزارش درست، کل هزینه دوره (پیاز، کاشت، آبیاری، نیروی کار گل‌چینی، خشک‌کن، بسته‌بندی) را بر مجموع کلاله خشک چند سال تقسیم کنید. مثال: هزینه ۵ ساله ۹۰۰ میلیون تومان و برداشت مجموع ۴۵ کیلو کلاله ← بهای تمام‌شده هر کیلو ۲۰ میلیون تومان. نیروی کار گل‌چینی معمولاً بزرگ‌ترین هزینه است؛ آن را در دسته دستمزد کارگر با انتخاب کشت زعفران ثبت کنید تا در گزارش تفکیک هزینه دیده شود."
  },
  {
    topic: "غلات",
    title: "گندم: تفاوت اقتصاد کشت دیم و آبی",
    tags: "گندم,دیم,آبی,هزینه آب,عملکرد",
    level: "میانی",
    content:
      "در گندم آبی، هزینه آب و انرژی و کود سرک سهم بالایی دارد اما عملکرد ۳ تا ۵ تن در هکتار معمول است. در دیم، هزینه کمتر و ریسک بیشتر است و عملکرد ۰٫۸ تا ۲ تن در هکتار. برای هر دو، شاخص کلیدی «هزینه هر هکتار» و «درآمد هر هکتار» است. بذر، کود پایه، سم علف‌کش و برداشت (کمباین) را جدا ثبت کنید. فروش را در دسته فروش محصول با تعیین زمین ثبت کنید؛ اگر یارانه گندم دریافت می‌کنید آن را در دسته یارانه و کمک دولتی وارد کنید تا سود عملیاتی مخدوش نشود."
  },
  {
    topic: "گلخانه",
    title: "حسابداری گلخانه و هزینه انرژی",
    tags: "گلخانه,گوجه,انرژی,سوخت,عملکرد",
    level: "میانی",
    content:
      "در گلخانه، هزینه انرژی (گازوئیل، برق، گرمایش) و بذر هیبرید بیشترین سهم را دارند. مصرف انرژی را ماهانه ثبت کنید و مصرف بر کیلوگرم محصول را پایش کنید؛ افزایش ناگهانی می‌تواند نشانه نشتی یا افت راندمان باشد. برای گوجه گلخانه‌ای عملکرد ۱۵ تا ۲۵ کیلوگرم در مترمربع متعارف است. بسته‌بندی و حمل را جدا از هزینه تولید نگه دارید تا قیمت تمام‌شده مزرعه و قیمت تحویل در بازار مشخص باشد."
  },
  {
    topic: "مالی",
    title: "چک، نقدینگی و برنامه پرداخت فصلی",
    tags: "چک,نقدینگی,سررسید,پرداخت,بدهی",
    level: "پایه",
    content:
      "کشاورزی درآمد فصلی و هزینه پیوسته دارد؛ بنابراین مدیریت سررسید حیاتی است. هر چک صادره را با تاریخ سررسید، بانک و شماره سریال ثبت کنید و ۱۴ روز قبل از سررسید هشدار بگیرید. نسبت نقدینگی ساده: موجودی نقد + طلب‌های سررسیدشده ÷ بدهی‌ها و چک‌های ۳۰ روز آینده. اگر این نسبت کمتر از ۱ باشد، برای فروش بخشی از محصول یا تمدید چک برنامه داشته باشید. هزینه دیرکرد و جریمه برگشت چک را در دسته هزینه متفرقه با توضیح ثبت کنید."
  },
  {
    topic: "مالی",
    title: "مزارعه، مشارکت و تقسیم سود",
    tags: "مزارعه,مشارکت,سهم,شریک,سود",
    level: "پیشرفته",
    content:
      "در قرارداد مزارعه، زمین از یک طرف و کار و هزینه از طرف دیگر می‌آید و محصول طبق درصد توافق تقسیم می‌شود. در نرم‌افزار درصد سهم زمین را در مشخصات زمین وارد کنید. سود واقعی سهم شما = درآمد سهم شما − هزینه‌های نقدی شما − ارزش کار خودتان. ارزش کار خودتان (مدیریت و نیروی کار خانوادگی) را با نرخ روز محاسبه و به‌عنوان هزینه فرصت در تحلیل گزارش در نظر بگیرید تا مشارکت زیان‌ده پنهان نماند."
  },
  {
    topic: "مالی",
    title: "نسبت‌های کلیدی برای ارزیابی مزرعه",
    tags: "نسبت,ROI,سربه سر,تحلیل,شاخص",
    level: "پیشرفته",
    content:
      "۱) بازده سرمایه (ROI) = سود عملیاتی ÷ کل سرمایه در گردش و ثابت. ۲) نقطه سربه‌سر = هزینه ثابت ÷ (قیمت فروش هر کیلو − هزینه متغیر هر کیلو). ۳) بهره‌وری نیروی کار = درآمد ÷ نفر-روز. ۴) هزینه هر هکتار و درآمد هر هکتار برای مقایسه قطعات. ۵) سهم پنج هزینه اصلی از کل هزینه؛ اگر بیش از ۷۰ درصد باشد تمرکز کاهش هزینه باید روی همان‌ها باشد. این شاخص‌ها در بخش گزارش‌ها و کارت‌های تحلیل محاسبه می‌شوند."
  },
  {
    topic: "حسابداری",
    title: "اصول ثبت درست تراکنش کشاورزی",
    tags: "ثبت,تراکنش,سند,دسته بندی,روزنامه",
    level: "پایه",
    content:
      "هر تراکنش باید چهار جزء داشته باشد: تاریخ، مبلغ، دسته (درآمد یا هزینه و نوع آن) و طرف حساب. برای تحلیل دقیق، زمین و کشت را هم مشخص کنید. مبالغ را به تومان و بدون اعشار ثبت کنید. خرید نسیه را با روش پرداخت «اعتباری» وارد کنید تا در بدهی‌ها دیده شود؛ پرداخت بعدی را با همان دسته ثبت کنید. هزینه شخصی خانواده را با مزرعه مخلوط نکنید؛ حتی برداشت شخصی از محصول را به‌عنوان «برداشت برای مصرف خانوار» و با قیمت بازار ثبت کنید تا سود واقعی مشخص شود."
  },
  {
    topic: "حسابداری",
    title: "کارگر روزمزد، فصلی و بیمه",
    tags: "دستمزد,کارگر,بیمه,نفر-روز,پرداخت",
    level: "پایه",
    content:
      "برای کارگر روزمزد، مبلغ = تعداد روز × دستمزد روزانه. کارگر فصلی را با قرارداد و وظیفه مشخص ثبت کنید. اگر بیمه کارگرها را پرداخت می‌کنید، آن را در دسته بیمه و عوارض با توضیح سهم کارفرما وارد کنید. دستمزد پرداخت‌نشده را به‌عنوان بدهی جاری نگه دارید تا نقدینگی واقعی اشتباه محاسبه نشود. بهره‌وری هر کارگر در عملیات مختلف (وجین، برداشت، بسته‌بندی) را مقایسه کنید تا بتوانید نرخ منصفانه تعیین کنید."
  },
  {
    topic: "راهنمای نرم‌افزار",
    title: "تفاوت حالت پشتیبان و دستیار هوش مصنوعی",
    tags: "هوش مصنوعی,پشتیبان,دستیار,راهنما,دسترسی",
    level: "پایه",
    content:
      "حالت «پشتیبان» فقط آموزش و راهنما می‌دهد و گزارش می‌سازد؛ هیچ داده‌ای را تغییر نمی‌دهد و درباره هر بخش نرم‌افزار و مفاهیم حسابداری کشاورزی پاسخ می‌دهد. حالت «دستیار» اجازه دارد فقط داخل همین نرم‌افزار عملیات انجام دهد: ثبت هزینه و درآمد، بدهی، چک، کار، خروج نهاده از انبار و یادداشت. دستیار اگر اطلاعات ناقص باشد سؤال می‌پرسد، خلاصه عملیات را نشان می‌دهد و بعد از تأیید شما ثبت می‌کند. هیچ‌کدام از دو حالت به داده خارج از این نرم‌افزار دسترسی ندارند."
  },
  {
    topic: "راهنمای نرم‌افزار",
    title: "کار با گزارش‌ها و شاخص‌های داشبورد",
    tags: "گزارش,داشبورد,سود و زیان,تحلیل,صفحه",
    level: "پایه",
    content:
      "داشبورد خلاصه درآمد، هزینه، سود، حاشیه سود، هزینه هر هکتار، بدهی و طلب را نشان می‌دهد. در صفحه گزارش‌ها چهار نما وجود دارد: سود و زیان دوره، بهای تمام‌شده هر محصول، جریان نقدی ماهانه و عملکرد زمین‌ها. برای گزارش دقیق، تاریخ شروع و پایان یک فصل کشت را انتخاب کنید. اگر عددی غیرمنتظره دیدید، ابتدا فیلتر زمین و دسته را بررسی کنید و سپس تراکنش‌های دارای روش پرداخت «اعتباری» را جدا از نقدی ببینید."
  },
];

async function seedData() {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(918273645)`);
    const already = await tx.execute<{ value: string }>(sql`select value from settings where key = 'seeded' limit 1`);
    if (already.rows.length > 0) return;

    const catRows = await tx
      .insert(categories)
      .values([
        ...EXPENSE_CATEGORIES.map(([name, icon]) => ({ name, icon, kind: "expense", isSystem: true })),
        ...INCOME_CATEGORIES.map(([name, icon]) => ({ name, icon, kind: "income", isSystem: true })),
      ])
      .returning();
    const catId = new Map(catRows.map((c) => [c.name, c.id]));

    const landRows = await tx
      .insert(lands)
      .values([
        {
          name: "زمین شمالی",
          areaHa: 12.5,
          region: "دشت مغان",
          soilType: "لومی",
          irrigation: "بارانی",
          ownership: "owned",
          sharePercent: 100,
          notes: "تناوب گندم و کلزا؛ چاه اختصاصی با کنتور.",
        },
        {
          name: "قطعه زعفران شرقی",
          areaHa: 3.2,
          region: "تربت حیدریه",
          soilType: "شنی-لومی",
          irrigation: "قطره‌ای",
          ownership: "leased",
          sharePercent: 100,
          notes: "اجاره ۶ ساله؛ پیاز سال سوم.",
        },
        {
          name: "باغ گردو کوهپایه",
          areaHa: 4.8,
          region: "کوهپایه",
          soilType: "رسی-لومی",
          irrigation: "غرقابی",
          ownership: "owned",
          sharePercent: 100,
          notes: "درختان ۹ ساله، ۱۴۰ اصله.",
        },
        {
          name: "زمین جنوبی (مشارکتی)",
          areaHa: 2.5,
          region: "جیرفت",
          soilType: "لومی-شنی",
          irrigation: "قطره‌ای",
          ownership: "shared",
          sharePercent: 60,
          notes: "مزارعه ۶۰٪ سهم ما، ۴۰٪ مالک زمین.",
        },
      ])
      .returning();
    const [landNorth, landSaffron, landWalnut, landSouth] = landRows;

    const cropRows = await tx
      .insert(crops)
      .values([
        {
          landId: landNorth.id,
          name: "گندم",
          variety: "چمران",
          season: "پاییز",
          plantingDate: iso(-150),
          harvestDate: iso(60),
          expectedYieldKg: 55000,
          actualYieldKg: 0,
          status: "in_progress",
          notes: "آبیاری بارانی، دو نوبت کود سرک.",
        },
        {
          landId: landSaffron.id,
          name: "زعفران",
          variety: "بومی تربت",
          season: "پاییز",
          plantingDate: iso(-420),
          harvestDate: iso(-35),
          expectedYieldKg: 12,
          actualYieldKg: 14.2,
          status: "harvested",
          notes: "برداشت گل‌چینی دستی؛ خشک‌کن برقی.",
        },
        {
          landId: landWalnut.id,
          name: "گردو",
          variety: "محلی کوهپایه",
          season: "بهار",
          plantingDate: iso(-900),
          harvestDate: iso(-80),
          expectedYieldKg: 9000,
          actualYieldKg: 8600,
          status: "harvested",
          notes: "آبیاری غرقابی هر ۱۸ روز.",
        },
        {
          landId: landSouth.id,
          name: "گوجه‌فرنگی",
          variety: "هیبرید سانسید",
          season: "بهار",
          plantingDate: iso(-210),
          harvestDate: iso(-20),
          expectedYieldKg: 110000,
          actualYieldKg: 118000,
          status: "harvested",
          notes: "کشت نشایی زیر پلاستیک؛ سهم ما ۶۰٪.",
        },
        {
          landId: landNorth.id,
          name: "کلزا",
          variety: "هایولا ۵۰",
          season: "پاییز",
          plantingDate: iso(-560),
          harvestDate: iso(-380),
          expectedYieldKg: 28000,
          actualYieldKg: 26500,
          status: "harvested",
          notes: "کشت قبلی همین زمین.",
        },
      ])
      .returning();
    const [wheat, saffron, walnut, tomato, canola] = cropRows;

    type T = { kind: "income" | "expense"; cat: string; amount: number; land?: number; crop?: number; desc: string; party?: string; method?: string; days: number };
    const rows: T[] = [
      { kind: "expense", cat: "بذر و نهال", amount: 38_500_000, land: landNorth.id, crop: wheat.id, desc: "خرید ۲ تن بذر گندم چمران", party: "تعاونی تولید کشاورزان", method: "bank", days: -142 },
      { kind: "expense", cat: "کود و سم", amount: 26_400_000, land: landNorth.id, crop: wheat.id, desc: "کود اوره و سوپرفسفات پایه", party: "فروشگاه نهاده سبز", method: "credit", days: -138 },
      { kind: "expense", cat: "آبیاری و آب", amount: 9_800_000, land: landNorth.id, crop: wheat.id, desc: "حق‌الاشتراک آب و برق پمپ", party: "امور آب منطقه", method: "bank", days: -120 },
      { kind: "expense", cat: "دستمزد کارگر", amount: 21_000_000, land: landNorth.id, crop: wheat.id, desc: "دستمزد ۱۵ نفر-روز کشت و کوددهی", party: "اکیپ کارگری رضایی", method: "cash", days: -118 },
      { kind: "expense", cat: "سوخت و انرژی", amount: 14_600_000, land: landNorth.id, crop: wheat.id, desc: "گازوئیل عملیات خاک‌ورزی", party: "پمپ بنزین جاده اصلی", method: "cash", days: -130 },
      { kind: "income", cat: "فروش محصول", amount: 118_000_000, land: landNorth.id, crop: canola.id, desc: "فروش کلزا به کارخانه روغن‌کشی", party: "روغن‌کشی دشت", method: "bank", days: -370 },
      { kind: "expense", cat: "حمل و نقل", amount: 7_200_000, land: landNorth.id, crop: canola.id, desc: "کرایه حمل کلزا به کارخانه", party: "باربری سریع", method: "cash", days: -368 },
      { kind: "income", cat: "فروش محصول", amount: 42_800_000, land: landSaffron.id, crop: saffron.id, desc: "فروش ۲ کیلو زعفران نگین", party: "بازار زعفران تربت", method: "cash", days: -30 },
      { kind: "expense", cat: "دستمزد کارگر", amount: 24_000_000, land: landSaffron.id, crop: saffron.id, desc: "دستمزد گل‌چینی و جداسازی کلاله", party: "اکیپ گل‌چین محلی", method: "cash", days: -36 },
      { kind: "expense", cat: "اجاره زمین", amount: 36_000_000, land: landSaffron.id, crop: saffron.id, desc: "اجاره سالانه قطعه زعفران", party: "مالک قطعه - آقای صادقی", method: "bank", days: -300 },
      { kind: "expense", cat: "کود و سم", amount: 11_800_000, land: landSaffron.id, crop: saffron.id, desc: "کود آلی مایع و سولفات پتاسیم", party: "فروشگاه نهاده سبز", method: "credit", days: -95 },
      { kind: "income", cat: "فروش محصول", amount: 51_600_000, land: landWalnut.id, crop: walnut.id, desc: "فروش ۴٫۳ تن گردو با پوست", party: "عمده‌فروش بازار مرکزی", method: "cash", days: -70 },
      { kind: "expense", cat: "دستمزد کارگر", amount: 16_800_000, land: landWalnut.id, crop: walnut.id, desc: "دستمزد برداشت و پوست‌گیری گردو", party: "اکیپ برداشت", method: "cash", days: -82 },
      { kind: "expense", cat: "تعمیر ماشین‌آلات", amount: 8_400_000, land: landWalnut.id, desc: "تعمیر پمپ آب باغ", party: "مکانیکی حاج‌رضا", method: "cash", days: -60 },
      { kind: "income", cat: "فروش محصول", amount: 196_000_000, land: landSouth.id, crop: tomato.id, desc: "فروش ۴۰ تن گوجه سهم مزرعه", party: "شرکت صنایع تبدیلی جنوب", method: "credit", days: -18 },
      { kind: "expense", cat: "بذر و نهال", amount: 12_500_000, land: landSouth.id, crop: tomato.id, desc: "خرید نشاء گوجه هیبرید", party: "گلخانه نشاء سبز", method: "bank", days: -205 },
      { kind: "expense", cat: "کود و سم", amount: 18_700_000, land: landSouth.id, crop: tomato.id, desc: "کود قطره‌ای و سم آفات", party: "فروشگاه نهاده سبز", method: "credit", days: -150 },
      { kind: "expense", cat: "دستمزد کارگر", amount: 34_600_000, land: landSouth.id, crop: tomato.id, desc: "دستمزد کارگری برداشت گوجه", party: "اکیپ جنوب", method: "cash", days: -30 },
      { kind: "expense", cat: "بسته‌بندی", amount: 9_300_000, land: landSouth.id, crop: tomato.id, desc: "خرید کارتن و جعبه میوه", party: "کارتن‌سازی پارس", method: "cash", days: -40 },
      { kind: "expense", cat: "حمل و نقل", amount: 6_800_000, land: landSouth.id, crop: tomato.id, desc: "کرایه حمل گوجه به کارخانه", party: "باربری جنوب", method: "cash", days: -20 },
      { kind: "income", cat: "یارانه و کمک دولتی", amount: 15_000_000, desc: "یارانه نهاده و کود دولتی", party: "جهاد کشاورزی استان", method: "bank", days: -100 },
      { kind: "income", cat: "اجاره ماشین‌آلات", amount: 9_500_000, desc: "اجاره کمباین به همسایه", party: "آقای کریمی", method: "cash", days: -410 },
      { kind: "expense", cat: "بیمه و عوارض", amount: 6_100_000, desc: "بیمه محصولات کشاورزی", party: "صندوق بیمه کشاورزی", method: "bank", days: -80 },
      { kind: "expense", cat: "سوخت و انرژی", amount: 5_400_000, land: landSouth.id, desc: "برق پمپ قطره‌ای", party: "اداره برق", method: "bank", days: -55 },
      { kind: "expense", cat: "هزینه متفرقه", amount: 3_200_000, desc: "عوارض و مجوز حمل محصول", party: "شهرداری", method: "cash", days: -12 },
      { kind: "income", cat: "فروش ضایعات", amount: 2_800_000, desc: "فروش ضایعات و بشکه خالی", party: "ضایعاتی محل", method: "cash", days: -8 },
      { kind: "expense", cat: "سوخت و انرژی", amount: 12_300_000, land: landNorth.id, crop: wheat.id, desc: "گازوئیل آبیاری بارانی", party: "پمپ بنزین جاده اصلی", method: "cash", days: -45 },
    ];

    await tx.insert(transactions).values(
      rows.map((r) => ({
        kind: r.kind,
        categoryId: catId.get(r.cat) ?? null,
        landId: r.land ?? null,
        cropId: r.crop ?? null,
        amount: r.amount,
        date: iso(r.days),
        description: r.desc,
        party: r.party ?? "",
        method: r.method ?? "cash",
        source: "seed",
      })),
    );

    const invRows = await tx
      .insert(inventoryItems)
      .values([
        { name: "بذر گندم چمران", unit: "کیلوگرم", category: "بذر", quantity: 620, reorderLevel: 400, unitCost: 19_000, warehouse: "انبار مرکزی" },
        { name: "کود اوره", unit: "کیلوگرم", category: "کود", quantity: 380, reorderLevel: 300, unitCost: 14_500, warehouse: "انبار مرکزی" },
        { name: "کود سولفات پتاسیم", unit: "کیلوگرم", category: "کود", quantity: 210, reorderLevel: 150, unitCost: 27_000, warehouse: "انبار مرکزی" },
        { name: "سم علف‌کش تاپیک", unit: "لیتر", category: "سم", quantity: 14, reorderLevel: 10, unitCost: 640_000, warehouse: "انبار سم" },
        { name: "سم حشره‌کش کنفیدور", unit: "لیتر", category: "سم", quantity: 6, reorderLevel: 12, unitCost: 890_000, warehouse: "انبار سم" },
        { name: "گازوئیل", unit: "لیتر", category: "سوخت", quantity: 240, reorderLevel: 400, unitCost: 6_500, warehouse: "مخزن سوخت" },
        { name: "کارتن بسته‌بندی", unit: "عدد", category: "بسته‌بندی", quantity: 60, reorderLevel: 100, unitCost: 85_000, warehouse: "انبار مرکزی" },
        { name: "نشا گوجه هیبرید", unit: "بوته", category: "بذر", quantity: 0, reorderLevel: 0, unitCost: 2_200, warehouse: "گلخانه" },
      ])
      .returning();

    await tx.insert(inventoryMoves).values([
      { itemId: invRows[0].id, kind: "in", quantity: 2000, unitCost: 18_500, date: iso(-145), note: "خرید بذر از تعاونی", cropId: wheat.id },
      { itemId: invRows[0].id, kind: "out", quantity: 1380, unitCost: 18_500, date: iso(-140), note: "مصرف بذر در کشت گندم", cropId: wheat.id },
      { itemId: invRows[1].id, kind: "in", quantity: 800, unitCost: 14_000, date: iso(-139), note: "خرید کود اوره", cropId: wheat.id },
      { itemId: invRows[1].id, kind: "out", quantity: 420, unitCost: 14_000, date: iso(-104), note: "کود سرک اول", cropId: wheat.id },
      { itemId: invRows[4].id, kind: "out", quantity: 4, unitCost: 890_000, date: iso(-88), note: "سم‌پاشی زعفران", cropId: saffron.id },
      { itemId: invRows[5].id, kind: "out", quantity: 160, unitCost: 6_500, date: iso(-44), note: "سوخت پمپ آبیاری", cropId: wheat.id },
      { itemId: invRows[6].id, kind: "out", quantity: 40, unitCost: 85_000, date: iso(-22), note: "بسته‌بندی گوجه", cropId: tomato.id },
      { itemId: invRows[2].id, kind: "out", quantity: 90, unitCost: 27_000, date: iso(-60), note: "کود پتاسه باغ گردو", cropId: walnut.id },
    ]);

    const workerRows = await tx
      .insert(workers)
      .values([
        { name: "حسن رضایی", role: "کارگر عمومی", phone: "09150000001", dailyWage: 1_300_000 },
        { name: "مریم کریمی", role: "گل‌چین زعفران", phone: "09150000002", dailyWage: 1_150_000 },
        { name: "علی دهقان", role: "اپراتور تراکتور", phone: "09150000003", dailyWage: 1_900_000 },
        { name: "اکیپ برداشت جنوب", role: "گروه برداشت", phone: "09150000004", dailyWage: 1_250_000 },
      ])
      .returning();

    await tx.insert(laborLogs).values([
      { workerId: workerRows[0].id, workerName: workerRows[0].name, landId: landNorth.id, cropId: wheat.id, date: iso(-118), days: 15, dailyWage: 1_200_000, amount: 18_000_000, task: "کشت و کوددهی", paid: true },
      { workerId: workerRows[2].id, workerName: workerRows[2].name, landId: landNorth.id, cropId: wheat.id, date: iso(-60), days: 4, dailyWage: 1_900_000, amount: 7_600_000, task: "سم‌پاشی گندم", paid: false },
      { workerId: workerRows[1].id, workerName: workerRows[1].name, landId: landSaffron.id, cropId: saffron.id, date: iso(-36), days: 21, dailyWage: 1_150_000, amount: 24_150_000, task: "گل‌چینی زعفران", paid: true },
      { workerId: workerRows[3].id, workerName: workerRows[3].name, landId: landSouth.id, cropId: tomato.id, date: iso(-30), days: 18, dailyWage: 1_250_000, amount: 22_500_000, task: "برداشت گوجه", paid: true },
      { workerId: workerRows[0].id, workerName: workerRows[0].name, landId: landWalnut.id, cropId: walnut.id, date: iso(-82), days: 12, dailyWage: 1_200_000, amount: 14_400_000, task: "برداشت گردو", paid: true },
      { workerId: workerRows[0].id, workerName: workerRows[0].name, landId: landNorth.id, cropId: wheat.id, date: iso(-14), days: 3, dailyWage: 1_300_000, amount: 3_900_000, task: "بازدید و رفع گرفتگی آب", paid: false },
    ]);

    await tx.insert(equipment).values([
      { name: "تراکتور ITM 285", type: "تراکتور", purchaseDate: iso(-1900), purchasePrice: 1_450_000_000, salvageValue: 350_000_000, usefulLifeYears: 12, hoursUsed: 1450, notes: "کار اصلی خاک‌ورزی" },
      { name: "سمپاش پشت‌تراکتوری ۴۰۰ لیتری", type: "سمپاش", purchaseDate: iso(-900), purchasePrice: 190_000_000, salvageValue: 30_000_000, usefulLifeYears: 8, hoursUsed: 210 },
      { name: "تیلر کوبوتا", type: "تیلر", purchaseDate: iso(-2400), purchasePrice: 320_000_000, salvageValue: 60_000_000, usefulLifeYears: 10, hoursUsed: 620 },
      { name: "پمپ آب چاه شمالی", type: "تجهیزات آبیاری", purchaseDate: iso(-1200), purchasePrice: 260_000_000, salvageValue: 40_000_000, usefulLifeYears: 10, hoursUsed: 980 },
    ]);

    await tx.insert(debts).values([
      { party: "فروشگاه نهاده سبز", direction: "payable", title: "خرید نسیه کود و سم", amount: 44_500_000, dueDate: iso(9), paid: false },
      { party: "بانک کشاورزی", direction: "payable", title: "قسط وام سرمایه در گردش", amount: 85_000_000, dueDate: iso(24), paid: false },
      { party: "مکانیکی حاج‌رضا", direction: "payable", title: "تعمیر پمپ آب", amount: 8_400_000, dueDate: iso(-6), paid: false },
      { party: "شرکت صنایع تبدیلی جنوب", direction: "receivable", title: "مانده فروش گوجه", amount: 96_000_000, dueDate: iso(12), paid: false },
      { party: "تعاونی روستایی", direction: "receivable", title: "طلب یارانه نهاده", amount: 18_000_000, dueDate: iso(45), paid: false },
      { party: "آقای کریمی", direction: "receivable", title: "اجاره کمباین", amount: 9_500_000, dueDate: iso(-40), paid: true },
    ]);

    await tx.insert(cheques).values([
      { party: "فروشگاه نهاده سبز", direction: "issued", amount: 44_500_000, dueDate: iso(11), bank: "بانک ملت", serial: "۷۴۵۱۲۳", status: "pending", notes: "بابت کود و سم" },
      { party: "مالک قطعه زعفران", direction: "issued", amount: 18_000_000, dueDate: iso(38), bank: "بانک صادرات", serial: "۳۳۱۹۸۷", status: "pending", notes: "قسط دوم اجاره" },
      { party: "شرکت صنایع تبدیلی جنوب", direction: "received", amount: 60_000_000, dueDate: iso(5), bank: "بانک تجارت", serial: "۹۹۲۴۳۱", status: "pending", notes: "بابت فروش گوجه" },
      { party: "روغن‌کشی دشت", direction: "received", amount: 118_000_000, dueDate: iso(-360), bank: "بانک ملی", serial: "۵۵۴۲۱۰", status: "passed", notes: "فروش کلزا" },
    ]);

    await tx.insert(tasks).values([
      { title: "کود سرک دوم گندم شمالی", dueDate: iso(4), priority: "high", status: "open", landId: landNorth.id },
      { title: "خرید سم حشره‌کش (موجودی زیر حد سفارش)", dueDate: iso(2), priority: "high", status: "open", landId: landSaffron.id },
      { title: "تسویه دستمزد کارگر سم‌پاشی", dueDate: iso(7), priority: "normal", status: "open", landId: landNorth.id },
      { title: "تمدید بیمه محصولات قبل از فصل", dueDate: iso(20), priority: "normal", status: "open" },
    ]);

    await tx.insert(knowledge).values(KNOWLEDGE_SEED);

    await tx.insert(assistantNotes).values([
      {
        kind: "insight",
        title: "بیشترین هزینه در دستمزد کارگر است",
        detail: "دستمزد کارگر بزرگ‌ترین سرفصل هزینه مزرعه است؛ صرفه‌جویی در نفر-روز برداشت بیشترین اثر را دارد.",
        confidence: 0.86,
      },
      {
        kind: "insight",
        title: "طلبی از صنایع تبدیلی جنوب دارید",
        detail: "۹۶ میلیون تومان طلب سررسید نزدیک؛ برای نقدینگی چک دریافتی را پیگیری کنید.",
        confidence: 0.9,
      },
      {
        kind: "rule",
        title: "قاعده ثبت هزینه نهاده",
        detail: "هزینه هر نهاده هنگام خروج از انبار باید به کشت مربوطه نسبت داده شود تا بهای تمام‌شده دقیق بماند.",
        confidence: 0.95,
      },
    ]);

    await tx.insert(settings).values([
      { key: "seeded", value: new Date().toISOString() },
      { key: "farm_name", value: "مزرعه سبز دشت" },
      { key: "owner_name", value: "کشاورز عزیز" },
      { key: "currency", value: "تومان" },
      { key: "fiscal_start", value: `${new Date().getFullYear()}-01-01` },
    ]);
  });

  await seedTradeExamples();
}

type SeedTrade = {
  mode: MarketMode;
  cropKey: string;
  sellerName: string;
  buyerName: string;
  buyerType: string;
  quantity: number;
  price: number;
  quality: Partial<ReturnType<typeof defaultQuality>>;
  policy?: Record<string, number | string | boolean>;
  status: string;
  payments: { amount: number; method: string; note: string }[];
};

async function seedTradeExamples() {
  try {
    const existing = await db.execute<{ count: number }>(sql`select count(*)::int as count from crop_trades`);
    if (Number(existing.rows[0]?.count ?? 0) > 0) return;

    const templates: SeedTrade[] = [
      {
        mode: "factory",
        cropKey: "wheat",
        sellerName: "حاج رضا محمدی",
        buyerName: "کارخانه آرد زرین",
        buyerType: "factory",
        quantity: 28,
        price: 49650,
        quality: { moisturePct: 15.4, foreignMatterPct: 2.6, brokenPct: 3, pestPct: 0.2, hectoliter: 76, proteinPct: 11.8 },
        policy: { transportToman: 4500000, unloadingToman: 1200000, commissionPct: 1.5, prepaidToman: 200000000, delayPenaltyPerDayPct: 0.05 },
        status: "confirmed",
        payments: [{ amount: 300000000, method: "bank", note: "علی‌الحساب کارخانه" }],
      },
      {
        mode: "guaranteed",
        cropKey: "wheat",
        sellerName: "مزرعه سبز دشت",
        buyerName: "سیلو امیدیه — شرکت بازرگانی دولتی",
        buyerType: "silo",
        quantity: 40,
        price: 49650,
        quality: { moisturePct: 13.5, foreignMatterPct: 1.2, brokenPct: 1.5, pestPct: 0.1, hectoliter: 79, proteinPct: 12.4 },
        policy: { transportToman: 6000000 },
        status: "settled",
        payments: [],
      },
      {
        mode: "factory",
        cropKey: "barley",
        sellerName: "اکبر جوکار",
        buyerName: "شرکت خوراک دام پارس",
        buyerType: "factory",
        quantity: 12,
        price: 30000,
        quality: { moisturePct: 15.8, foreignMatterPct: 1.4, brokenPct: 2, pestPct: 0, hectoliter: 74, proteinPct: 0 },
        policy: {},
        status: "draft",
        payments: [],
      },
    ];

    let sequence = 1;
    const year = currentJalaliYear();
    for (const template of templates) {
      const crop = getCrop(template.cropKey);
      const preset = defaultPolicy(template.mode, crop);
      const policy = { ...preset, ...(template.policy ?? {}) } as typeof preset;
      const quality = { ...defaultQuality(crop), ...template.quality };
      const input: TradeInput = {
        direction: "sell",
        mode: template.mode,
        cropKey: template.cropKey,
        unit: "ton",
        quantity: template.quantity,
        grossKg: 0,
        tareKg: 0,
        pricePerKgToman: template.price,
        quality,
        policy,
        meta: {
          sellerName: template.sellerName,
          buyerName: template.buyerName,
          contractDate: iso(-14),
          deliveryDate: iso(-10),
          dueDate: iso(7),
          deliveryPlace: "محل خریدار — باسکول شماره ۲",
        },
      };
      const calc = computeTrade(input);
      const prepaid = Number(policy.prepaidToman) || 0;
      const paid = template.payments.reduce((sum, item) => sum + item.amount, 0) + prepaid;
      const [row] = await db
        .insert(cropTrades)
        .values({
          code: tradeCode(year, sequence),
          direction: "sell",
          mode: template.mode,
          cropKey: template.cropKey,
          cropName: crop.name,
          variety: template.cropKey === "wheat" ? "پیشتاز" : "",
          sellerName: template.sellerName,
          sellerNationalId: "1234567890",
          sellerPhone: "09120000000",
          buyerName: template.buyerName,
          buyerType: template.buyerType,
          buyerNationalId: "14001234567",
          buyerPhone: "06130000000",
          province: "خوزستان",
          deliveryPlace: "محل خریدار — باسکول شماره ۲",
          vehiclePlate: "۲۲ ب ۴۵۶ — ایران ۷۸",
          driverName: "مهدی کرمی",
          contractDate: iso(-14),
          deliveryDate: iso(-10),
          dueDate: iso(7),
          unit: "ton",
          quantityInput: template.quantity,
          netKg: calc.weights.netKg,
          adjustedKg: calc.weights.adjustedKg,
          moisturePct: quality.moisturePct,
          foreignMatterPct: quality.foreignMatterPct,
          brokenPct: quality.brokenPct,
          pestPct: quality.pestPct,
          hectoliter: quality.hectoliter,
          proteinPct: quality.proteinPct,
          pricePerKgToman: template.price,
          grade: calc.quality.grade,
          gradeLabel: calc.quality.gradeLabel,
          totalToman: calc.money.totalToman,
          prepaidToman: prepaid,
          paidToman: paid,
          status: template.status,
          notes: "نمونه اولیه برای آشنایی با اسناد و گزارش‌ها",
          terms: "تحویل در محل خریدار و پرداخت مانده تا سررسید توافق‌شده.",
          engineVersion: calc.engineVersion,
          input: input as unknown as Record<string, unknown>,
          calc: calc as unknown as Record<string, unknown>,
        })
        .returning({ id: cropTrades.id });

      if (prepaid > 0) {
        await db.insert(tradePayments).values({
          tradeId: row.id,
          amountToman: prepaid,
          paidAt: iso(-14),
          method: "cash",
          note: "پیش‌پرداخت زمان قرارداد",
        });
      }
      for (const payment of template.payments) {
        await db.insert(tradePayments).values({
          tradeId: row.id,
          amountToman: payment.amount,
          paidAt: iso(-4),
          method: payment.method,
          reference: "۱۲۳۴۵۶۷۸۹",
          note: payment.note,
        });
      }
      sequence += 1;
    }

    await db.insert(knowledge).values([
      {
        topic: "فروش محصول",
        title: "پیش از فروش گندم چه چیزی را کنترل کنیم؟",
        tags: "گندم، کیفیت، رطوبت، ناخالصی، فروش",
        level: "پایه",
        content:
          "رطوبت گندم در تحویل به مراکز خرید تضمینی حداکثر ۱۴٪ است. ناخالصی مجاز معمول ۲٪ است و مازاد آن به‌صورت وزنی کسر می‌شود. وزن هکتولیتر، دانه شکسته و سن‌زدگی در درجه‌بندی اثر دارند. پیش از امضای قرارداد، نرخ روز و حق بیمه را کنترل کنید و صورت‌حساب کسورات را دریافت کنید.",
      },
      {
        topic: "فروش محصول",
        title: "تفاوت خرید تضمینی و فروش به کارخانه",
        tags: "خرید تضمینی، کارخانه، قرارداد، افت",
        level: "متوسط",
        content:
          "در خرید تضمینی، افت مفید ۳٪ و غیرمفید ۱٪ به‌همراه حق بیمه اعمال می‌شود و نرخ مصوب است. در فروش به کارخانه، قیمت، افت رطوبت، کارمزد و کرایه توافقی است؛ بنابراین محاسبه دقیق و مکتوب کسورات اهمیت بیشتری دارد. در هر دو حالت، قبض باسکول و صورتجلسه کیفیت را نگه دارید.",
      },
    ]);
  } catch (error) {
    console.error("trade seed skipped", error);
  }
}

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = seedData().catch((error) => {
      seedPromise = null;
      console.error("seed failed", error);
    });
  }
  await seedPromise;
}
