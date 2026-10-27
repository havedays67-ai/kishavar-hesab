/**
 * کشاورزحساب — نسخه آفلاین (MVP)
 * همه داده‌ها روی همین گوشی می‌مانند؛ هیچ درخواست شبکه‌ای وجود ندارد.
 * موتور پول قطعی است و مدل زبانی هیچ محاسبه‌ای انجام نمی‌دهد.
 */
import { parseAmount } from "../src/lib/engine/money";

type Kind = "income" | "expense";
type Tab = "home" | "list" | "assistant" | "report" | "add";

interface Txn {
  id: string;
  kind: Kind;
  amount: number;
  category: string;
  date: string;
  note: string;
  createdAt: string;
  source: "manual" | "assistant";
}
interface Audit {
  id: string;
  action: "create" | "delete";
  txnId: string;
  at: string;
  snapshot?: Txn;
}
interface DB {
  version: 1;
  txns: Txn[];
  audit: Audit[];
}
interface Msg {
  role: "bot" | "user";
  text: string;
}

const STORE = "kishavar.offline.v1";
const CATS: { re: RegExp; name: string; icon: string }[] = [
  { re: /کود|اوره|فسفات|نیتروژن/, name: "کود", icon: "🧪" },
  { re: /بذر|نهال/, name: "بذر", icon: "🌱" },
  { re: /سم|آفت|علف‌کش|قارچ/, name: "سم", icon: "🧴" },
  { re: /کارگر|دستمزد|نیروی کار/, name: "کارگر", icon: "👷" },
  { re: /سوخت|گازوئیل|بنزین|دیزل/, name: "سوخت", icon: "⛽" },
  { re: /آب|آبیاری|چاه|پمپ/, name: "آبیاری", icon: "💧" },
  { re: /گندم|جو|محصول|برداشت|فروش/, name: "محصول", icon: "🌾" },
  { re: /دام|گوسفند|گاو|علوفه/, name: "دام", icon: "🐄" },
  { re: /اجاره|زمین|باغ/, name: "اجاره", icon: "🏞️" },
  { re: /تراکتور|ماشین|تعمیر/, name: "ماشین‌آلات", icon: "🚜" },
];

const state = {
  db: load(),
  tab: "home" as Tab,
  month: localISO(new Date()).slice(0, 7),
  assistantMode: "assistant" as "assistant" | "support",
  messages: [
    { role: "bot", text: "سلام 👋 من دستیار آفلاین کشاورزحساب هستم. یک هزینه یا فروش را بنویس؛ پیش‌نویس می‌سازم و فقط با تأیید تو ثبت می‌شود." },
  ] as Msg[],
  pending: null as null | { kind: Kind; category: string; date: string; note: string },
  draft: null as null | Txn,
  toastTimer: 0 as number,
};

function uid(): string {
  try { return crypto.randomUUID(); } catch { return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2); }
}
function localISO(d: Date): string {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
function money(n: number): string {
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(Math.round(n)) + " تومان";
}
function monthLabel(m: string): string {
  try { return new Intl.DateTimeFormat("fa-IR", { month: "long", year: "numeric" }).format(new Date(m + "-01T12:00:00")); }
  catch { return m; }
}
function load(): DB {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || "null");
    if (raw && raw.version === 1 && Array.isArray(raw.txns)) {
      return { version: 1, txns: raw.txns.filter((t: Txn) => t && typeof t.amount === "number"), audit: Array.isArray(raw.audit) ? raw.audit : [] };
    }
  } catch { /* ignore */ }
  return { version: 1, txns: [], audit: [] };
}
function save(): void {
  try { localStorage.setItem(STORE, JSON.stringify(state.db)); } catch { toast("حافظه گوشی پر است"); }
}
function txnIcon(t: Txn): string {
  const c = CATS.find((x) => x.name === t.category);
  return c ? c.icon : t.kind === "income" ? "💰" : "🧾";
}
function totals(txns: Txn[]): { income: number; expense: number } {
  let income = 0, expense = 0;
  for (const t of txns) {
    if (t.kind === "income") income += t.amount; else expense += t.amount;
  }
  return { income, expense };
}
function inMonth(t: Txn): boolean { return t.date.slice(0, 7) === state.month; }

