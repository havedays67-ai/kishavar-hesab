/**
 * دروازهٔ هوش «کشاورزیار» — هستهٔ قطعی و قابل‌تست
 * ------------------------------------------------------------
 * این فایل هیچ کلید، هیچ آدرس و هیچ شبکه‌ای ندارد. فقط منطقِ:
 *   ۱) انتخاب ترتیب ارائه‌دهنده‌ها (پنج API) با قطع‌کنندهٔ مدار،
 *   ۲) جابه‌جایی خودکار وسط کار بدون از دست دادن حافظه،
 *   ۳) مسیریابی مصرف توکن (چه زمانی فکر نکنیم / کم / عمیق)،
 *   ۴) نگهبان دامنه (فقط کشاورزی و خود برنامه)،
 *   ۵) اعتبارسنجی پاسخ پیش از نمایش.
 *
 * حافظهٔ گفتگو در سمت کلاینت نگه داشته می‌شود و در هر درخواست کامل
 * فرستاده می‌شود؛ بنابراین اگر ارائه‌دهندهٔ دوم جای اول را بگیرد،
 * دقیقاً همان زمینه را می‌بیند و «رشتهٔ کلام» پاره نمی‌شود.
 */

export interface ProviderConfig {
  /** شناسهٔ پایدار؛ در گزارش‌ها و کش استفاده می‌شود. */
  id: string;
  label: string;
  model: string;
}

export interface ProviderHealth {
  failures: number;
  /** زمان پایان دورهٔ خنک‌شدن کامل (circuit open)؛ تا آن زمان کنار می‌رود. */
  openUntil: number;
  /** استراحت کوتاه پس از یک خطا؛ بعد از آن دوباره امتحان می‌شود. */
  skipUntil: number;
  /** میانگین متحرک تأخیر برای مرتب‌سازی سالم‌ها. */
  latencyMs: number;
  lastError: string;
}

