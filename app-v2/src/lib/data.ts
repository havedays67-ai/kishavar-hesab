import { addJalaliYears, todayJalali, type JDate } from "./format";

export type Page =
  | "dashboard"
  | "trade"
  | "quick-sale"
  | "contracts"
  | "rentals"
  | "crops"
  | "finance"
  | "parties"
  | "inventory"
  | "documents"
  | "reports"
  | "backup"
  | "signatures"
  | "reminders"
  | "profile"
  | "architecture"
  | "download";
export type Role = "tenant" | "landlord";
export type ContractTypeId = "cash" | "share" | "mixed" | "irrigation" | "partnership";
export type ContractStatus = "active" | "pending" | "expired";

export interface Party {
  id: string;
  name: string;
  phone: string;
  role: Role;
  city: string;
  detail: string;
  color: "mint" | "sand" | "blue" | "rose";
}

export interface ContractType {
  id: ContractTypeId;
  label: string;
  short: string;
  description: string;
}

export const CONTRACT_TYPES: ContractType[] = [
  {
    id: "cash",
    label: "اجاره نقدی",
    short: "نقدی",
    description: "مبلغی ثابت و دوره‌ای برای بهره‌برداری از زمین",
  },
  {
    id: "share",
    label: "مزارعه (سهم محصول)",
    short: "سهم محصول",
    description: "زمین در اختیار زارع؛ سهم هر طرف از محصول مشخص می‌شود",
  },
  {
    id: "mixed",
    label: "ترکیبی",
    short: "ترکیبی",
    description: "اجاره نقدی همراه با درصدی از محصول",
  },
  {
    id: "irrigation",
    label: "مساقات",
    short: "مساقات",
    description: "آبیاری و نگهداری درختان در برابر سهم از محصول",
  },
  {
    id: "partnership",
    label: "مشارکت در کشت",
    short: "مشارکت",
    description: "تقسیم هزینه‌ها و سود بر اساس نسبت توافق‌شده",
  },
];

export const CROPS = [
  "گندم", "جو", "کلزا", "ذرت دانه‌ای", "ذرت علوفه‌ای", "چغندرقند", "نیشکر", "پنبه", "آفتابگردان", "سویا",
  "زعفران", "پسته", "بادام", "گردو", "زیتون", "انار", "انگور", "سیب", "زردآلو", "هلو", "گیلاس", "آلو",
  "گلابی", "به", "انجیر", "خرما", "نارنگی", "پرتقال", "کیوی", "توت‌فرنگی", "هندوانه", "خربزه", "طالبی",
  "سیب‌زمینی", "پیاز", "سیر", "گوجه‌فرنگی", "خیار", "بادمجان", "فلفل", "کدو", "هویج", "شلغم", "چغندر برگی",
  "کاهو", "اسفناج", "جعفری", "ریحان", "نخود", "لوبیا", "عدس", "ماش", "کنجد", "کرچک", "یونجه", "شبدر", "ارزن", "سورگوم",
  "گیاهان دارویی", "زیره", "زرشک", "گل محمدی", "قارچ", "چای", "تنباکو", "سایر",
];
export const PAYMENT_PERIODS = ["ماهانه", "فصلی", "شش‌ماهه", "سالانه", "یک‌جا"];
export const UTILITY_OPTIONS = ["مستاجر", "موجر", "مشترک"];

export const MY_BUSINESS = {
  name: "کسب‌وکار من",
  sub: "دفتر کل آرام · حسابداری عمومی",
  owner: "محمدرضا کریمی",
  nationalId: "۰۴۵-۹۸۷۶۵۴۳-۲",
  farm: "مزرعه سبز دشت مغان",
  location: "اردبیل، پارس‌آباد",
  initials: "م.ک",
};

export const initialParties: Party[] = [
  {
    id: "party-landlord-1",
    name: "حاج رضا کاویانی",
    phone: "۰۹۱۲ ۴۸۸ ۲۲۱۰",
    role: "landlord",
    city: "پارس‌آباد",
    detail: "مالک قطعه شمالی · ۱۲.۵ هکتار",
    color: "sand",
  },
  {
    id: "party-landlord-2",
    name: "محمدامین شفیعی",
    phone: "۰۹۱۵ ۳۲۱ ۸۸۴۴",
    role: "landlord",
    city: "اردبیل",
    detail: "مالک زمین جنوبی · ۸ هکتار",
    color: "blue",
  },
  {
    id: "party-tenant-1",
    name: "سعید نوروزی",
    phone: "۰۹۱۴ ۷۷۳ ۵۱۲۱",
    role: "tenant",
    city: "اصلاندوز",
    detail: "مستاجر باغ شرقی · ۴ هکتار",
    color: "mint",
  },
  {
    id: "party-tenant-2",
    name: "مهدی رضایی",
    phone: "۰۹۳۵ ۲۱۶ ۹۰۴۴",
    role: "tenant",
    city: "پارس‌آباد",
    detail: "مستاجر قطعه پسته · ۶ هکتار",
    color: "rose",
  },
];