function handle(text: string): void {
  const t = text.trim();
  if (!t) return;
  state.messages.push({ role: "user", text: t });

  if (state.draft && /^(تایید|تأیید|بله|ثبت|ثبت کن|ok)$/i.test(t)) {
    confirmDraft();
    return;
  }
  if (state.draft && /^(لغو|نه|cancel)$/i.test(t)) {
    state.messages.push({ role: "bot", text: "پیش‌نویس لغو شد. چیزی ثبت نشد." });
    state.draft = null;
    render();
    return;
  }
  if (state.draft) {
    state.messages.push({ role: "bot", text: "یک پیش‌نویس باز است. اول «تأیید» یا «لغو» را بفرست." });
    render();
    return;
  }
  if (/(پاک|حذف همه|ریست|reset)/.test(t)) {
    state.messages.push({ role: "bot", text: "برای پاک کردن داده‌ها از تب «گزارش» و دکمه «پاک کردن همه داده‌ها» استفاده کن. من به‌تنهایی چیزی را پاک نمی‌کنم." });
    render();
    return;
  }
  if (state.pending) {
    const a = parseAmount(t);
    if (a) {
      state.draft = makeDraft(state.pending, a.amount, t);
      state.pending = null;
      state.messages.push({ role: "bot", text: "پیش‌نویس آماده شد. تأیید می‌کنی؟" });
      render();
      return;
    }
    state.messages.push({ role: "bot", text: "مبلغ را نفهمیدم. مثلاً «۲۵ میلیون» یا «۲۵۰۰۰۰۰۰» بنویس. برای لغو «لغو» را بفرست." });
    render();
    return;
  }
  if (/(گزارش|سود|زیان|جمع|خلاصه)/.test(t)) {
    state.messages.push({ role: "bot", text: reportText() });
    render();
    return;
  }
  if (state.assistantMode === "support") {
    state.messages.push({ role: "bot", text: supportReply(t) });
    render();
    return;
  }
  const kind = detectKind(t);
  if (!kind) {
    state.messages.push({ role: "bot", text: "متوجه نشدم این هزینه است یا فروش. مثلاً بنویس: «۲۵ میلیون کود اوره خریدم» یا «۱۰ میلیون گندم فروختم»." });
    render();
    return;
  }
  const a = parseAmount(t);
  const category = detectCategory(t, kind);
  const date = detectDate(t);
  if (!a) {
    state.pending = { kind, category, date, note: t };
    state.messages.push({ role: "bot", text: kind === "expense" ? "مبلغ این هزینه چند تومان بود؟" : "مبلغ این فروش چند تومان بود؟" });
    render();
    return;
  }
  state.draft = makeDraft({ kind, category, date, note: t }, a.amount, t);
  state.messages.push({ role: "bot", text: "پیش‌نویس آماده شد. تأیید می‌کنی؟" });
  render();
}
function detectKind(t: string): Kind | null {
  if (/(فروش|فروختم|درآمد|دریافت|وارد شد|کارت کشید)/.test(t)) return "income";
  if (/(خرید|خریدم|هزینه|پرداخت|دادم|نسیه)/.test(t)) return "expense";
  return null;
}
function detectCategory(t: string, kind: Kind): string {
  for (const c of CATS) if (c.re.test(t)) return c.name;
  return kind === "income" ? "محصول" : "سایر";
}
function detectDate(t: string): string {
  const today = new Date();
  if (/پریروز/.test(t)) { today.setDate(today.getDate() - 2); return localISO(today); }
  if (/دیروز/.test(t)) { today.setDate(today.getDate() - 1); return localISO(today); }
  if (/فردا/.test(t)) { today.setDate(today.getDate() + 1); return localISO(today); }
  return localISO(new Date());
}
function makeDraft(p: { kind: Kind; category: string; date: string; note: string }, amount: number, note: string): Txn {
  return { id: uid(), kind: p.kind, amount, category: p.category, date: p.date, note: note.slice(0, 160), createdAt: new Date().toISOString(), source: "assistant" };
}
function reportText(): string {
  const m = state.db.txns.filter(inMonth);
  const { income, expense } = totals(m);
  return `گزارش ${monthLabel(state.month)}:\nدرآمد: ${money(income)}\nهزینه: ${money(expense)}\nسود: ${money(income - expense)}\nتعداد تراکنش: ${m.length}`;
}
function supportReply(t: string): string {
  if (/(چطور|چگونه|ثبت|اضافه)/.test(t)) return "برای ثبت، تب «تراکنش‌ها» را باز کن، نوع (هزینه/درآمد)، مبلغ، دسته و تاریخ را وارد کن. در حالت دستیار می‌توانی جمله بنویسی؛ من پیش‌نویس می‌سازم و فقط با تأیید تو ثبت می‌شود.";
  if (/(کود|بذر|سم)/.test(t)) return "هزینه‌های نهاده (کود، بذر، سم) را در دسته‌ی خودش ثبت کن تا گزارش هزینه‌ی هر محصول دقیق شود. مبلغ را به تومان بنویس.";
  if (/(فروش|محصول)/.test(t)) return "فروش محصول را به‌عنوان «درآمد» ثبت کن و در یادداشت بنویس کدام زمین/محصول بوده تا گزارش سود قابل مقایسه شود.";
  return "من در حالت پشتیبان فقط راهنمایی می‌کنم و چیزی ثبت نمی‌کنم. برای ثبت، حالت «دستیار» را انتخاب کن یا از تب تراکنش‌ها استفاده کن.";
}

