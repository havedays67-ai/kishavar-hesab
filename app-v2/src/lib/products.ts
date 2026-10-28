/**
 * فهرست کامل و مرتب محصولات کشاورزی + جستجوی مقاوم به غلط املایی
 * -----------------------------------------------------------------
 * کاربر می‌تواند از فهرست دسته‌بندی‌شده انتخاب کند، جستجو کند، یا نام محصول
 * خودش را بنویسد. جستجو با نرمال‌سازی فارسی، حذف نیم‌فاصله و مترادف‌ها کار
 * می‌کند تا «افتابگردان» یا «sun flower» هم پیدا شود.
 */
export type ProductCategory =
  | "غلات"
  | "دانه‌های روغنی"
  | "نباتات علوفه‌ای"
  | "سبزیجات"
  | "صیفی‌جات"
  | "میوه و درخت"
  | "حبوبات"
  | "صنعتی و نقدی"
  | "دامی و طیور";

export interface ProductItem {
  name: string;
  category: ProductCategory;
  aliases?: string[];
}

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  "غلات",
  "دانه‌های روغنی",
  "نباتات علوفه‌ای",
  "سبزیجات",
  "صیفی‌جات",
  "میوه و درخت",
  "حبوبات",
  "صنعتی و نقدی",
  "دامی و طیور",
];

export const PRODUCTS: ProductItem[] = [
  { name: "گندم", category: "غلات", aliases: ["wheat"] },
  { name: "جو", category: "غلات", aliases: ["barley"] },
  { name: "برنج", category: "غلات", aliases: ["شالی", "rice"] },
  { name: "ذرت", category: "غلات", aliases: ["ذرت دانه‌ای", "corn", "maize"] },
  { name: "ذرت علوفه‌ای", category: "نباتات علوفه‌ای", aliases: ["سورگوم"] },
  { name: "ترتیکاله", category: "غلات" },
  { name: "چاودار", category: "غلات" },
  { name: "یولاف", category: "غلات", aliases: ["جو دوسر"] },
  { name: "ارزن", category: "غلات" },
  { name: "شلتوک", category: "غلات", aliases: ["برنج شلتوک"] },

  { name: "تخم آفتابگردان", category: "دانه‌های روغنی", aliases: ["آفتابگردان", "افتوگردان", "sunflower"] },
  { name: "کلزا", category: "دانه‌های روغنی", aliases: ["کانولا", "canola"] },
  { name: "کنجد", category: "دانه‌های روغنی", aliases: ["sesame"] },
  { name: "سویا", category: "دانه‌های روغنی", aliases: ["soybean"] },
  { name: "بادام زمینی", category: "دانه‌های روغنی", aliases: ["بامیه زمینی", "peanut"] },
  { name: "گلرنگ", category: "دانه‌های روغنی", aliases: ["کاجیره"] },
  { name: "زیتون", category: "میوه و درخت", aliases: ["olive"] },

  { name: "یونجه", category: "نباتات علوفه‌ای", aliases: ["alfalfa"] },
  { name: "شبدر", category: "نباتات علوفه‌ای" },
  { name: "اسپرس", category: "نباتات علوفه‌ای" },
  { name: "کاه و کلش", category: "نباتات علوفه‌ای", aliases: ["کاه", "کلش"] },
  { name: "سیلوی ذرت", category: "نباتات علوفه‌ای" },

  { name: "سیب‌زمینی", category: "سبزیجات", aliases: ["سیب زمینی", "potato"] },
  { name: "پیاز", category: "سبزیجات", aliases: ["onion"] },
  { name: "سیر", category: "سبزیجات", aliases: ["garlic"] },
  { name: "هویج", category: "سبزیجات", aliases: ["carrot"] },
  { name: "چغندرقند", category: "صنعتی و نقدی", aliases: ["چغندر قند", "sugar beet"] },
  { name: "کلم", category: "سبزیجات" },
  { name: "کاهو", category: "سبزیجات", aliases: ["lettuce"] },
  { name: "اسفناج", category: "سبزیجات", aliases: ["spinach"] },
  { name: "تربچه", category: "سبزیجات" },
  { name: "شلغم", category: "سبزیجات" },
  { name: "بامیه", category: "سبزیجات", aliases: ["okra"] },
  { name: "کرفس", category: "سبزیجات" },
  { name: "جعفری", category: "سبزیجات" },
  { name: "ریحان", category: "سبزیجات" },
  { name: "نعناع", category: "سبزیجات", aliases: ["نعنا"] },

  { name: "گوجه‌فرنگی", category: "صیفی‌جات", aliases: ["گوجه", "tomato"] },
  { name: "خیار", category: "صیفی‌جات", aliases: ["خیار سبز", "cucumber"] },
  { name: "فلفل", category: "صیفی‌جات", aliases: ["فلفل دلمه‌ای", "pepper"] },
  { name: "بادمجان", category: "صیفی‌جات", aliases: ["eggplant"] },
  { name: "کدو", category: "صیفی‌جات", aliases: ["کدو سبز", "zucchini"] },
  { name: "هندوانه", category: "صیفی‌جات", aliases: ["watermelon"] },
  { name: "خربزه", category: "صیفی‌جات", aliases: ["melon"] },
  { name: "طالبی", category: "صیفی‌جات" },
  { name: "شه‌دانه", category: "صیفی‌جات" },

  { name: "سیب", category: "میوه و درخت", aliases: ["apple"] },
  { name: "گلابی", category: "میوه و درخت", aliases: ["pear"] },
  { name: "انار", category: "میوه و درخت", aliases: ["pomegranate"] },
  { name: "انگور", category: "میوه و درخت", aliases: ["grapes", "کشمش"] },
  { name: "خرما", category: "میوه و درخت", aliases: ["date"] },
  { name: "زردآلو", category: "میوه و درخت", aliases: ["apricot"] },
  { name: "هلو", category: "میوه و درخت", aliases: ["peach"] },
  { name: "آلو", category: "میوه و درخت", aliases: ["plum"] },
  { name: "گیلاس", category: "میوه و درخت", aliases: ["cherry"] },
  { name: "پرتقال", category: "میوه و درخت", aliases: ["orange"] },
  { name: "لیمو", category: "میوه و درخت", aliases: ["lemon"] },
  { name: "نارنگی", category: "میوه و درخت", aliases: ["mandarin"] },
  { name: "کیوی", category: "میوه و درخت", aliases: ["kiwi"] },
  { name: "پسته", category: "میوه و درخت", aliases: ["pistachio"] },
  { name: "بادام", category: "میوه و درخت", aliases: ["almond"] },
  { name: "گردو", category: "میوه و درخت", aliases: ["walnut"] },
  { name: "فندق", category: "میوه و درخت", aliases: ["hazelnut"] },
  { name: "انجیر", category: "میوه و درخت", aliases: ["fig"] },
  { name: "توت", category: "میوه و درخت" },
  { name: "زعفران", category: "صنعتی و نقدی", aliases: ["saffron"] },

  { name: "لوبیا", category: "حبوبات", aliases: ["bean"] },
  { name: "نخود", category: "حبوبات", aliases: ["chickpea"] },
  { name: "عدس", category: "حبوبات", aliases: ["lentil"] },
  { name: "ماش", category: "حبوبات", aliases: ["mung bean"] },
  { name: "باقلا", category: "حبوبات", aliases: ["fava bean"] },

  { name: "پنبه", category: "صنعتی و نقدی", aliases: ["cotton", "وشم"] },
  { name: "تنباکو", category: "صنعتی و نقدی", aliases: ["توتون"] },
  { name: "چای", category: "صنعتی و نقدی", aliases: ["tea"] },
  { name: "نیشکر", category: "صنعتی و نقدی", aliases: ["sugarcane"] },

  { name: "علوفه", category: "نباتات علوفه‌ای" },
  { name: "کود دامی", category: "دامی و طیور", aliases: ["کود حیوانی"] },
  { name: "پشم", category: "دامی و طیور" },
  { name: "تخم‌مرغ", category: "دامی و طیور", aliases: ["تخم مرغ"] },
  { name: "عسل", category: "دامی و طیور" },
];