export interface ContractSignature {
  id: string;
  role: "landlord" | "tenant" | "witness";
  signerName: string;
  phone: string;
  image: string;
  hash: string;
  signedAt: JDate;
  crypto?: { algorithm: string; publicKey: string; signature: string; keyFingerprint: string };
}

export interface SavedContract {
  id: string;
  code: string;
  trackingCode?: string;
  myName?: string;
  myRole: Role;
  signatures?: ContractSignature[];
  partyId: string;
  partyName: string;
  partyRole: Role;
  landTitle: string;
  crop: string;
  type: ContractTypeId;
  start: JDate;
  end: JDate;
  rent: number;
  deposit: number;
  period: string;
  cropShare: number;
  waterShare: string;
  utilities: string;
  obligations: string;
  area?: string;
  plaque?: string;
  status: ContractStatus;
  createdAt: JDate;
}

export const initialContracts: SavedContract[] = [
  {
    id: "contract-1",
    code: "۱۴۰۵-۰۸۴",
    myRole: "tenant",
    partyId: "party-landlord-1",
    partyName: "حاج رضا کاویانی",
    partyRole: "landlord",
    landTitle: "قطعه شمالی — چشمه",
    crop: "گندم",
    type: "cash",
    start: { jy: 1405, jm: 7, jd: 15 },
    end: { jy: 1406, jm: 7, jd: 14 },
    rent: 360000000,
    deposit: 100000000,
    period: "ماهانه",
    cropShare: 0,
    waterShare: "۶ ساعت در هفته از چاه مشترک",
    utilities: "مستاجر",
    obligations:
      "بهره‌بردار متعهد است زمین را فقط برای کشت گندم استفاده کند و پس از برداشت، کاه و کلش متعلق به مالک زمین است.",
    status: "active",
    createdAt: { jy: 1405, jm: 7, jd: 2 },
  },
  {
    id: "contract-2",
    code: "۱۴۰۵-۰۶۲",
    myRole: "landlord",
    partyId: "party-tenant-1",
    partyName: "سعید نوروزی",
    partyRole: "tenant",
    landTitle: "باغ زردآلو — شرقی",
    crop: "زردآلو",
    type: "irrigation",
    start: { jy: 1405, jm: 3, jd: 1 },
    end: { jy: 1406, jm: 2, jd: 29 },
    rent: 0,
    deposit: 50000000,
    period: "فصلی",
    cropShare: 40,
    waterShare: "آبیاری طبق برنامه باغ",
    utilities: "مشترک",
    obligations:
      "آبیاری، هرس و سم‌پاشی در زمان مناسب انجام شود. هزینه نهاده‌ها میان دو طرف به نسبت سهم محصول تقسیم می‌شود.",
    status: "active",
    createdAt: { jy: 1405, jm: 2, jd: 18 },
  },
  {
    id: "contract-3",
    code: "۱۴۰۵-۰۹۱",
    myRole: "tenant",
    partyId: "party-landlord-2",
    partyName: "محمدامین شفیعی",
    partyRole: "landlord",
    landTitle: "زمین جنوبی — کانال ۴",
    crop: "کلزا",
    type: "mixed",
    start: { jy: 1405, jm: 8, jd: 10 },
    end: { jy: 1406, jm: 6, jd: 31 },
    rent: 180000000,
    deposit: 75000000,
    period: "فصلی",
    cropShare: 25,
    waterShare: "سهم آب کانال ۴ به‌طور کامل",
    utilities: "موجر",
    obligations:
      "تأمین بذر و کود طبق برنامه کشت؛ تحویل زمین در وضعیت قابل کشت و رفع مانع آبیاری توسط موجر.",
    status: "pending",
    createdAt: { jy: 1405, jm: 8, jd: 1 },
  },
];

export const DASHBOARD_ACTIVITY = [
  { title: "پرداخت اجاره مرحله سوم", meta: "قرارداد ۱۴۰۵-۰۸۴ · حاج رضا کاویانی", amount: 30000000, type: "expense", day: "امروز" },
  { title: "دریافت سهم محصول زردآلو", meta: "قرارداد ۱۴۰۵-۰۶۲ · سعید نوروزی", amount: 24500000, type: "income", day: "دیروز" },
  { title: "سررسید ودیعه زمین جنوبی", meta: "قرارداد ۱۴۰۵-۰۹۱ · محمدامین شفیعی", amount: 75000000, type: "pending", day: "۳ روز آینده" },
];

export function currentContractCode(): string {
  const today = todayJalali();
  const sequence = `${today.jm}${today.jd}`.padStart(4, "0");
  return `${today.jy}-${sequence}`;
}

export function defaultContractDates(): { start: JDate; end: JDate } {
  const start = todayJalali();
  return { start, end: addJalaliYears(start, 1) };
}