function confirmDraft(): void {
  const d = state.draft;
  if (!d) return;
  state.db.txns.unshift(d);
  state.db.audit.unshift({ id: uid(), action: "create", txnId: d.id, at: new Date().toISOString() });
  save();
  state.draft = null;
  state.messages.push({ role: "bot", text: `ثبت شد ✅\n${d.kind === "income" ? "درآمد" : "هزینه"} ${money(d.amount)} — ${d.category} — ${d.date}` });
  toast("ثبت شد", () => {
    state.db.txns = state.db.txns.filter((x) => x.id !== d.id);
    state.db.audit = state.db.audit.filter((x) => x.txnId !== d.id);
    save(); render();
  });
  render();
}

function addManual(kind: Kind, amount: number, category: string, date: string, note: string): void {
  const t: Txn = { id: uid(), kind, amount, category, date, note, createdAt: new Date().toISOString(), source: "manual" };
  state.db.txns.unshift(t);
  state.db.audit.unshift({ id: uid(), action: "create", txnId: t.id, at: new Date().toISOString() });
  save();
  toast("ثبت شد", () => {
    state.db.txns = state.db.txns.filter((x) => x.id !== t.id);
    state.db.audit = state.db.audit.filter((x) => x.txnId !== t.id);
    save(); render();
  });
  state.tab = "list";
  render();
}
function deleteTxn(id: string): void {
  const i = state.db.txns.findIndex((x) => x.id === id);
  if (i < 0) return;
  const [snap] = state.db.txns.splice(i, 1);
  state.db.audit.unshift({ id: uid(), action: "delete", txnId: id, at: new Date().toISOString(), snapshot: snap });
  save();
  toast("حذف شد", () => {
    state.db.txns.splice(Math.min(i, state.db.txns.length), 0, snap);
    state.db.audit = state.db.audit.filter((x) => x.id !== state.db.audit.find((a) => a.action === "delete" && a.txnId === id)?.id);
    save(); render();
  });
  render();
}

function toast(msg: string, undo?: () => void): void {
  const el = document.getElementById("toast")!;
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button id="undo">واگرد</button>' : ""}`;
  el.classList.add("on");
  if (undo) {
    const b = document.getElementById("undo");
    if (b) b.onclick = () => { undo(); el.classList.remove("on"); };
  }
  clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => el.classList.remove("on"), 5500);
}