/** نرمال‌سازی مقاوم برای جستجو: ی/ک عربی، نیم‌فاصله، اعراب، فاصله، حروف کوچک. */
export function normalizeProductQuery(input: string): string {
  return String(input ?? "")
    .replace(/[۰-۹٠-٩]/g, (digit) => Number("۰۱۲۳۴۵۶۷۸۹".indexOf(digit) >= 0 ? "۰۱۲۳۴۵۶۷۸۹".indexOf(digit) : "٠١٢٣٤٥٦٧٨٩".indexOf(digit)).toString())
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[أإآ]/g, "ا")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[\u200c\u200d]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function editableDistance(a: string, b: string): number {
  if (a === b) return 0;
  const rows = b.length + 1;
  const columns = a.length + 1;
  let previous = new Array<number>(columns).fill(0).map((_value, index) => index);
  for (let row = 1; row < rows; row += 1) {
    const current = new Array<number>(columns).fill(0);
    current[0] = row;
    for (let column = 1; column < columns; column += 1) {
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + (b[row - 1] === a[column - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[columns - 1];
}

/** جستجوی محصول: تطبیق مستقیم، مترادف و یک خطای تایپی. */
export function searchProducts(query: string, limit = 60): ProductItem[] {
  const needle = normalizeProductQuery(query).replace(/ /g, "");
  if (!needle) return PRODUCTS.slice(0, limit);
  const scored = PRODUCTS.map((item) => {
    const names = [item.name, ...(item.aliases ?? [])].map((value) => normalizeProductQuery(value));
    let score = 0;
    for (const name of names) {
      const compact = name.replace(/ /g, "");
      if (compact === needle) score = Math.max(score, 100);
      else if (compact.startsWith(needle)) score = Math.max(score, 80);
      else if (compact.includes(needle)) score = Math.max(score, 60);
      else if (needle.length >= 4 && editableDistance(compact, needle) <= 1) score = Math.max(score, 40);
      else if (needle.length >= 5 && compact.includes(needle.slice(0, 4))) score = Math.max(score, 20);
    }
    return { item, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name, "fa"));
  return scored.slice(0, limit).map((entry) => entry.item);
}

/** فهرست گروه‌بندی‌شده و مرتب برای نمایش. */
export function productsByCategory(): { category: ProductCategory; items: ProductItem[] }[] {
  return PRODUCT_CATEGORIES.map((category) => ({
    category,
    items: PRODUCTS.filter((item) => item.category === category).sort((a, b) => a.name.localeCompare(b.name, "fa")),
  })).filter((group) => group.items.length > 0);
}

/** جستجوی سریع نام محصول (برای NLP و پیشنهادها). */
export function findProductName(raw: string): string | null {
  const [first] = searchProducts(raw, 1);
  return first ? first.name : null;
}

export const PRODUCTS_VERSION = "1.0.0";