export interface ChatTurn {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface ChatRequest {
  messages: ChatTurn[];
  maxTokens: number;
  temperature?: number;
  /** پاسخ باید JSON خالص باشد (برای تصمیم‌های ساختاریافته). */
  json?: boolean;
  signal?: AbortSignal;
}

export interface ChatResult {
  text: string;
  providerId: string;
  latencyMs: number;
}

export type Transport = (provider: ProviderConfig, request: ChatRequest) => Promise<ChatResult>;

export interface GatewayOptions {
  providers: ProviderConfig[];
  transport: Transport;
  /** بعد از این تعداد خطای پیاپی، مدار باز می‌شود. */
  failureThreshold?: number;
  /** مدت خنک‌شدن مدار باز (ms). */
  cooldownMs?: number;
  /** سقف تلاش کل روی همهٔ ارائه‌دهنده‌ها. */
  maxAttempts?: number;
  /** بعد از یک خطا، این مدت (ms) به سراغ بقیه می‌رویم و بعد دوباره امتحان می‌کنیم. */
  retryAfterMs?: number;
  now?: () => number;
}

export interface GatewayHandle {
  chat(request: ChatRequest): Promise<ChatResult>;
  health(): ProviderHealth[];
  /** برای شروع تازه (مثلاً بعد از وصل شدن اینترنت). */
  reset(): void;
}

const DEFAULT_FAILURE_THRESHOLD = 2;
const DEFAULT_COOLDOWN_MS = 45_000;

/**
 * ترتیب اجرا: اول سالم‌ها دقیقاً به ترتیب اولویتِ تنظیمات (یک → دو → سه…)،
 * بعد آن‌هایی که تازه خطا داده‌اند (استراحت کوتاه)، و آخر مدارهای باز.
 * بنابراین «API شمارهٔ یک» همیشه اول است و فقط وقتی مشکل دارد جایش عوض می‌شود.
 */
export function orderProviders(
  providers: ProviderConfig[],
  health: Record<string, ProviderHealth>,
  now: number
): ProviderConfig[] {
  const rank = (provider: ProviderConfig) => {
    const row = health[provider.id];
    if (!row) return 0;
    if (row.openUntil > now) return 2;
    if (row.skipUntil > now) return 1;
    return 0;
  };
  return [...providers].sort((a, b) => {
    const left = rank(a);
    const right = rank(b);
    if (left !== right) return left - right;
    if (left === 2) return (health[a.id]?.openUntil ?? 0) - (health[b.id]?.openUntil ?? 0);
    if (left === 1) return (health[a.id]?.skipUntil ?? 0) - (health[b.id]?.skipUntil ?? 0);
    return providers.indexOf(a) - providers.indexOf(b);
  });
}

/** نگهبان دامنه: فقط کشاورزی، دام، دفتر مالی، اسناد و خود برنامه. */
const DOMAIN_TERMS = [
  "کشاورز", "کشت", "بذر", "گندم", "جو", "برنج", "ذرت", "پنبه", "کلزا", "یونجه", "سیب", "انگور", "خرما", "زیتون", "پسته", "بادام", "گردو",
  "آبیاری", "آب", "خاک", "کود", "سم", "آفت", "بیماری", "برداشت", "خرمن", "تراکتور", "کمباین", "درو", "مالچ", "گلخانه", "قلمه", "نهال",
  "دام", "گوسفند", "بز", "گاو", "مرغ", "طیور", "علوفه", "شیر", "پشم", "زنبور", "عسل", "ماهی", "قفس",
  "زمین", "هکتار", "متر", "اجاره", "قرارداد", "سند", "چک", "وام", "قسط", "بدهی", "طلب", "فروش", "خرید", "انبار", "قیمت", "بازار", "تعرفه",
  "مالیات", "بیمه", "یارانه", "تسهیلات", "فصل", "کاشت", "داشت", "داشت‌برداشت", "زراعت", "باغ", "دامداری", "کشاورزیار", "کشاورزحساب", "برنامه",
];

export function isInDomain(text: string): boolean {
  const value = text.replace(/[\u064A\u0643]/g, (c) => (c === "\u064A" ? "\u06CC" : "\u06A9")).toLowerCase();
  return DOMAIN_TERMS.some((term) => value.includes(term));
}

// پاسخ مودبانهٔ خارج از دامنه؛ بدون مصرف توکن.
export const OUT_OF_DOMAIN_REPLY =
  "من فقط دستیار کشاورزی و همین برنامه‌ام: کشت و کار، دام، آب و خاک، نهاده، قیمت بازار، و دفتر مالی/اسناد مزرعه. دربارهٔ همین‌ها بپرسید تا دقیق راهنمایی کنم.";

export type RequestClass = "local" | "shallow" | "standard" | "deep";

export interface RouteDecision {
  kind: RequestClass;
  maxTokens: number;
  needsSearch: boolean;
  needsMath: boolean;
  reason: string;
}

const LOCAL_HINTS = /^(سلام|درود|ممنون|مرسی|خداحافظ|کمک|راهنما|چطوری)/;
const MATH_HINTS = /(درصد|سود|زیان|هکتار|متر مربع|تقسیم|ضرب|جمع|میانگین|تبدیل)/;
const SEARCH_HINTS = /(قیمت|بازار|نرخ|کشت|کاشت|زمان|چه وقت|کی بکارم|چی بکارم|کود|سم|آب و هوا|هوا|باران|یارانه|بیمه|تعرفه|قانون|مجاز|ممنوع)/;
const DEEP_HINTS = /(برنامه|برنامه‌ریزی|مقایسه|بهترین|تصمیم|تحلیل|پیشنهاد|چرا|ریسک|صرفه|اقتصاد|کدام)/;

/**
 * مسیریابی صرفه‌جویانه: بیشتر پرسش‌ها با موتور محلی جواب می‌گیرند و
 * هیچ توکنی مصرف نمی‌شود. جست‌وجو فقط برای دادهٔ زنده/منطقه‌ای، و
 * «فکر عمیق» فقط برای تصمیم‌های چندعاملی.
 */
export function routeRequest(text: string, options: { hasLocalAnswer?: boolean; profileRegion?: string } = {}): RouteDecision {
  const value = text.trim();
  if (!value) return { kind: "local", maxTokens: 0, needsSearch: false, needsMath: false, reason: "خالی" };
  if (LOCAL_HINTS.test(value) && value.length <= 24) {
    return { kind: "local", maxTokens: 0, needsSearch: false, needsMath: false, reason: "سلام/کمک" };
  }
  if (options.hasLocalAnswer) {
    return { kind: "local", maxTokens: 0, needsSearch: false, needsMath: MATH_HINTS.test(value), reason: "پاسخ قطعی محلی" };
  }
  const needsSearch = SEARCH_HINTS.test(value) || Boolean(options.profileRegion && /منطقه|روستا|شهر|این‌جا|اینجا|محل/.test(value));
  const needsMath = MATH_HINTS.test(value);
  if (DEEP_HINTS.test(value) || (needsSearch && needsMath)) {
    return { kind: "deep", maxTokens: 900, needsSearch: true, needsMath, reason: "تصمیم چندعاملی" };
  }
  if (needsSearch) return { kind: "standard", maxTokens: 520, needsSearch: true, needsMath, reason: "دادهٔ زنده/منطقه‌ای" };
  if (value.length > 120) return { kind: "standard", maxTokens: 480, needsSearch: false, needsMath, reason: "پرسش بلند" };
  return { kind: "shallow", maxTokens: 220, needsSearch: false, needsMath, reason: "پرسش کوتاه" };
}

export interface VerifiedReply {
  ok: boolean;
  text: string;
  reason?: string;
}

const FORBIDDEN = /(ignore previous|system prompt|api key|کلید api|دستورهای قبلی)/i;

/** اعتبارسنجی نهایی؛ هر پاسخ مشکوک رد می‌شود و به لایهٔ محلی برمی‌گردد. */
export function verifyReply(text: string, options: { json?: boolean; maxLength?: number } = {}): VerifiedReply {
  const value = (text ?? "").trim();
  if (!value) return { ok: false, text: "", reason: "پاسخ خالی" };
  if (FORBIDDEN.test(value)) return { ok: false, text: "", reason: "محتوای حساس" };
  if (options.maxLength && value.length > options.maxLength) return { ok: false, text: "", reason: "بیش از حد بلند" };
  if (/[<>]script/i.test(value)) return { ok: false, text: "", reason: "HTML ناامن" };
  if (options.json) {
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== "object") return { ok: false, text: "", reason: "JSON غیرشیء" };
    } catch {
      const start = value.indexOf("{");
      const end = value.lastIndexOf("}");
      if (start === -1 || end <= start) return { ok: false, text: "", reason: "JSON نامعتبر" };
      try {
        JSON.parse(value.slice(start, end + 1));
      } catch {
        return { ok: false, text: "", reason: "JSON نامعتبر" };
      }
    }
  }
  return { ok: true, text: value };
}