function render(): void {
  const view = document.getElementById("view")!;
  const fab = document.getElementById("fab") as HTMLButtonElement;
  fab.classList.toggle("hide", state.tab !== "home");
  fab.onclick = () => { state.tab = "add"; render(); };
  document.querySelectorAll<HTMLButtonElement>("nav button").forEach((b) => {
    b.classList.toggle("on", b.dataset.tab === state.tab);
    b.onclick = () => { state.tab = (b.dataset.tab as Tab) || "home"; render(); };
  });
  document.getElementById("subtitle")!.textContent =
    state.tab === "home" ? "حسابداری آفلاین مزرعه" :
    state.tab === "list" ? "همه تراکنش‌ها" :
    state.tab === "assistant" ? "دستیار / پشتیبان" :
    state.tab === "report" ? "گزارش و خروجی" : "ثبت تراکنش";

  if (state.tab === "home") view.innerHTML = renderHome();
  else if (state.tab === "list") view.innerHTML = renderList();
  else if (state.tab === "assistant") view.innerHTML = renderAssistant();
  else if (state.tab === "report") view.innerHTML = renderReport();
  else view.innerHTML = renderAdd();
  bind(view);
  if (state.tab === "assistant") {
    const chat = document.getElementById("chat");
    if (chat) chat.scrollTop = chat.scrollHeight;
  }
}

function renderHome(): string {
  const m = state.db.txns.filter(inMonth);
  const { income, expense } = totals(m);
  const recent = state.db.txns.slice(0, 4);
  return `
  <div class="grid">
    <div class="kpi income"><div class="l">درآمد ${monthLabel(state.month)}</div><div class="v">${money(income)}</div></div>
    <div class="kpi expense"><div class="l">هزینه ${monthLabel(state.month)}</div><div class="v">${money(expense)}</div></div>
    <div class="kpi profit wide"><div class="l">سود / زیان این ماه</div><div class="v">${money(income - expense)}</div></div>
  </div>
  <div class="chips">
    <button data-act="quick-expense">＋ هزینه</button>
    <button data-act="quick-income">＋ درآمد</button>
    <button data-act="quick-report">📊 گزارش</button>
  </div>
  <div class="section-title"><span>آخرین تراکنش‌ها</span><button class="btn ghost sm" data-act="go-list">همه</button></div>
  <div class="card">${recent.length ? recent.map(rowHtml).join("") : '<div class="empty">هنوز چیزی ثبت نشده.<br>با دکمه «ثبت جدید» شروع کن.</div>'}</div>
  <p class="note">🔒 همه‌ی داده‌ها فقط روی همین گوشی ذخیره می‌شوند. هیچ اتصال اینترنتی لازم نیست.</p>`;
}
function rowHtml(t: Txn): string {
  return `<div class="row">
    <div class="ico">${txnIcon(t)}</div>
    <div class="t"><b>${esc(t.category)}${t.note ? " · " + esc(t.note.slice(0, 30)) : ""}</b><span>${esc(t.date)}${t.source === "assistant" ? " · دستیار" : ""}</span></div>
    <div class="amt ${t.kind === "income" ? "in" : "out"}">${t.kind === "income" ? "+" : "−"}${money(t.amount)}</div>
    <button class="btn danger sm" data-act="del" data-id="${t.id}">حذف</button>
  </div>`;
}
function renderList(): string {
  const list = state.db.txns.filter(inMonth);
  return `
  <div class="card">
    <label for="month">ماه</label>
    <input id="month" type="month" value="${state.month}">
  </div>
  <div class="section-title"><span>${list.length} تراکنش در ${monthLabel(state.month)}</span></div>
  <div class="card">${list.length ? list.map(rowHtml).join("") : '<div class="empty">این ماه تراکنشی ندارد.</div>'}</div>`;
}
function renderAdd(): string {
  return `
  <div class="card">
    <label>نوع</label>
    <div class="seg" id="kindseg">
      <button data-kind="expense" class="on">هزینه</button>
      <button data-kind="income">درآمد</button>
    </div>
    <label for="amount">مبلغ (تومان)</label>
    <input id="amount" type="text" inputmode="numeric" placeholder="مثلاً ۲۵ میلیون یا 25000000">
    <div class="two">
      <div><label for="cat">دسته</label><select id="cat">${CATS.map((c) => `<option>${c.name}</option>`).join("")}<option>سایر</option></select></div>
      <div><label for="date">تاریخ</label><input id="date" type="date" value="${localISO(new Date())}"></div>
    </div>
    <label for="note">یادداشت</label>
    <textarea id="note" placeholder="مثلاً کود اوره زمین شمالی، نسیه"></textarea>
    <button class="btn block" data-act="save-manual" style="margin-top:12px">ثبت</button>
    <button class="btn ghost block" data-act="go-home" style="margin-top:8px">انصراف</button>
  </div>`;
}
function renderAssistant(): string {
  return `
  <div class="seg" id="modeseg" style="margin:6px 0 10px">
    <button data-mode="assistant" class="${state.assistantMode === "assistant" ? "on" : ""}">دستیار (ثبت با تأیید)</button>
    <button data-mode="support" class="${state.assistantMode === "support" ? "on" : ""}">پشتیبان (فقط راهنما)</button>
  </div>
  <div class="chips">
    <button data-fill="۲۵ میلیون کود اوره خریدم، نسیه">خرید کود</button>
    <button data-fill="۱۲ میلیون گندم فروختم">فروش گندم</button>
    <button data-fill="کود خریدم">مبلغ نگفتم</button>
    <button data-fill="گزارش این ماه">گزارش</button>
  </div>
  <div class="card" style="padding:10px">
    <div class="chat" id="chat">${state.messages.map((m) => `<div class="msg ${m.role}">${esc(m.text)}</div>`).join("")}</div>
    ${state.draft ? draftHtml(state.draft) : ""}
    <div style="display:flex;gap:8px;margin-top:8px">
      <input id="chatinput" placeholder="مثلاً ۲۵ میلیون کود خریدم…" style="flex:1">
      <button class="btn" data-act="send">ارسال</button>
    </div>
    <p class="note" style="margin:8px 2px 0">دستیار فقط پیش‌نویس می‌سازد؛ تا «تأیید» نزنی چیزی ثبت نمی‌شود. هر ثبت قابل واگرد است.</p>
  </div>`;
}
function draftHtml(d: Txn): string {
  return `<div class="draft">
    <b>پیش‌نویس ${d.kind === "income" ? "درآمد" : "هزینه"}</b><br>
    مبلغ: ${money(d.amount)}<br>
    دسته: ${esc(d.category)} · تاریخ: ${esc(d.date)}<br>
    ${d.note ? "یادداشت: " + esc(d.note) : ""}
    <div class="actions">
      <button class="btn" data-act="confirm">تأیید و ثبت</button>
      <button class="btn ghost" data-act="cancel">لغو</button>
    </div>
  </div>`;
}
function renderReport(): string {
  const m = state.db.txns.filter(inMonth);
  const { income, expense } = totals(m);
  const byCat = new Map<string, { income: number; expense: number }>();
  for (const t of m) {
    const c = byCat.get(t.category) || { income: 0, expense: 0 };
    c[t.kind] += t.amount;
    byCat.set(t.category, c);
  }
  const rows = [...byCat.entries()].sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense));
  return `
  <div class="card">
    <label for="month">ماه گزارش</label>
    <input id="month" type="month" value="${state.month}">
    <div class="grid" style="margin-top:12px">
      <div class="kpi income"><div class="l">درآمد</div><div class="v">${money(income)}</div></div>
      <div class="kpi expense"><div class="l">هزینه</div><div class="v">${money(expense)}</div></div>
      <div class="kpi profit wide"><div class="l">سود / زیان</div><div class="v">${money(income - expense)}</div></div>
    </div>
  </div>
  <div class="card">
    <div class="section-title"><span>تفکیک دسته‌ها</span></div>
    ${rows.length ? `<table><thead><tr><th>دسته</th><th>درآمد</th><th>هزینه</th></tr></thead><tbody>${rows.map(([n, v]) => `<tr><td>${esc(n)}</td><td>${v.income ? money(v.income) : "—"}</td><td>${v.expense ? money(v.expense) : "—"}</td></tr>`).join("")}</tbody></table>` : '<div class="empty">داده‌ای برای این ماه نیست.</div>'}
  </div>
  <div class="card">
    <button class="btn ghost block" data-act="export">⬇️ خروجی JSON (پشتیبان)</button>
    <button class="btn danger block" data-act="reset" style="margin-top:8px">پاک کردن همه داده‌ها</button>
    <p class="note" style="margin-top:10px">نسخه آفلاین MVP — داده‌ها در حافظه محلی گوشی ذخیره می‌شوند. برای SQLite رمزنگاری‌شده و مدل محلی، نسخه بعدی.</p>
  </div>`;
}