export function createGateway(options: GatewayOptions): GatewayHandle {
  const failureThreshold = options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const maxAttempts = options.maxAttempts ?? Math.max(1, options.providers.length);
  const retryAfterMs = options.retryAfterMs ?? 15_000;
  const now = options.now ?? (() => Date.now());
  const health: Record<string, ProviderHealth> = {};

  const row = (id: string): ProviderHealth => {
    health[id] ??= { failures: 0, openUntil: 0, skipUntil: 0, latencyMs: 0, lastError: "" };
    return health[id];
  };

  return {
    async chat(request: ChatRequest): Promise<ChatResult> {
      const ordered = orderProviders(options.providers, health, now());
      const errors: string[] = [];
      let attempts = 0;

      for (const provider of ordered) {
        if (attempts >= maxAttempts) break;
        const current = row(provider.id);
        if (current.openUntil > now() || current.skipUntil > now()) {
          errors.push(`${provider.id}: در استراحت`);
          continue;
        }
        attempts += 1;
        const started = now();
        try {
          const result = await options.transport(provider, request);
          const latency = Math.max(1, now() - started);
          current.failures = 0;
          current.openUntil = 0;
          current.skipUntil = 0;
          current.latencyMs = current.latencyMs === 0 ? latency : Math.round(current.latencyMs * 0.7 + latency * 0.3);
          current.lastError = "";
          return { ...result, providerId: provider.id, latencyMs: latency };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          current.failures += 1;
          current.lastError = message.slice(0, 160);
          current.skipUntil = now() + retryAfterMs;
          if (current.failures >= failureThreshold) current.openUntil = now() + cooldownMs;
          errors.push(`${provider.id}: ${message.slice(0, 60)}`);
          // حافظه دست‌نخورده است؛ درخواست بعدی با همان messages کامل می‌رود.
        }
      }

      throw new Error(`همهٔ ارائه‌دهنده‌ها ناموفق بودند: ${errors.join(" | ")}`);
    },
    health() {
      return options.providers.map((provider) => ({ ...row(provider.id) }));
    },
    reset() {
      for (const key of Object.keys(health)) delete health[key];
    },
  };
}

/** خلاصهٔ حافظه برای فرستادن به ارائه‌دهنده؛ عددها ماسک می‌شوند. */
export interface MemoryTurn {
  role: "user" | "assistant";
  content: string;
}

export function buildMemoryContext(turns: MemoryTurn[], options: { maxTurns?: number; maxChars?: number } = {}): ChatTurn[] {
  const maxTurns = options.maxTurns ?? 12;
  const maxChars = options.maxChars ?? 4000;
  const recent = turns.slice(-maxTurns);
  const out: ChatTurn[] = [];
  let used = 0;
  for (const turn of recent) {
    const masked = turn.content.replace(/\d[\d,٬.]*/g, "#").slice(0, 600);
    if (used + masked.length > maxChars) break;
    out.push({ role: turn.role, content: masked });
    used += masked.length;
  }
  return out;
}