function bind(view: HTMLElement): void {
  view.querySelectorAll<HTMLElement>("[data-act]").forEach((el) => {
    el.onclick = () => {
      const act = el.dataset.act;
      if (act === "go-list") { state.tab = "list"; render(); }
      else if (act === "go-home") { state.tab = "home"; render(); }
      else if (act === "quick-expense") { state.tab = "add"; render(); }
      else if (act === "quick-income") { state.tab = "add"; render(); setTimeout(() => { const b = document.querySelector<HTMLButtonElement>('#kindseg [data-kind="income"]'); b?.click(); }, 0); }
      else if (act === "quick-report") { state.tab = "report"; render(); }
      else if (act === "del") { deleteTxn(el.dataset.id || ""); }
      else if (act === "confirm") { confirmDraft(); }
      else if (act === "cancel") { state.draft = null; state.messages.push({ role: "bot", text: "لغو شد." }); render(); }
      else if (act === "send") { sendChat(); }
      else if (act === "save-manual") { saveManual(); }
      else if (act === "export") { exportJson(); }
      else if (act === "reset") {
        if (confirm("همه‌ی داده‌های این گوشی پاک شود؟ این کار قابل بازگشت نیست.")) {
          state.db = { version: 1, txns: [], audit: [] }; save(); state.messages = [{ role: "bot", text: "داده‌ها پاک شد. از نو شروع کن." }]; render();
        }
      }
    };
  });
  const month = document.getElementById("month") as HTMLInputElement | null;
  if (month) month.onchange = () => { state.month = month.value || state.month; render(); };
  const kindseg = document.getElementById("kindseg");
  if (kindseg) {
    kindseg.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
      b.onclick = () => { kindseg.querySelectorAll("button").forEach((x) => x.classList.remove("on")); b.classList.add("on"); };
    });
  }
  const modeseg = document.getElementById("modeseg");
  if (modeseg) {
    modeseg.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
      b.onclick = () => { state.assistantMode = (b.dataset.mode as "assistant" | "support") || "assistant"; render(); };
    });
  }
  view.querySelectorAll<HTMLElement>("[data-fill]").forEach((b) => {
    b.onclick = () => { const input = document.getElementById("chatinput") as HTMLInputElement | null; if (input) { input.value = b.dataset.fill || ""; input.focus(); } };
  });
  const chatinput = document.getElementById("chatinput") as HTMLInputElement | null;
  if (chatinput) chatinput.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); sendChat(); } };
}
function sendChat(): void {
  const input = document.getElementById("chatinput") as HTMLInputElement | null;
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  handle(text);
}
function saveManual(): void {
  const amountEl = document.getElementById("amount") as HTMLInputElement | null;
  const dateEl = document.getElementById("date") as HTMLInputElement | null;
  const catEl = document.getElementById("cat") as HTMLSelectElement | null;
  const noteEl = document.getElementById("note") as HTMLTextAreaElement | null;
  const kindBtn = document.querySelector<HTMLButtonElement>("#kindseg button.on");
  const parsed = amountEl ? parseAmount(amountEl.value) : null;
  if (!parsed) { alert("مبلغ را درست وارد کن؛ مثلاً «۲۵ میلیون» یا «25000000»."); return; }
  const kind: Kind = kindBtn?.dataset.kind === "income" ? "income" : "expense";
  addManual(kind, parsed.amount, catEl?.value || (kind === "income" ? "محصول" : "سایر"), dateEl?.value || localISO(new Date()), (noteEl?.value || "").slice(0, 160));
}
function exportJson(): void {
  const data = JSON.stringify(state.db, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "kishavar-backup-" + localISO(new Date()) + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  toast("فایل پشتیبان ساخته شد");
}

// وضعیت شبکه فقط برای نمایش؛ اپ به آن وابسته نیست.
function net(): void {
  const el = document.getElementById("netpill");
  if (!el) return;
  el.textContent = navigator.onLine ? "آفلاین · داده محلی" : "آفلاین";
}
window.addEventListener("online", net);
window.addEventListener("offline", net);

net();
render();
