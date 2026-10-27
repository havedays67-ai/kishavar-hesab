/**
 * کشاورزحساب آفلاین — رابط کاربری
 * هیچ محاسبه‌ی مالی در این فایل نیست؛ همه از store/engine می‌آید.
 */
import * as S from "./store";
import * as E from "./engine";
import {
  LEASE_KIND_LABEL,
  LEASE_STATUS_LABEL,
  businessInsights,
  LEASE_ROLE_LABEL,
  leaseContractText,
  leaseParties,
  leaseRole,
  leaseIsOverdue,
  leaseNextDue,
  leasePaid,
  leaseRemaining,
  leaseSignedBoth,
  leaseSignatures,
  leaseStats,
  leaseTotalRent,
  smartSuggestions,
} from "./lease";
import {
  ASSISTANT_INTENT_COUNT,
  ASSISTANT_SAMPLES,
  GUIDE_SECTIONS,
  SECTION_GUIDES,
  runAssistant,
  sectionGuide,
  type AssistantResult,
} from "./assistant";

type Tab = "home" | "ledger" | "reports" | "assistant" | "more";
type ChatMessage = { role: "me" | "bot"; text: string; result?: AssistantResult };

interface State {
  db: E.DB;
  tab: Tab;
  reportTab: string;
  query: string;
  chat: ChatMessage[];
  sheet: string | null;
}

let state: State;

const $ = <T extends Element = HTMLElement>(sel: string): T => document.querySelector(sel) as T;

const esc = (value: unknown): string =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));

/** همهٔ مبالغ: «100,000,000 ریال» — معادل حروفی به */
const money = (n: number): string => E.moneyRial(n);
const moneyU = (n: number): string => `${E.moneyRial(n)} · ${E.moneyWords(n)}`;

function toast(message: string, error = false): void {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.className = `toast show${error ? " err" : ""}`;
  window.setTimeout(() => {
    el.className = "toast";
  }, 2600);
}

function commit(next: E.DB, message?: string): void {
  state.db = S.saveDB(next);
  render();
  if (message) toast(message);
}

function cashAccounts(db: E.DB): E.Account[] {
  return db.accounts.filter((a) => a.isCash);
}

function options(list: { id: number; name: string }[], selected?: number | string): string {
  return list
    .map((item) => `<option value="${item.id}"${String(selected ?? "") === String(item.id) ? " selected" : ""}>${esc(item.name)}</option>`)
    .join("");
}

function acctOptions(db: E.DB, predicate: (a: E.Account) => boolean, selected?: number | string): string {
  return options(db.accounts.filter(predicate).map((a) => ({ id: a.id, name: `${a.code} · ${a.name}` })), selected);
}

function contactOptions(db: E.DB, selected?: number | string): string {
  return `<option value="">— بدون طرف‌حساب —</option>${options(db.contacts, selected)}`;
}

/* --------------------------------- چیدمان -------------------------------- */

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "home", label: "خانه", icon: "🏠" },
  { key: "ledger", label: "دفتر", icon: "📒" },
  { key: "reports", label: "گزارش", icon: "📊" },
  { key: "assistant", label: "دستیار", icon: "✨" },
  { key: "more", label: "بیشتر", icon: "⋯" },
];

function statCard(label: string, value: string, hint: string, tone = ""): string {
  return `<div class="stat"><div class="k">${esc(label)}<span class="num ${tone}">${esc(hint)}</span></div><div class="v num ${tone}">${value}</div></div>`;
}

function emptyBox(text: string): string {
  return `<div class="empty">${esc(text)}</div>`;
}

function viewHome(): string {
  const db = state.db;
  const period = E.currentPeriod();
  const income = E.incomeOf(db, period);
  const expense = E.expenseOf(db, period);
  const profit = income - expense;
  const cash = E.cashOf(db);
  const months = E.monthsForChart(db);
  const max = Math.max(1, ...months.map((m) => Math.max(m.income, m.expense)));
  const recent = [...db.entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id)).slice(0, 6);
  const dueCheques = db.cheques.filter((c) => c.status === "pending" && E.daysBetween(E.todayISO(), c.due) <= 10);
  const lateInstallments = db.installments.filter((i) => !i.paid && i.due < E.todayISO());
  const low = db.products.filter((p) => p.stock <= p.min);
  const overBudget = db.budgets.length ? E.budgetUsageEq(db).filter((b) => b.pct > 100) : [];
  const dc = E.debtorsCreditors(db);
  const insights = businessInsights(db);
  const suggestions = smartSuggestions(db);
  const lStats = leaseStats(db);
  const alerts: string[] = [];
  if (dueCheques.length) alerts.push(`${E.faDigits(dueCheques.length)} چک تا ۱۰ روز آینده سررسید می‌شود`);
  if (lateInstallments.length) alerts.push(`${E.faDigits(lateInstallments.length)} قسط معوق دارید`);
  if (low.length) alerts.push(`${low.map((p) => p.name).join("، ")} به حد سفارش رسیده است`);
  if (overBudget.length) alerts.push(`${overBudget[0].name} از بودجه عبور کرده است`);

  return `
  <section class="hero rise">
    <div class="h-top"><span>${esc(E.formatJalali(new Date(), "long"))}</span><span>${esc(db.settings.business)}</span></div>
    <div class="big num">${moneyU(cash)}</div>
    <div class="hint">موجودی نقد و بانک از دفتر کل</div>
    <div class="hero-grid">
      <div><span>درآمد ${esc(period.label)}</span><b class="num">${money(income)}</b></div>
      <div><span>هزینه ${esc(period.label)}</span><b class="num">${money(expense)}</b></div>
      <div><span>سود دوره</span><b class="num">${money(profit)}</b></div>
      <div><span>تراز دفتر</span><b>${E.trialBalance(db).balanced ? "متوازن ✓" : "بررسی لازم"}</b></div>
    </div>
  </section>
  <div class="stats">
    ${statCard("سود انباشته", money(E.balanceSheet(db).netProfit), "دفتر کل")}
    ${statCard("مطالبات", money(db.invoices.filter((i) => i.type === "sale").reduce((s, i) => s + E.invoiceRemaining(i), 0)), "فاکتور باز")}
    ${statCard("بدهی", money(E.balanceSheet(db).liabilities), "وام و بستانکار")}
    ${statCard("ترازنامه", E.balanceSheet(db).balanced ? "تراز" : "عدم تراز", "کنترل")}
  </div>
  <div class="card">
    <h2>بدهکاران و بستانکاران <button class="btn sm" data-act="open" data-open="contacts-list">همه</button></h2>
    <div class="stats">
      ${statCard("جمع طلب از بدهکاران", money(dc.totalDebit), `${E.faDigits(dc.debtors.length)} طرف‌حساب`, "pos")}
      ${statCard("جمع بدهی به بستانکاران", money(dc.totalCredit), `${E.faDigits(dc.creditors.length)} طرف‌حساب`, "neg")}
    </div>
    ${dc.overdueTotal > 0 ? `<div class="row"><span class="ico">⚠️</span><div class="grow"><div class="t">مطالبات معوق</div><div class="s">سررسید گذشته و وصول‌نشده</div></div><span class="num neg" style="font-weight:700">${money(dc.overdueTotal)}</span></div>` : ""}
    ${[...dc.debtors.slice(0, 3), ...dc.creditors.slice(0, 2)].map((c) => `<div class="row"><span class="ico">${c.net >= 0 ? "🟢" : "🔴"}</span><div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${c.net >= 0 ? "بدهکار به شما" : "شما بدهکار هستید"}${c.overdue > 0 ? ` · معوق ${money(c.overdue)}` : ""}</div></div><button class="btn sm" data-act="statement" data-id="${c.id}">صورتحساب</button></div>`).join("") || emptyBox("برای شروع، طرف‌حساب و فاکتور ثبت کنید.")}
    <div class="btn-row"><button class="btn sm" data-act="open" data-open="contact">＋ طرف‌حساب</button><button class="btn sm" data-act="statement-list">فهرست صورتحساب‌ها</button><button class="btn sm" data-act="guide" data-section="contact">؟ راهنما</button></div>
  </div>
  <div class="card">
    <h2>هوش تحلیلی <small>پیشنهاد و هشدار قطعی</small></h2>
    ${insights.map((i) => `<div class="row" style="align-items:flex-start"><span class="ico">${i.severity === "critical" ? "🚨" : i.severity === "warning" ? "⚠️" : i.severity === "good" ? "✅" : "💡"}</span><div class="grow"><div class="t">${esc(i.title)}</div><div class="s" style="white-space:normal">${esc(i.detail)}</div></div>${i.action?.sheet ? `<button class="btn sm" data-act="open" data-open="${i.action.sheet}"${i.action.fields?.id ? ` data-id="${i.action.fields.id}"` : ""}>${esc(i.action.label)}</button>` : i.action?.tab ? `<button class="btn sm" data-act="tab" data-tab="${i.action.tab}">${esc(i.action.label)}</button>` : ""}</div>`).join("")}
    ${suggestions.length ? `<div class="note">پیشنهاد بعدی: ${suggestions.map((x) => `<button class="btn sm" data-act="open" data-open="${x.sheet ?? "quick"}">${esc(x.label)}</button>`).join(" ")}</div>` : ""}
    <div class="btn-row"><button class="btn sm" data-act="open" data-open="debtor-add">＋ بدهکار</button><button class="btn sm" data-act="open" data-open="creditor-add">＋ بستانکار</button><button class="btn sm" data-act="open" data-open="lease-new">＋ قرارداد اجاره</button><button class="btn sm" data-act="guides">؟ راهنماها</button></div>
  </div>
  <div class="card">
    <h2>هشدارهای مهم <span class="chip ${alerts.length ? "warn" : "pos"}">${alerts.length ? `${E.faDigits(alerts.length)} مورد` : "آرام"}</span></h2>
    ${alerts.length ? alerts.map((a) => `<div class="row"><span class="ico">⚠️</span><div class="grow"><div class="t">${esc(a)}</div></div></div>`).join("") : emptyBox("هیچ سررسید یا بودجه‌ی بحرانی ندارید.")}
    <div class="btn-row">
      <button class="btn sm" data-act="tab" data-tab="ledger">دفتر روزنامه</button>
      <button class="btn sm" data-act="tab" data-tab="reports">گزارش‌ها</button>
      <button class="btn sm" data-act="open" data-open="cheques-list">چک‌ها</button>
      <button class="btn sm" data-act="open" data-open="loans-list">اقساط</button>
    </div>
  </div>
  <div class="card">
    <h2>روند ۶ ماه <small>درآمد و هزینه</small></h2>
    <div class="bar-wrap">
      ${months
        .map(
          (m) => `<div class="bar-col"><div class="bar" style="height:${Math.max(3, Math.round((m.income / max) * 82))}px"></div><div class="bar exp" style="height:${Math.max(3, Math.round((m.expense / max) * 82))}px"></div><div class="bar-lbl">${esc(m.label)}</div></div>`,
        )
        .join("")}
    </div>
    <div class="btn-row"><span class="chip brand">درآمد</span><span class="chip warn">هزینه</span></div>
  </div>
  <div class="card">
    <h2>اجاره‌های کشاورزی <button class="btn sm" data-act="open" data-open="lease-list">مدیریت</button></h2>
    <div class="stats">${statCard("قرارداد فعال", E.faDigits(lStats.active), "ملک/زمین", "pos")}${statCard("مانده اجاره", money(lStats.remaining), lStats.overdue ? `معوق ${money(lStats.overdue)}` : "بدون معوقه", lStats.overdue ? "neg" : "")}</div>
    ${lStats.unsigned ? `<div class="row"><span class="ico">✍️</span><div class="grow"><div class="t">${E.faDigits(lStats.unsigned)} قرارداد امضای کامل ندارد</div><div class="s">امضای موجر و مستاجر را ثبت کنید</div></div><button class="btn sm" data-act="open" data-open="lease-list">ثبت امضا</button></div>` : ""}
    <div class="btn-row"><button class="btn sm pri" data-act="open" data-open="lease-new">＋ قرارداد جدید</button><button class="btn sm" data-act="open" data-open="signatures-list">دفتر امضاها</button><button class="btn sm" data-act="guide" data-section="lease">؟ راهنمای اجاره</button></div>
  </div>
  <div class="card">
    <h2>آخرین اسناد <small>${E.faDigits(db.entries.length)} سند</small></h2>
    ${recent.length ? recent.map(entryRow).join("") : emptyBox("هنوز سندی ثبت نشده است. با دکمه + شروع کنید.")}
    <div class="btn-row"><button class="btn sm pri" data-act="open" data-open="quick">＋ ثبت جدید</button><button class="btn sm" data-act="open" data-open="expense">هزینه</button><button class="btn sm" data-act="open" data-open="sale">فاکتور فروش</button></div>
  </div>`;
}

function entryRow(entry: E.Entry): string {
  const total = entry.lines.reduce((s, l) => s + l.debit, 0);
  const income = entry.lines.some((l) => {
    const acc = state.db.accounts.find((a) => a.id === l.accountId);
    return acc?.type === "income";
  });
  const accounts = entry.lines.map((l) => state.db.accounts.find((a) => a.id === l.accountId)?.name ?? "—").slice(0, 2).join(" / ");
  return `<div class="row">
    <span class="ico ${income ? "in" : "out"}">${income ? "↓" : "↑"}</span>
    <div class="grow"><div class="t">${esc(entry.desc)}</div><div class="s">${esc(E.formatJalali(entry.date))} · ${esc(accounts)}</div></div>
    <div style="text-align:left"><div class="num ${income ? "pos" : ""}" style="font-size:11.5px;font-weight:700">${money(total)}</div></div>
  </div>`;
}

function viewLedger(): string {
  const db = state.db;
  const q = E.normalizeDigits(state.query).trim();
  const list = [...db.entries]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id))
    .filter((e) => !q || e.desc.includes(q) || e.lines.some((l) => (db.accounts.find((a) => a.id === l.accountId)?.name ?? "").includes(q)));
  const trial = E.trialBalance(db);
  return `
  <div class="card">
    <h2>دفتر روزنامه <span class="chip ${trial.balanced ? "pos" : "neg"}">${trial.balanced ? "متوازن" : "عدم تراز"}</span></h2>
    <input id="q" value="${esc(state.query)}" placeholder="جست‌وجو در شرح یا حساب…" />
    <div class="note">بدهکار ${moneyU(trial.debit)} · بستانکار ${moneyU(trial.credit)}</div>
    <div class="btn-row"><button class="btn sm" data-act="open" data-open="quick">＋ سند جدید</button><button class="btn sm" data-act="export" data-kind="csv">خروجی CSV</button></div>
  </div>
  <div class="card">
    ${list.length ? list.slice(0, 80).map((entry) => `
      <div class="row" style="align-items:flex-start">
        <span class="ico">🧾</span>
        <div class="grow">
          <div class="t">${esc(entry.desc)}</div>
          <div class="s">${esc(E.formatJalali(entry.date))} · ${esc(entry.source)}</div>
          <div class="s num">${entry.lines.map((l) => `${esc(db.accounts.find((a) => a.id === l.accountId)?.name ?? "—")} ${l.debit ? "بد " + money(l.debit) : "بس " + money(l.credit)}`).join(" · ")}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
          <span class="num" style="font-size:11px;font-weight:700">${money(entry.lines.reduce((s, l) => s + l.debit, 0))}</span>
          <button class="btn sm danger" data-act="undo" data-id="${entry.id}">واگرد</button>
        </div>
      </div>`).join("") : emptyBox("سندی با این فیلتر پیدا نشد.")}
  </div>`;
}

/* --------------------------------- گزارش‌ها -------------------------------- */

const REPORT_TABS = [
  { key: "pl", label: "سود و زیان" },
  { key: "cash", label: "جریان نقد" },
  { key: "aging", label: "مطالبات" },
  { key: "balance", label: "ترازنامه" },
  { key: "tax", label: "مالیات" },
  { key: "debtors", label: "بدهکار/بستانکار" },
  { key: "leases", label: "اجاره" },
  { key: "contacts", label: "طرف‌حساب" },
  { key: "trial", label: "تراز آزمایشی" },
  { key: "budget", label: "بودجه" },
  { key: "stock", label: "انبار" },
  { key: "assets", label: "دارایی" },
  { key: "farm", label: "زمین‌ها" },
];

function viewReports(): string {
  const db = state.db;
  const period = E.currentPeriod();
  const range = { start: period.start, end: period.end };
  let body = "";

  if (state.reportTab === "pl") {
    const income = E.incomeOf(db, range);
    const expense = E.expenseOf(db, range);
    const groups = E.groupExpense(db, range);
    body = `<div class="card"><h2>صورت سود و زیان <small>${esc(period.label)}</small></h2>
      <div class="row"><div class="grow"><div class="t">درآمد دوره</div></div><span class="num pos">${moneyU(income)}</span></div>
      ${groups.map((g) => `<div class="row"><div class="grow"><div class="t">${esc(g.name)}</div></div><span class="num neg">${money(g.amount)}</span></div>`).join("")}
      <div class="row"><div class="grow"><div class="t" style="font-weight:800">سود (زیان) دوره</div></div><span class="num ${income - expense >= 0 ? "pos" : "neg"}" style="font-weight:800">${moneyU(income - expense)}</span></div>
      <div class="meter"><i style="width:${income > 0 ? Math.min(100, Math.round((expense / income) * 100)) : 0}%" class="${expense > income ? "over" : ""}"></i></div>
      <div class="note">نسبت هزینه به درآمد: ${E.faDigits(income > 0 ? Math.round((expense / income) * 100) : 0)}٪</div>
    </div>`;
  } else if (state.reportTab === "cash") {
    const flow = E.cashFlow(db, range);
    body = `<div class="card"><h2>جریان نقدی <small>${esc(period.label)}</small></h2>
      <div class="stats">${statCard("ورود نقد", money(flow.inflow), "این ماه", "pos")}${statCard("خروج نقد", money(flow.outflow), "این ماه", "neg")}</div>
      <div class="row"><div class="grow"><div class="t">موجودی نقد فعلی</div></div><span class="num" style="font-weight:800">${moneyU(E.cashOf(db))}</span></div>
      ${cashAccounts(db).map((a) => `<div class="row"><div class="grow"><div class="t">${esc(a.name)}</div><div class="s">${esc(a.code)}</div></div><span class="num">${money(E.cashOfAccount(db, a.id))}</span></div>`).join("")}
    </div>`;
  } else if (state.reportTab === "aging") {
    const buckets = E.aging(db);
    const open = db.invoices.filter((i) => i.type === "sale" && E.invoiceRemaining(i) > 0);
    body = `<div class="card"><h2>سنّی مطالبات</h2>
      <div class="stats">${buckets.map((b) => statCard(b.label, money(b.amount), `${E.faDigits(b.count)} فاکتور`, b.label === "جاری" ? "pos" : "neg")).join("")}</div>
      <div class="tbl-scroll"><table><thead><tr><th>فاکتور</th><th>سررسید</th><th>تأخیر</th><th>مانده</th></tr></thead><tbody>
      ${open.map((inv) => {
        const days = E.daysBetween(inv.due, E.todayISO());
        return `<tr><td>${esc(inv.no)}</td><td class="num">${esc(E.formatJalali(inv.due))}</td><td class="num ${days > 0 ? "neg" : "pos"}">${E.faDigits(Math.max(0, days))}</td><td class="num">${money(E.invoiceRemaining(inv))}</td></tr>`;
      }).join("") || `<tr><td colspan="4" class="muted">مطالبه‌ای باز نیست.</td></tr>`}
      </tbody></table></div></div>`;
  } else if (state.reportTab === "balance") {
    const sheet = E.balanceSheet(db);
    body = `<div class="card"><h2>ترازنامه ساده <span class="chip ${sheet.balanced ? "pos" : "neg"}">${sheet.balanced ? "متوازن" : "عدم تراز"}</span></h2>
      <div class="row"><div class="grow"><div class="t">جمع دارایی (ناخالص)</div></div><span class="num">${money(sheet.grossAssets)}</span></div>
      <div class="row"><div class="grow"><div class="t">استهلاک انباشته</div></div><span class="num neg">${money(sheet.accumulated)}</span></div>
      <div class="row"><div class="grow"><div class="t">دارایی خالص</div></div><span class="num pos">${money(sheet.assets)}</span></div>
      <div class="row"><div class="grow"><div class="t">بدهی‌ها</div></div><span class="num neg">${money(sheet.liabilities)}</span></div>
      <div class="row"><div class="grow"><div class="t">سود انباشته</div></div><span class="num">${money(sheet.netProfit)}</span></div>
      <div class="row"><div class="grow"><div class="t" style="font-weight:800">حقوق صاحبان سرمایه</div></div><span class="num" style="font-weight:800">${money(sheet.equity)}</span></div>
    </div>`;
  } else if (state.reportTab === "tax") {
    const inPeriod = db.invoices.filter((i) => i.date >= range.start && i.date <= range.end);
    const saleTax = inPeriod.filter((i) => i.type === "sale").reduce((s, i) => s + i.tax, 0);
    const purchaseTax = inPeriod.filter((i) => i.type === "purchase").reduce((s, i) => s + i.tax, 0);
    body = `<div class="card"><h2>گزارش مالیات <small>${esc(period.label)}</small></h2>
      <div class="row"><div class="grow"><div class="t">مالیات فروش</div></div><span class="num">${moneyU(saleTax)}</span></div>
      <div class="row"><div class="grow"><div class="t">مالیات خرید (اعتبار)</div></div><span class="num neg">${moneyU(purchaseTax)}</span></div>
      <div class="row"><div class="grow"><div class="t" style="font-weight:800">خالص قابل پرداخت</div></div><span class="num" style="font-weight:800">${moneyU(Math.max(0, saleTax - purchaseTax))}</span></div>
      <div class="note">مالیات هر فاکتور از ردیف‌های همان فاکتور محاسبه می‌شود، نه از درصد ثابت روی جمع کل. این گزارش جایگزین مشاوره مالیاتی نیست.</div>
    </div>`;
  } else if (state.reportTab === "contacts") {
    body = `<div class="card"><h2>مانده طرف‌حساب‌ها</h2>
      ${db.contacts.length ? db.contacts.map((c) => {
        const b = E.contactBalance(db, c.id);
        return `<div class="row"><span class="ico">👤</span><div class="grow"><div class="t">${esc(c.name)}</div><div class="s">مطالبات ${money(b.receivable)} · بستانکاری ${money(b.payable)}</div></div><span class="num ${b.net >= 0 ? "pos" : "neg"}" style="font-weight:700">${money(b.net)}</span></div>`;
      }).join("") : emptyBox("طرف‌حسابی ثبت نشده است.")}
      <div class="btn-row"><button class="btn sm" data-act="open" data-open="contact">＋ طرف‌حساب جدید</button></div></div>`;
  } else if (state.reportTab === "budget") {
    const year = E.toJalali(new Date()).jy;
    const usage = E.budgetUsageEq(db);
    body = `<div class="card"><h2>بودجه در برابر واقعی <small>سال ${E.faDigits(year)}</small></h2>
      ${usage.length ? usage.map((b) => `<div style="margin-bottom:9px"><div class="row" style="border:0;padding:0"><div class="grow"><div class="t">${esc(b.name)}</div><div class="s">${E.faDigits(b.pct)}٪ مصرف شده</div></div><span class="num ${b.pct > 100 ? "neg" : ""}">${money(b.actual)} / ${money(b.budget)}</span></div><div class="meter"><i class="${b.pct > 100 ? "over" : ""}" style="width:${Math.min(100, b.pct)}%"></i></div></div>`).join("") : emptyBox("بودجه‌ای ثبت نشده است.")}
      <div class="btn-row"><button class="btn sm" data-act="open" data-open="budget">＋ تعیین بودجه</button></div></div>`;
  } else if (state.reportTab === "stock") {
    const value = db.products.reduce((s, p) => s + p.stock * p.cost, 0);
    body = `<div class="card"><h2>موجودی انبار <small>${moneyU(value)}</small></h2>
      ${db.products.length ? `<div class="tbl-scroll"><table><thead><tr><th>کالا</th><th>موجودی</th><th>حد سفارش</th><th>بهای واحد</th><th>ارزش</th></tr></thead><tbody>
        ${db.products.map((p) => `<tr><td>${esc(p.name)}</td><td class="num ${p.stock <= p.min ? "neg" : ""}">${E.faDigits(p.stock)} ${esc(p.unit)}</td><td class="num">${E.faDigits(p.min)}</td><td class="num">${money(p.cost)}</td><td class="num">${money(p.stock * p.cost)}</td></tr>`).join("")}
      </tbody></table></div>` : emptyBox("کالایی ثبت نشده است.")}
      <div class="btn-row"><button class="btn sm" data-act="open" data-open="product">＋ کالا</button><button class="btn sm" data-act="open" data-open="stock">ورود/خروج</button></div></div>`;
  } else if (state.reportTab === "assets") {
    const totalCost = db.assets.reduce((s, a) => s + a.cost, 0);
    const totalBook = db.assets.reduce((s, a) => s + E.depreciation(a.cost, a.salvage, a.lifeMonths, a.purchase).book, 0);
    body = `<div class="card"><h2>دارایی ثابت <small>${moneyU(totalBook)} ارزش دفتری</small></h2>
      ${db.assets.length ? db.assets.map((a) => {
        const dep = E.depreciation(a.cost, a.salvage, a.lifeMonths, a.purchase);
        return `<div class="row"><div class="grow"><div class="t">${esc(a.name)}</div><div class="s">خرید ${esc(E.formatJalali(a.purchase))} · استهلاک ماهانه ${money(dep.monthly)}</div><div class="meter"><i style="width:${Math.min(100, Math.round((dep.accumulated / Math.max(1, a.cost - a.salvage)) * 100))}%"></i></div></div><div style="text-align:left"><span class="num" style="font-weight:700">${money(dep.book)}</span><div class="s">از ${money(a.cost)}</div></div></div>`;
      }).join("") : emptyBox("دارایی ثبت نشده است.")}
      <div class="note">جمع بهای تمام‌شده: ${moneyU(totalCost)} — استهلاک خط مستقیم و قطعی.</div>
      <div class="btn-row"><button class="btn sm" data-act="open" data-open="asset">＋ دارایی</button></div></div>`;
  } else if (state.reportTab === "debtors") {
    const dc = E.debtorsCreditors(db);
    const row = (c: E.ContactSummary, tone: "pos" | "neg") => `<div class="row"><span class="ico">${tone === "pos" ? "🟢" : "🔴"}</span><div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${tone === "pos" ? "بدهکار به شما" : "شما بدهکار هستید"}${c.openInvoices ? ` · ${E.faDigits(c.openInvoices)} فاکتور باز` : ""}${c.overdue > 0 ? ` · معوق ${money(c.overdue)}` : ""}</div></div><div style="text-align:left"><span class="num ${tone}" style="font-weight:700">${money(Math.abs(c.net))}</span><div class="s num">بد ${E.faDigits(c.debit)} / بس ${E.faDigits(c.credit)}</div><button class="btn sm" data-act="statement" data-id="${c.id}">صورتحساب</button></div></div>`;
    body = `<div class="card"><h2>بدهکاران <small>طلب شما</small><button class="btn sm" data-act="guide" data-section="contact">؟ راهنما</button></h2>
      <div class="stats">${statCard("جمع طلب", money(dc.totalDebit), `${E.faDigits(dc.debtors.length)} نفر`, "pos")}${statCard("معوق", money(dc.overdueTotal), "سررسید گذشته", "neg")}</div>
      ${dc.debtors.length ? dc.debtors.map((c) => row(c, "pos")).join("") : emptyBox("بدهکاری ندارید.")}
    </div>
    <div class="card"><h2>بستانکاران <small>بدهی شما</small></h2>
      <div class="stats">${statCard("جمع بدهی", money(dc.totalCredit), `${E.faDigits(dc.creditors.length)} نفر`, "neg")}${statCard("مانده خالص", money(dc.totalDebit - dc.totalCredit), "طلب − بدهی")}</div>
      ${dc.creditors.length ? dc.creditors.map((c) => row(c, "neg")).join("") : emptyBox("بستانکاری ندارید.")}
      <div class="btn-row"><button class="btn sm" data-act="open" data-open="contact">＋ طرف‌حساب</button><button class="btn sm" data-act="open" data-open="payment-in">دریافت</button><button class="btn sm" data-act="open" data-open="payment-out">پرداخت</button></div>
    </div>`;
  } else if (state.reportTab === "trial") {
    const trial = E.trialBalance(db);
    body = `<div class="card"><h2>تراز آزمایشی <span class="chip ${trial.balanced ? "pos" : "neg"}">${trial.balanced ? "متوازن" : "عدم تراز"}</span></h2>
      <div class="tbl-scroll"><table><thead><tr><th>کد</th><th>حساب</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th><th /></tr></thead><tbody>
      ${trial.rows.map((r) => `<tr><td class="num">${esc(r.code)}</td><td>${esc(r.name)}</td><td class="num">${money(r.debit)}</td><td class="num">${money(r.credit)}</td><td class="num">${money(r.balance)}</td><td><button class="btn sm" data-act="account-ledger" data-id="${r.accountId}">دفتر</button></td></tr>`).join("")}
      </tbody></table></div>
      <div class="row"><div class="grow"><div class="t" style="font-weight:800">جمع کل</div></div><span class="num" style="font-weight:800">${money(trial.debit)} / ${money(trial.credit)}</span></div>
      <div class="note">اگر جمع بدهکار و بستانکار برابر است، همه‌ی اسناد دوطرفه و سالم هستند. با دکمه «دفتر» گردش هر حساب را ببینید.</div>
      <div class="btn-row"><button class="btn sm" data-act="guide" data-section="reports">؟ راهنمای گزارش‌ها</button></div>
    </div>`;
  } else if (state.reportTab === "leases") {
    const st = leaseStats(db);
    body = `<div class="card"><h2>گزارش اجاره‌های کشاورزی <button class="btn sm" data-act="guide" data-section="lease">؟ راهنما</button></h2>
      <div class="stats">${statCard("قرارداد فعال", E.faDigits(st.active), "ملک", "pos")}${statCard("جمع اجاره", money(st.totalRent), "کل مدت")}${statCard("پرداخت‌شده", money(st.paid), "تا امروز", "pos")}${statCard("مانده", money(st.remaining), st.overdue ? `معوق ${money(st.overdue)}` : "بدون معوقه", st.overdue ? "neg" : "")}</div>
      ${db.leases.length ? db.leases.map((l) => {
        const next = leaseNextDue(l);
        const sig = leaseSignedBoth(l, db.signatures);
        return `<div class="row" style="align-items:flex-start"><span class="ico">🏞️</span><div class="grow">
          <div class="t">${esc(l.title)}</div>
          <div class="s">${esc(LEASE_KIND_LABEL[l.kind])} · ${esc(E.formatJalali(l.start))} تا ${esc(E.formatJalali(l.end))} · اجاره ${money(leaseTotalRent(l))}${l.sharePercent ? ` + ${E.faDigits(l.sharePercent)}٪ محصول` : ""}</div>
          <div class="s">موجر: ${esc(leaseParties(db, l).owner)} · مستاجر: ${esc(leaseParties(db, l).tenant)}</div>
          <div class="s">پرداخت‌شده ${money(leasePaid(l, db.rents))} · مانده ${money(leaseRemaining(l, db.rents))}${next ? ` · قسط بعدی ${esc(E.formatJalali(next.due))}` : " · تسویه"}</div>
          <div class="chip-row" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">
            <span class="chip ${l.status === "active" ? "pos" : "warn"}">${esc(LEASE_STATUS_LABEL[l.status])}</span>
            <span class="chip ${sig.complete ? "pos" : "warn"}">امضا ${sig.complete ? "کامل" : "ناقص"}</span>
            ${leaseIsOverdue(l) ? '<span class="chip neg">معوق</span>' : ""}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px"><button class="btn sm pri" data-act="open" data-open="lease-pay" data-id="${l.id}">پرداخت</button><button class="btn sm" data-act="open" data-open="lease-sign" data-id="${l.id}">امضا</button><button class="btn sm" data-act="lease-contract" data-id="${l.id}">متن قرارداد</button></div></div>`;
      }).join("") : emptyBox("قرارداد اجاره‌ای ثبت نشده است.")}
      <div class="btn-row"><button class="btn sm pri" data-act="open" data-open="lease-new">＋ قرارداد جدید</button><button class="btn sm" data-act="open" data-open="signatures-list">دفتر امضاها</button></div>
    </div>`;
  } else {
    body = `<div class="card"><h2>سود زمین‌ها <small>مرکز هزینه</small></h2>
      ${db.projects.length ? db.projects.map((p) => {
        const profit = E.projectProfit(db, p.id);
        return `<div class="row"><div class="grow"><div class="t">${esc(p.name)}</div><div class="s">${esc(p.crop)} · ${E.faDigits(p.area)} هکتار · سهم شریک ${E.faDigits(p.sharePercent)}٪</div><div class="s">درآمد ${money(profit.income)} · هزینه ${money(profit.expense)}</div></div><span class="num ${profit.profit >= 0 ? "pos" : "neg"}" style="font-weight:700">${money(profit.profit)}</span></div>`;
      }).join("") : emptyBox("زمینی ثبت نشده است.")}
      <div class="btn-row"><button class="btn sm" data-act="open" data-open="project">＋ زمین</button><button class="btn sm" data-act="open" data-open="farmop">عملیات</button></div></div>`;
  }

  return `<div class="tabs">${REPORT_TABS.map((t) => `<button data-act="report" data-key="${t.key}" class="${state.reportTab === t.key ? "on" : ""}">${esc(t.label)}</button>`).join("")}</div>${body}`;
}

/* --------------------------------- دستیار -------------------------------- */

function viewAssistant(): string {
  return `
  <div class="card">
    <h2>دستیار آفلاین <span class="chip brand">${E.faDigits(ASSISTANT_INTENT_COUNT)} قصد</span></h2>
    <div class="note">هر بخش را می‌توانید توضیح بخواهید (مثلاً «بخش چک را کامل توضیح بده») یا صورت‌حساب بگیرید («صورتحساب شرکت لبنیات دشت»).<br>همه محلی اجرا می‌شود. مدل زبانی هیچ عددی حساب نمی‌کند؛ پاسخ‌ها از موتور قطعی می‌آید و هیچ سندی بدون تأیید شما ثبت نمی‌شود.</div>
    <div class="samples">${ASSISTANT_SAMPLES.map((s) => `<button data-act="sample" data-text="${esc(s)}">${esc(s)}</button>`).join("")}</div>
  </div>
  <div class="card" id="chat">
    ${state.chat.map((m) => {
      if (m.role === "me") return `<div class="msg me">${esc(m.text)}</div>`;
      const r = m.result;
      const tone = r?.action === "draft" ? "brand" : r?.action === "answer" ? "info" : r?.action === "ask" ? "warn" : "neg";
      const label = r?.action === "draft" ? "پیش‌نویس" : r?.action === "answer" ? "پاسخ قطعی" : r?.action === "ask" ? "نیاز به اطلاعات" : "رد درخواست";
      return `<div class="msg bot">
        ${r ? `<div class="meta"><span class="chip ${tone}">${label}</span><span class="chip">${esc(r.title)}</span></div>` : ""}
        <div>${esc(m.text)}</div>
        ${r?.details?.length ? `<div style="margin-top:6px;border-top:1px dashed var(--line);padding-top:5px">${r.details.map((d) => `<div style="display:flex;justify-content:space-between;gap:8px;font-size:11px"><span class="muted">${esc(d.label)}</span><span class="num" style="font-weight:700">${esc(d.value)}</span></div>`).join("")}</div>` : ""}
        ${r?.draft ? `<div class="btn-row"><button class="btn sm pri" data-act="draft" data-tool="${esc(r.draft.tool)}" data-fields='${esc(JSON.stringify(r.draft.fields))}'>بررسی و تأیید پیش‌نویس</button></div>` : ""}
      </div>`;
    }).join("")}
  </div>
  <div class="card">
    <form data-form="assistant">
      <label for="atext">جمله‌ی خود را بنویسید</label>
      <input id="atext" name="text" placeholder="مثلاً: ۴۵۰ هزار گازوئیل خریدم" autocomplete="off" />
      <button class="btn pri" type="submit" style="width:100%">ارسال به دستیار</button>
    </form>
  </div>`;
}

/* ---------------------------------- بیشتر -------------------------------- */

function viewMore(): string {
  const db = state.db;
  const sections = [
    {
      title: "ثبت عملیات",
      items: [
        { open: "expense", t: "هزینه", s: "با دسته و مرکز هزینه" },
        { open: "income", t: "درآمد", s: "فروش و خدمات" },
        { open: "transfer", t: "انتقال", s: "صندوق ↔ بانک" },
        { open: "sale", t: "فاکتور فروش", s: "مالیات و تخفیف" },
        { open: "purchase", t: "فاکتور خرید", s: "نهاده و اثر انبار" },
        { open: "payment-in", t: "دریافت", s: "تخصیص به فاکتور" },
        { open: "payment-out", t: "پرداخت", s: "به تأمین‌کننده" },
        { open: "cheque-received", t: "چک دریافتی", s: "سررسید و وصول" },
        { open: "cheque-paid", t: "چک پرداختی", s: "سررسید و پرداخت" },
      ],
    },
    {
      title: "اطلاعات پایه",
      items: [
        { open: "contact", t: "طرف‌حساب", s: "مشتری/تأمین‌کننده" },
        { open: "product", t: "کالا و نهاده", s: "واحد و بهای تمام‌شده" },
        { open: "stock", t: "گردش انبار", s: "ورود و خروج" },
        { open: "asset", t: "دارایی ثابت", s: "استهلاک خط مستقیم" },
        { open: "budget", t: "بودجه", s: "سقف سالانه" },
        { open: "project", t: "زمین و محصول", s: "افزونه کشاورزی" },
        { open: "farmop", t: "عملیات مزرعه", s: "کاشت، آبیاری، برداشت" },
        { open: "loan", t: "وام و اقساط", s: "اصل و سود" },
      ],
    },
    {
      title: "بایگانی",
      items: [
        { open: "sales-list", t: "فهرست فاکتورها", s: `${E.faDigits(db.invoices.length)} فاکتور` },
        { open: "cheques-list", t: "فهرست چک‌ها", s: `${E.faDigits(db.cheques.length)} چک` },
        { open: "loans-list", t: "اقساط و وام", s: `${E.faDigits(db.loans.length)} وام` },
        { open: "contacts-list", t: "طرف‌حساب‌ها", s: `${E.faDigits(db.contacts.length)} مورد` },
        { open: "products-list", t: "موجودی", s: `${E.faDigits(db.products.length)} قلم` },
        { open: "audit-list", t: "گزارش عملیات", s: `${E.faDigits(db.audit.length)} رکورد` },
      ],
    },
  ];
  return `
  <div class="card">
    <h2>${esc(db.settings.business)} <button class="btn sm" data-act="open" data-open="settings">تنظیمات</button></h2>
    <div class="note">دستیار: ${db.settings.assistantMode === "backup" ? "پشتیبان (فقط خواندن)" : "دستیار (پیش‌نویس + تأیید)"} · مالیات پیش‌فرض ${E.faDigits(db.settings.taxRate)}٪ · ${E.faDigits(db.entries.length)} سند · ذخیره‌شده روی همین دستگاه</div>
  </div>
  ${sections.map((s) => `<div class="card"><h2>${esc(s.title)}</h2><div class="list-btns">${s.items.map((i) => `<button data-act="open" data-open="${i.open}"><span class="t">${esc(i.t)}</span><span class="s">${esc(i.s)}</span></button>`).join("")}</div></div>`).join("")}
  <div class="card">
    <h2>داده و پشتیبان</h2>
    <div class="btn-row">
      <button class="btn sm pri" data-act="export" data-kind="json">پشتیبان JSON</button>
      <button class="btn sm" data-act="export" data-kind="csv">تراکنش‌ها CSV</button>
      <button class="btn sm" data-act="open" data-open="restore">بازیابی</button>
      <button class="btn sm" data-act="demo">داده نمونه</button>
      <button class="btn sm danger" data-act="reset">پاک‌سازی</button>
    </div>
    <div class="note">پشتیبان شامل همه اسناد، فاکتورها، چک، اقساط و تنظیمات است و هیچ کلید یا توکنی در آن نیست.</div>
  </div>
  <div class="card">
    <h2>اجاره و امضا <small>${E.faDigits(db.leases.length)} قرارداد · ${E.faDigits(db.signatures.length)} امضا</small></h2>
    <div class="list-btns">
      <button data-act="open" data-open="lease-new"><span class="t">＋ قرارداد اجاره</span><span class="s">نقدی، سهم محصول یا ترکیبی</span></button>
      <button data-act="open" data-open="lease-list"><span class="t">مدیریت قراردادها</span><span class="s">پرداخت، امضا، پایان</span></button>
      <button data-act="open" data-open="lease-pay"><span class="t">پرداخت اجاره</span><span class="s">سند خودکار هزینه اجاره</span></button>
      <button data-act="open" data-open="signatures-list"><span class="t">دفتر امضاها</span><span class="s">همه امضاهای ثبت‌شده</span></button>
      <button data-act="guide" data-section="lease"><span class="t">راهنمای اجاره</span><span class="s">ارکان قرارداد و نکات حقوقی</span></button>
      <button data-act="guide" data-section="signature"><span class="t">راهنمای امضا</span><span class="s">چطور امضا ثبت و نگه‌داری می‌شود</span></button>
    </div>
    <div class="btn-row"><button class="btn sm" data-act="open" data-open="debtor-add">＋ بدهکار</button><button class="btn sm" data-act="open" data-open="creditor-add">＋ بستانکار</button></div>
  </div>
  <div class="card">
    <h2>راهنمای کامل بخش‌ها <small>${E.faDigits(GUIDE_SECTIONS.length)} بخش</small></h2>
    <div class="note">هر بخش را انتخاب کنید تا توضیح دقیق، گام‌به‌گام و ساده ببینید. همین راهنماها در دستیار هم با جمله‌هایی مثل «بخش چک را توضیح بده» قابل پرسیدن است.</div>
    <div class="list-btns">${GUIDE_SECTIONS.map((key) => `<button data-act="guide" data-section="${key}"><span class="t">${esc(SECTION_GUIDES[key].icon)} ${esc(SECTION_GUIDES[key].title)}</span><span class="s">توضیح کامل و گام‌به‌گام</span></button>`).join("")}</div>
    <div class="btn-row"><button class="btn sm" data-act="tab" data-tab="assistant">پرسیدن از دستیار</button></div>
  </div>
  <div class="card">
    <h2>درباره</h2>
    <div class="note">
      کشاورزحساب ۱.۰.۰ (افلاین) · موتور دوطرفه با کنترل تراز · تقویم شمسی و · ${E.faDigits(ASSISTANT_INTENT_COUNT)} قصد دستیار محلی · بدون هیچ درخواست شبکه.<br>
      درستی حسابداری &gt; آفلاین &gt; سادگی &gt; زیبایی. اعداد این برنامه فقط از موتور قطعی می‌آیند.
    </div>
  </div>`;
}

/* ---------------------------------- فرم‌ها -------------------------------- */

const SHEET_TITLES: Record<string, string> = {
  quick: "ثبت سریع",
  expense: "ثبت هزینه",
  income: "ثبت درآمد",
  transfer: "انتقال بین حساب‌ها",
  sale: "فاکتور فروش",
  purchase: "فاکتور خرید",
  "payment-in": "دریافت وجه",
  "payment-out": "پرداخت وجه",
  "cheque-received": "چک دریافتی",
  "cheque-paid": "چک پرداختی",
  product: "کالا / نهاده",
  stock: "گردش انبار",
  asset: "دارایی ثابت",
  budget: "تعیین بودجه",
  contact: "طرف‌حساب جدید",
  project: "زمین / محصول",
  farmop: "عملیات مزرعه",
  loan: "وام جدید",
  settings: "تنظیمات",
  restore: "بازیابی پشتیبان",
  "sales-list": "فاکتورها",
  "cheques-list": "چک‌ها",
  "loans-list": "وام و اقساط",
  "contacts-list": "طرف‌حساب‌ها",
  "products-list": "موجودی",
  "audit-list": "گزارش عملیات",
  "contact-statement": "صورتحساب طرف‌حساب",
  opening: "مانده اول دوره",
  guide: "راهنمای بخش",
  "account-ledger": "دفتر معین حساب",
  debtors: "بدهکاران و بستانکاران",
  "debtor-add": "افزودن بدهکار",
  "creditor-add": "افزودن بستانکار",
  "lease-new": "قرارداد اجاره ملک کشاورزی",
  "lease-list": "مدیریت قراردادهای اجاره",
  "lease-pay": "پرداخت اجاره",
  "lease-sign": "ثبت امضا",
  "signatures-list": "دفتر امضاها",
  "lease-contract": "متن قرارداد",
  guides: "راهنمای کامل بخش‌ها",
};

function val(fields: Record<string, string> | undefined, key: string, fallback = ""): string {
  return fields?.[key] ?? fallback;
}

function formExpense(db: E.DB, kind: "expense" | "income", f?: Record<string, string>): string {
  const cash = cashAccounts(db);
  const cats = db.accounts.filter((a) => a.type === (kind === "expense" ? "expense" : "income"));
  const selectedCat = f?.categoryCode ? db.accounts.find((a) => a.code === f.categoryCode)?.id : cats[0]?.id;
  return `<form data-form="txn" data-kind="${kind}">
    <label>مبلغ (ریال)</label>
    <input data-money="1" name="amount" inputmode="numeric" required value="${esc(val(f, "amount"))}" placeholder="۴۵۰٬۰۰۰" />
    <label>شرح</label>
    <input name="desc" required value="${esc(val(f, "desc"))}" placeholder="${kind === "expense" ? "گازوئیل تراکتور" : "فروش محصول"}" />
    <div class="grid2">
      <div><label>تاریخ</label><input name="date" type="date" value="${esc(val(f, "date", E.todayISO()))}" /></div>
      <div><label>حساب ${kind === "expense" ? "پرداخت" : "دریافت"}</label><select name="accountId">${options(cash, cash.find((a) => `a`.includes("")) ? selectedCat : f?.accountCode ? db.accounts.find((a) => a.code === f.accountCode)?.id : cash[0]?.id)}</select></div>
    </div>
    <label>دسته</label>
    <select name="categoryId">${options(cats, selectedCat)}</select>
    <label>طرف‌حساب (اختیاری)</label>
    <select name="contactId">${contactOptions(db, f?.contactId)}</select>
    <label>مرکز هزینه / زمین (اختیاری)</label>
    <select name="projectId"><option value="">—</option>${options(db.projects)}</select>
    <button class="btn pri" type="submit" style="width:100%;margin-top:4px">ثبت سند متوازن</button>
    <div class="note">سند خودکار: ${kind === "expense" ? "بدهکار دسته / بستانکار حساب پرداخت" : "بدهکار حساب دریافت / بستانکار دسته"} — جمع بدهکار و بستانکار برابر.</div>
  </form>`;
}

function formTransfer(db: E.DB, f?: Record<string, string>): string {
  const cash = cashAccounts(db);
  const from = f?.fromCode ? db.accounts.find((a) => a.code === f.fromCode)?.id : cash[0]?.id;
  const to = f?.toCode ? db.accounts.find((a) => a.code === f.toCode)?.id : cash[1]?.id;
  return `<form data-form="transfer">
    <label>مبلغ</label><input data-money="1" name="amount" inputmode="numeric" required value="${esc(val(f, "amount"))}" />
    <label>شرح</label><input name="desc" value="${esc(val(f, "desc", "انتقال بین حساب‌ها"))}" />
    <div class="grid2">
      <div><label>از حساب</label><select name="fromId">${options(cash, from)}</select></div>
      <div><label>به حساب</label><select name="toId">${options(cash, to)}</select></div>
    </div>
    <label>تاریخ</label><input name="date" type="date" value="${esc(val(f, "date", E.todayISO()))}" />
    <button class="btn pri" type="submit" style="width:100%">ثبت انتقال</button>
    <div class="note">انتقال بین حساب‌ها سود را تغییر نمی‌دهد؛ فقط ترکیب نقدینگی را جابه‌جا می‌کند.</div>
  </form>`;
}

function formInvoice(db: E.DB, type: "sale" | "purchase", f?: Record<string, string>): string {
  const contacts = db.contacts.filter((c) => (type === "sale" ? c.kind !== "supplier" : c.kind !== "customer"));
  const purchaseTargets = db.accounts.filter((a) => a.type === "expense" || a.code === "1200" || a.code === "1300");
  return `<form data-form="invoice" data-type="${type}">
    <label>طرف‌حساب</label>
    <select name="contactId" required><option value="">انتخاب کنید…</option>${options(contacts, f?.contactId)}</select>
    <label>کالا / نهاده (اختیاری)</label>
    <select name="productId"><option value="">— بدون اتصال به انبار</option>${options(db.products)}</select>
    <label>شرح ردیف</label><input name="desc" required value="${esc(val(f, "desc"))}" placeholder="${type === "sale" ? "گندم — برداشت جاری" : "کود اوره"}" />
    <div class="grid2">
      <div><label>تعداد</label><input name="qty" inputmode="decimal" value="1" /></div>
      <div><label>مبلغ واحد</label><input data-money="1" name="price" inputmode="numeric" required value="${esc(val(f, "amount"))}" /></div>
    </div>
    <div class="grid2">
      <div><label>تخفیف</label><input data-money="1" name="discount" inputmode="numeric" value="0" /></div>
      <div><label>مالیات (٪)</label><input name="taxRate" inputmode="numeric" value="${E.faDigits(db.settings.taxRate)}" /></div>
    </div>
    <div class="grid2">
      <div><label>تاریخ صدور</label><input name="date" type="date" value="${esc(val(f, "date", E.todayISO()))}" /></div>
      <div><label>سررسید</label><input name="due" type="date" value="${esc(val(f, "due", E.addDays(E.todayISO(), 30)))}" /></div>
    </div>
    ${type === "purchase" ? `<label>حساب بدهکار خرید</label><select name="targetCode">${purchaseTargets.map((a) => `<option value="${a.code}">${esc(a.name)}</option>`).join("")}</select>` : ""}
    <label style="display:flex;align-items:center;gap:7px"><input type="checkbox" name="applyStock" style="width:auto;margin:0" checked /> به‌روزرسانی موجودی انبار</label>
    <button class="btn pri" type="submit" style="width:100%;margin-top:8px">ثبت فاکتور</button>
    <div class="note">جمع فاکتور = جمع ردیف‌ها − تخفیف + مالیات؛ محاسبه با موتور قطعی و اعداد صحیح تومان.</div>
  </form>`;
}

function formPayment(db: E.DB, direction: "in" | "out", f?: Record<string, string>): string {
  const cash = cashAccounts(db);
  const openInvoices = db.invoices.filter((i) => (direction === "in" ? i.type === "sale" : i.type === "purchase") && E.invoiceRemaining(i) > 0);
  return `<form data-form="payment" data-direction="${direction}">
    <label>مبلغ</label><input data-money="1" name="amount" inputmode="numeric" required value="${esc(val(f, "amount"))}" />
    <label>تاریخ</label><input name="date" type="date" value="${esc(val(f, "date", E.todayISO()))}" />
    <div class="grid2">
      <div><label>حساب</label><select name="accountId">${options(cash, f?.accountCode ? db.accounts.find((a) => a.code === f.accountCode)?.id : cash[0]?.id)}</select></div>
      <div><label>روش</label><select name="method"><option value="bank">بانکی</option><option value="cash">نقدی</option><option value="cheque">چک</option></select></div>
    </div>
    <label>طرف‌حساب</label><select name="contactId">${contactOptions(db, f?.contactId)}</select>
    <label>تخصیص به فاکتور (اختیاری)</label>
    <select name="invoiceId"><option value="">— بدون تخصیص</option>${openInvoices.map((i) => `<option value="${i.id}">${esc(i.no)} — مانده ${money(E.invoiceRemaining(i))}</option>`).join("")}</select>
    <button class="btn pri" type="submit" style="width:100%">ثبت ${direction === "in" ? "دریافت" : "پرداخت"}</button>
    <div class="note">${direction === "in" ? "بدهکار حساب نقدی/بانکی، بستانکار حساب‌های دریافتنی؛ مانده فاکتور به‌روز می‌شود." : "بدهکار حساب‌های پرداختنی، بستانکار حساب نقدی/بانکی."}</div>
  </form>`;
}

function formCheque(db: E.DB, direction: "received" | "paid", f?: Record<string, string>): string {
  return `<form data-form="cheque" data-direction="${direction}">
    <div class="grid2">
      <div><label>شماره چک</label><input name="serial" required value="${esc(val(f, "serial"))}" /></div>
      <div><label>مبلغ</label><input data-money="1" name="amount" inputmode="numeric" required value="${esc(val(f, "amount"))}" /></div>
    </div>
    <label>بانک</label><input name="bank" value="بانک کشاورزی" />
    <label>سررسید</label><input name="due" type="date" required value="${esc(val(f, "due", E.addDays(E.todayISO(), 7)))}" />
    <label>طرف‌حساب</label><select name="contactId">${contactOptions(db, f?.contactId)}</select>
    <button class="btn pri" type="submit" style="width:100%">ثبت چک ${direction === "received" ? "دریافتی" : "پرداختی"}</button>
    <div class="note">وصول یا برگشت چک را از فهرست چک‌ها ثبت کنید؛ وصول، سند بانکی می‌سازد.</div>
  </form>`;
}

function formProduct(db: E.DB): string {
  return `<form data-form="product">
    <label>نام</label><input name="name" required placeholder="گندم / کود اوره" />
    <div class="grid2">
      <div><label>واحد</label><input name="unit" value="کیلوگرم" /></div>
      <div><label>نوع</label><select name="kind"><option value="product">محصول</option><option value="input">نهاده</option></select></div>
    </div>
    <div class="grid2">
      <div><label>بهای تمام‌شده</label><input data-money="1" name="cost" inputmode="numeric" value="0" /></div>
      <div><label>قیمت فروش</label><input data-money="1" name="price" inputmode="numeric" value="0" /></div>
    </div>
    <div class="grid2">
      <div><label>موجودی اولیه</label><input name="stock" inputmode="decimal" value="0" /></div>
      <div><label>حد سفارش</label><input name="min" inputmode="decimal" value="0" /></div>
    </div>
    <button class="btn pri" type="submit" style="width:100%">ثبت کالا</button>
  </form>`;
}

function formStock(db: E.DB): string {
  return `<form data-form="stock">
    <label>کالا</label><select name="productId" required>${options(db.products)}</select>
    <div class="grid2">
      <div><label>نوع</label><select name="kind"><option value="in">ورود</option><option value="out">خروج</option></select></div>
      <div><label>تعداد</label><input name="qty" inputmode="decimal" required /></div>
    </div>
    <div class="grid2">
      <div><label>بهای واحد</label><input data-money="1" name="unitCost" inputmode="numeric" value="0" /></div>
      <div><label>تاریخ</label><input name="date" type="date" value="${E.todayISO()}" /></div>
    </div>
    <label>توضیح</label><input name="note" />
    <button class="btn pri" type="submit" style="width:100%">ثبت گردش</button>
  </form>`;
}

function formAsset(db: E.DB): string {
  const cash = cashAccounts(db);
  return `<form data-form="asset">
    <label>نام دارایی</label><input name="name" required placeholder="تراکتور / آبیاری" />
    <div class="grid2">
      <div><label>بهای خرید</label><input data-money="1" name="cost" inputmode="numeric" required /></div>
      <div><label>ارزش اسقاط</label><input data-money="1" name="salvage" inputmode="numeric" value="0" /></div>
    </div>
    <div class="grid2">
      <div><label>عمر (ماه)</label><input name="lifeMonths" inputmode="numeric" value="60" /></div>
      <div><label>تاریخ خرید</label><input name="purchase" type="date" value="${E.todayISO()}" /></div>
    </div>
    <label>پرداخت از حساب</label><select name="paidFromId">${options(cash)}</select>
    <button class="btn pri" type="submit" style="width:100%">ثبت دارایی</button>
  </form>`;
}

function formBudget(db: E.DB): string {
  return `<form data-form="budget">
    <label>سرفصل هزینه</label><select name="accountId">${acctOptions(db, (a) => a.type === "expense")}</select>
    <label>سقف بودجه سالانه</label><input data-money="1" name="amount" inputmode="numeric" required />
    <button class="btn pri" type="submit" style="width:100%">ثبت بودجه</button>
  </form>`;
}

function formContact(): string {
  return `<form data-form="contact">
    <label>نام</label><input name="name" required />
    <label>نوع</label><select name="kind"><option value="customer">مشتری</option><option value="supplier">تأمین‌کننده</option><option value="both">هر دو</option><option value="worker">کارگر</option><option value="partner">شریک</option><option value="landlord">مالک زمین (موجر)</option><option value="tenant">مستاجر / بهره‌بردار</option></select>
    <label>تلفن</label><input name="phone" inputmode="tel" />
    <button class="btn pri" type="submit" style="width:100%">ثبت طرف‌حساب</button>
  </form>`;
}

function formProject(): string {
  return `<form data-form="project">
    <label>نام زمین</label><input name="name" required />
    <div class="grid2">
      <div><label>محصول</label><input name="crop" /></div>
      <div><label>مساحت (هکتار)</label><input name="area" inputmode="decimal" value="0" /></div>
    </div>
    <label>سهم شریک (٪)</label><input name="sharePercent" inputmode="numeric" value="0" />
    <button class="btn pri" type="submit" style="width:100%">ثبت زمین</button>
  </form>`;
}

function formFarmOp(db: E.DB): string {
  const cash = cashAccounts(db);
  return `<form data-form="farmop">
    <label>زمین</label><select name="projectId" required>${options(db.projects)}</select>
    <label>نوع عملیات</label><select name="kind"><option value="cost">هزینه</option><option value="plant">کاشت</option><option value="irrigate">آبیاری</option><option value="harvest">برداشت</option><option value="sale">فروش محصول</option><option value="labor">دستمزد</option></select>
    <label>شرح</label><input name="desc" required />
    <div class="grid2">
      <div><label>مبلغ</label><input data-money="1" name="amount" inputmode="numeric" value="0" /></div>
      <div><label>تاریخ</label><input name="date" type="date" value="${E.todayISO()}" /></div>
    </div>
    <div class="grid2">
      <div><label>مقدار</label><input name="qty" inputmode="decimal" /></div>
      <div><label>واحد</label><input name="unit" placeholder="کیلوگرم" /></div>
    </div>
    <label>حساب مالی</label><select name="payFromId">${options(cash)}</select>
    <button class="btn pri" type="submit" style="width:100%">ثبت عملیات</button>
    <div class="note">مبلغ بزرگ‌تر از صفر، سند مالی روی مرکز هزینه‌ی همین زمین می‌سازد.</div>
  </form>`;
}

function formLoan(): string {
  return `<form data-form="loan">
    <label>عنوان وام</label><input name="title" required />
    <label>وام‌دهنده</label><input name="lender" />
    <div class="grid2">
      <div><label>اصل وام</label><input data-money="1" name="principal" inputmode="numeric" required /></div>
      <div><label>نرخ سالانه (٪)</label><input name="rate" inputmode="numeric" value="18" /></div>
    </div>
    <div class="grid2">
      <div><label>تعداد اقساط</label><input name="months" inputmode="numeric" value="12" /></div>
      <div><label>شروع</label><input name="start" type="date" value="${E.todayISO()}" /></div>
    </div>
    <button class="btn pri" type="submit" style="width:100%">ساخت وام و اقساط</button>
  </form>`;
}


function guideHtml(section: string): string {
  const guide = sectionGuide(section);
  if (!guide) return emptyBox("راهنمای این بخش پیدا نشد.");
  return `<div class="card" style="box-shadow:none;margin-bottom:8px">
    <div class="row" style="border:0"><span class="ico">${guide.icon}</span><div class="grow"><div class="t">${esc(guide.title)}</div><div class="s">توضیح ساده و کامل</div></div></div>
    <div class="note" style="font-size:11.5px;line-height:2">${esc(guide.what)}</div>
  </div>
  <div class="card" style="box-shadow:none;margin-bottom:8px">
    <h2>گام‌به‌گام</h2>
    <ol style="margin:0;padding-inline-start:16px;font-size:11.5px;line-height:2">${guide.steps.map((step) => `<li>${esc(step)}</li>`).join("")}</ol>
  </div>
  <div class="card" style="box-shadow:none;margin-bottom:8px">
    <h2>نکته‌های مهم</h2>
    <ul style="margin:0;padding-inline-start:16px;font-size:11.5px;line-height:2">${guide.tips.map((tip) => `<li>${esc(tip)}</li>`).join("")}</ul>
    <div class="note" style="margin-top:6px">نمونه جمله برای دستیار: «${esc(guide.example)}»</div>
    <div class="btn-row"><button class="btn sm" data-act="ask-guide" data-text="${esc(guide.example)}">پرسیدن همین نمونه از دستیار</button></div>
  </div>`;
}

function contactStatementSheet(id: number): string {
  const db = state.db;
  const contact = db.contacts.find((c) => c.id === id);
  if (!contact) return emptyBox("طرف‌حساب یافت نشد.");
  const st = E.contactStatement(db, contact.id);
  const side = st.net > 0 ? "بدهکار به شما" : st.net < 0 ? "شما به او بدهکار هستید" : "تسویه";
  return `<div class="card" style="box-shadow:none;margin-bottom:8px">
    <div class="row" style="border:0"><span class="ico">👤</span><div class="grow"><div class="t">${esc(contact.name)}</div><div class="s">${esc(E.contactKindLabel(contact.kind))} · ${side}${contact.phone ? ` · ${esc(contact.phone)}` : ""}</div></div><span class="num ${st.net >= 0 ? "pos" : "neg"}" style="font-weight:800">${money(Math.abs(st.net))}</span></div>
    <div class="stats">${statCard("جمع بدهکار", money(st.debit), "کل گردش", "pos")}${statCard("جمع بستانکار", money(st.credit), "کل گردش", "neg")}</div>
    <div class="note">فاکتور باز: ${E.faDigits(st.openInvoices)} · چک در جریان: ${money(st.chequesPending)} · معوق: ${money(st.overdue)} · کل فاکتورها: ${money(st.invoiced)} · پرداخت‌شده: ${money(st.settled)}</div>
    <div class="btn-row">
      <button class="btn sm pri" data-act="pay-for" data-id="${contact.id}" data-direction="in">＋ دریافت</button>
      <button class="btn sm" data-act="pay-for" data-id="${contact.id}" data-direction="out">＋ پرداخت</button>
      <button class="btn sm" data-act="open" data-open="opening" data-id="${contact.id}">مانده اول دوره</button>
      <button class="btn sm" data-act="copy-statement" data-id="${contact.id}">کپی صورتحساب</button>
      <button class="btn sm" data-act="guide" data-section="contact">؟ راهنما</button>
    </div>
  </div>
  <div class="card" style="box-shadow:none">
    <h2>گردش حساب <small>${E.faDigits(st.rows.length)} ردیف</small></h2>
    ${st.rows.length ? `<div class="tbl-scroll"><table><thead><tr><th>تاریخ</th><th>شرح</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th></tr></thead><tbody>
      ${st.rows.map((r) => `<tr><td class="num">${esc(E.formatJalali(r.date))}</td><td>${esc(r.title)}<div class="muted" style="font-size:9px">${r.kind === "invoice" ? "فاکتور" : r.kind === "payment" ? "دریافت/پرداخت" : r.kind === "opening" ? "مانده اول دوره" : r.kind === "cheque" ? "چک" : "سند"}</div></td><td class="num">${r.debit ? money(r.debit) : "—"}</td><td class="num">${r.credit ? money(r.credit) : "—"}</td><td class="num" style="font-weight:700">${money(r.balance)}</td></tr>`).join("")}
    </tbody></table></div>` : emptyBox("گردشی ثبت نشده است. فاکتور، دریافت/پرداخت یا مانده اول دوره ثبت کنید.")}
    <div class="note">مانده مثبت = طرف‌حساب به شما بدهکار است؛ مانده منفی = شما به او بدهکار هستید.</div>
  </div>`;
}

function formOpening(id: number): string {
  const db = state.db;
  const contact = db.contacts.find((c) => c.id === id);
  if (!contact) return emptyBox("طرف‌حساب یافت نشد.");
  return `<form data-form="opening" data-id="${id}">
    <div class="note">مانده‌ی قبل از شروع کار با ${esc(contact.name)} را یک‌بار ثبت کنید. سند آن به حساب سرمایه می‌خورد و در گردش حساب دیده می‌شود.</div>
    <label>مبلغ</label><input data-money="1" name="amount" inputmode="numeric" required placeholder="۵٬۰۰۰٬۰۰۰" />
    <label>ماهیت مانده</label>
    <select name="side"><option value="debit">بدهکار — طرف‌حساب به من بدهکار است</option><option value="credit">بستانکار — من به طرف‌حساب بدهکار هستم</option></select>
    <label>تاریخ</label><input name="date" type="date" value="${E.todayISO()}" />
    <button class="btn pri" type="submit" style="width:100%">ثبت مانده اول دوره</button>
  </form>`;
}

function accountLedgerSheet(id: number): string {
  const db = state.db;
  const ledger = E.accountLedger(db, id);
  return `<div class="card" style="box-shadow:none;margin-bottom:8px">
    <div class="row" style="border:0"><span class="ico">📘</span><div class="grow"><div class="t">${esc(ledger.code)} · ${esc(ledger.name)}</div><div class="s">گردش ${E.faDigits(ledger.rows.length)} ردیف</div></div><span class="num" style="font-weight:800">${money(ledger.balance)}</span></div>
    <div class="stats">${statCard("جمع بدهکار", money(ledger.debit), "حساب")}${statCard("جمع بستانکار", money(ledger.credit), "حساب")}</div>
  </div>
  <div class="card" style="box-shadow:none"><h2>ردیف‌های حساب</h2>
    ${ledger.rows.length ? `<div class="tbl-scroll"><table><thead><tr><th>تاریخ</th><th>شرح</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th></tr></thead><tbody>${ledger.rows.map((r) => `<tr><td class="num">${esc(E.formatJalali(r.date))}</td><td>${esc(r.title)}</td><td class="num">${r.debit ? money(r.debit) : "—"}</td><td class="num">${r.credit ? money(r.credit) : "—"}</td><td class="num" style="font-weight:700">${money(r.balance)}</td></tr>`).join("")}</tbody></table></div>` : emptyBox("گردشی برای این حساب ثبت نشده است.")}
  </div>`;
}


function debtorForm(kind: "customer" | "supplier"): string {
  return `<form data-form="debtor" data-kind="${kind}">
    <div class="note">${kind === "customer" ? "بدهکار = مشتری که به شما بدهکار است. با ثبت مانده اول دوره، سند دوطرفه با حساب سرمایه ساخته می‌شود." : "بستانکار = تأمین‌کننده یا شخصی که شما به او بدهکار هستید."}</div>
    <label>نام ${kind === "customer" ? "مشتری (بدهکار)" : "تأمین‌کننده (بستانکار)"}</label>
    <input name="name" required placeholder="${kind === "customer" ? "آقای احمدی" : "نهاده زاگرس"}" />
    <label>تلفن</label><input name="phone" inputmode="tel" />
    <div class="grid2">
      <div><label>${kind === "customer" ? "طلب اولیه" : "بدهی اولیه"}</label><input data-money="1" name="amount" inputmode="numeric" value="0" /></div>
      <div><label>تاریخ</label><input name="date" type="date" value="${E.todayISO()}" /></div>
    </div>
    <label>نوع ${kind === "customer" ? "مشتری" : "تأمین‌کننده"}</label>
    <select name="contactKind"><option value="${kind}">${kind === "customer" ? "مشتری" : "تأمین‌کننده"}</option><option value="both">هر دو</option>${kind === "customer" ? '<option value="worker">کارگر</option><option value="partner">شریک</option>' : ""}</select>
    <label>مانده اول دوره به‌عنوان</label>
    <select name="side"><option value="debit"${kind === "customer" ? " selected" : ""}>بدهکار (طرف‌حساب به من بدهکار است)</option><option value="credit"${kind === "supplier" ? " selected" : ""}>بستانکار (من به طرف‌حساب بدهکار هستم)</option></select>
    ${signaturePad("امضای طرف‌حساب (اختیاری)")}
    <button class="btn pri" type="submit" style="width:100%">ثبت و افزودن</button>
  </form>`;
}

let sigPadSeq = 0;

function signaturePad(label: string): string {
  sigPadSeq += 1;
  return `<label>${label}</label>
  <div class="sig-wrap" data-pad="${sigPadSeq}" style="border:1px dashed var(--line-2);border-radius:12px;background:#fff;margin-bottom:6px;touch-action:none">
    <canvas id="sig${sigPadSeq}" width="600" height="180" style="width:100%;height:120px;display:block;border-radius:12px"></canvas>
  </div>
  <div class="btn-row" style="margin-top:0">
    <button class="btn sm" type="button" data-act="sig-clear" data-pad="${sigPadSeq}">پاک کردن</button>
    <span class="note">با انگشت یا ماوس روی کادر بکشید</span>
  </div>
  <input type="hidden" name="signature" id="sigData${sigPadSeq}" />`;
}


function guidesSheet(): string {
  return `<div class="list-btns">${GUIDE_SECTIONS.filter((k) => k !== "guides").map((key) => `<button data-act="guide" data-section="${key}"><span class="t">${esc(SECTION_GUIDES[key].icon)} ${esc(SECTION_GUIDES[key].title)}</span><span class="s">توضیح کامل و گام‌به‌گام</span></button>`).join("")}</div>
  <div class="btn-row"><button class="btn sm" data-act="tab" data-tab="assistant">پرسیدن از دستیار</button></div>`;
}

function initSignaturePads(): void {
  document.querySelectorAll<HTMLCanvasElement>(".sig-wrap canvas").forEach((canvas) => {
    const ctx = canvas.getContext("2d");
    if (!ctx || canvas.dataset.ready === "1") return;
    canvas.dataset.ready = "1";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 3.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#14251c";
    let drawing = false;
    let last: { x: number; y: number } | null = null;
    const pos = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: ((ev.clientX - rect.left) / rect.width) * canvas.width, y: ((ev.clientY - rect.top) / rect.height) * canvas.height };
    };
    const start = (ev: PointerEvent) => {
      ev.preventDefault();
      drawing = true;
      last = pos(ev);
      const hidden = document.getElementById(`sigData${canvas.id.replace("sig", "")}`) as HTMLInputElement | null;
      if (hidden) hidden.value = "";
    };
    const move = (ev: PointerEvent) => {
      if (!drawing || !last) return;
      ev.preventDefault();
      const current = pos(ev);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(current.x, current.y);
      ctx.stroke();
      last = current;
      const hidden = document.getElementById(`sigData${canvas.id.replace("sig", "")}`) as HTMLInputElement | null;
      if (hidden) hidden.value = canvas.toDataURL("image/png");
    };
    const end = () => {
      drawing = false;
      last = null;
      const hidden = document.getElementById(`sigData${canvas.id.replace("sig", "")}`) as HTMLInputElement | null;
      if (hidden) hidden.value = canvas.toDataURL("image/png");
    };
    canvas.addEventListener("pointerdown", start);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointerleave", end);
    canvas.addEventListener("pointercancel", end);
  });
}

function leaseForm(): string {
  const today = E.todayISO();
  const startJalali = E.formatJalali(today);
  const endJalali = E.formatJalali(E.addMonths(today, 12));
  const contacts = [...state.db.contacts].sort((a, b) => Number(b.kind === "landlord") - Number(a.kind === "landlord"));
  const existingOptions = contacts.length
    ? `<label>یا انتخاب از طرف‌حساب‌های موجود</label>
       <select name="counterpartyId"><option value="">— طرف قرارداد جدید (از کادرهای زیر) —</option>${options(contacts.map((contact) => ({ id: contact.id, name: `${contact.name} — ${E.contactKindLabel(contact.kind)}` })))}</select>`
    : `<div class="note">هنوز طرف‌حسابی ثبت نشده است. نام مالک/مستاجر را در کادرهای زیر بنویسید؛ هنگام ثبت قرارداد، خودکار ساخته می‌شود.</div>`;
  return `<form data-form="lease" autocomplete="off">
    <div class="note">اول جهت قرارداد را انتخاب کنید: اگر زمین را برای کشت می‌گیرید شما <b>مستاجر</b> هستید و طرف قرارداد مالک زمین است؛ اگر زمین/باغ خود را به کشاورز می‌دهید شما <b>موجر</b> هستید. سند مالی بر همین اساس ساخته می‌شود.</div>
    <label>جهت قرارداد (نقش من)</label>
    <select name="role" data-lease-role required><option value="tenant" selected>${LEASE_ROLE_LABEL.tenant}</option><option value="owner">${LEASE_ROLE_LABEL.owner}</option></select>
    <label>عنوان ملک / زمین</label><input name="title" required placeholder="زمین آبی روستای سبز — ۴ هکتار" />
    <div class="grid2">
      <div><label>نوع قرارداد</label><select name="kind"><option value="cash">اجاره نقدی</option><option value="share">مزارعه (سهم محصول)</option><option value="mixed">اجاره + سهم محصول</option></select></div>
      <div><label>محصول</label><input name="crop" placeholder="گندم" /></div>
    </div>
    <label data-lease-counterparty-label>طرف قرارداد — مالک زمین (موجر) / مستاجر (بهره‌بردار)</label>
    ${existingOptions}
    <div class="grid2">
      <div><label>نام طرف قرارداد جدید</label><input name="counterpartyName" data-lease-party-name placeholder="نام مالک زمین" /></div>
      <div><label>تلفن طرف قرارداد</label><input name="counterpartyPhone" inputmode="tel" placeholder="۰۹۱۲…" /></div>
    </div>
    <div class="note">اگر طرف قرارداد را از فهرست بالا انتخاب کردید، این دو کادر را خالی بگذارید. یکی از دو راه کافی است؛ طرف دیگر همیشه «کسب‌وکار من» است و خودکار در سند نوشته می‌شود.</div>
    <div class="grid2">
      <div><label>تاریخ شروع (شمسی)</label><input name="start" inputmode="numeric" value="${startJalali}" placeholder="۱۴۰۵/۰۸/۰۵" required /><div class="note">نمونه: ۱۴۰۵/۰۸/۰۵</div></div>
      <div><label>تاریخ پایان (شمسی)</label><input name="end" inputmode="numeric" value="${endJalali}" placeholder="۱۴۰۶/۰۸/۰۵" required /><div class="note">نمونه: ۱۴۰۶/۰۸/۰۵</div></div>
    </div>
    <div class="grid2">
      <div><label>مساحت (هکتار)</label><input name="area" inputmode="decimal" value="0" /></div>
      <div><label>پلاک ثبتی</label><input name="plate" /></div>
    </div>
    <label>موقعیت</label><input name="location" placeholder="روستا / شهرستان" />
    <div class="grid2">
      <div><label>مبلغ کل اجاره (تومان)</label><input data-money="1" name="total" inputmode="numeric" value="0" placeholder="100,000,000" /></div>
      <div><label>ودیعه قابل استرداد (تومان)</label><input data-money="1" name="deposit" inputmode="numeric" value="0" /></div>
    </div>
    <div class="grid2">
      <div><label>دوره پرداخت</label><select name="cycle"><option value="once">یک‌جا</option><option value="monthly">ماهانه</option><option value="seasonal" selected>فصلی</option><option value="annual">سالانه</option></select></div>
      <div><label>سهم صاحب زمین از محصول (٪)</label><input name="sharePercent" inputmode="numeric" value="0" min="0" max="99" /></div>
    </div>
    <label>حقابه / سهم آب</label><input name="waterShare" placeholder="۶ ساعت در هفته از چاه مشترک" />
    <label>هزینه آب و برق و پمپ بر عهده</label><select name="waterPaidBy"><option>مستاجر</option><option>موجر</option><option>بالتساوی</option></select></label>
    <label>شرایط و تعهدات</label><textarea name="terms" rows="2" placeholder="کشت گندم، عدم تغییر کاربری، تحویل زمین شخم‌زده"></textarea>
    <label>شاهدها</label><input name="witnesses" placeholder="علی رضایی، محمد کریمی" />
    <label>پرداخت از حساب</label><select name="accountId">${options(cashAccounts(state.db))}</select>
    ${signaturePad("امضای طرف قرارداد (اختیاری، بعداً هم می‌توانید ثبت کنید)")}
    <button class="btn pri" type="submit" style="width:100%">ثبت قرارداد</button>
    <div class="note">ارکان لازم: مورد قرارداد، مدت، مال‌الاجاره یا سهم محصول، ودیعه، حقابه، تعهدات و امضای طرفین. تاریخ‌ها را با تقویم هجری شمسی وارد کنید. ثبت رسمی در دفتر اسناد رسمی برای مبالغ بالا توصیه می‌شود.</div>
  </form>`;
}

function leaseList(): string {
  const db = state.db;
  if (!db.leases.length) return `${emptyBox("قراردادی ثبت نشده است.")}<div class="btn-row"><button class="btn sm pri" data-act="open" data-open="lease-new">＋ قرارداد جدید</button><button class="btn sm" data-act="guide" data-section="lease">؟ راهنما</button></div>`;
  return db.leases
    .map((l) => {
      const next = leaseNextDue(l);
      const sig = leaseSignedBoth(l, db.signatures);
      const signatures = leaseSignatures(db.signatures, l.id);
      return `<div class="card" style="box-shadow:none;margin-bottom:8px">
        <div class="row" style="border:0"><span class="ico">🏞️</span><div class="grow"><div class="t">${esc(l.title)}</div><div class="s">${esc(LEASE_KIND_LABEL[l.kind])} · ${esc(E.formatJalali(l.start))} تا ${esc(E.formatJalali(l.end))}</div>
        <div class="s">اجاره ${money(leaseTotalRent(l))}${l.sharePercent ? ` + ${E.faDigits(l.sharePercent)}٪ محصول` : ""} · پرداخت‌شده ${money(leasePaid(l, db.rents))} · مانده ${money(leaseRemaining(l, db.rents))}</div></div>
        <span class="chip ${l.status === "active" ? "pos" : "warn"}">${esc(LEASE_STATUS_LABEL[l.status])}</span></div>
        <div class="note">موجر ${esc(leaseParties(db, l).owner)} · مستاجر ${esc(leaseParties(db, l).tenant)}${next ? ` · قسط بعدی ${esc(E.formatJalali(next.due))} (${money(next.amount)})` : " · تسویه"}</div>
        <div class="note">ودیعه ${money(l.deposit)} · حقابه ${esc(l.waterShare || "—")} · هزینه آب/برق: ${esc(l.waterPaidBy)}</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin:4px 0">${sig.complete ? '<span class="chip pos">امضا کامل</span>' : `<span class="chip warn">امضا ناقص (${signatures.length})</span>`}${leaseIsOverdue(l) ? '<span class="chip neg">معوق</span>' : ""}</div>
        <div class="btn-row">
          <button class="btn sm pri" data-act="open" data-open="lease-pay" data-id="${l.id}">پرداخت اجاره</button>
          <button class="btn sm" data-act="open" data-open="lease-sign" data-id="${l.id}">ثبت امضا</button>
          <button class="btn sm" data-act="lease-contract" data-id="${l.id}">متن قرارداد</button>
          ${l.status === "active" ? `<button class="btn sm danger" data-act="lease-end" data-id="${l.id}">پایان قرارداد</button>` : ""}
        </div>
      </div>`;
    })
    .join("");
}

function leasePayForm(leaseId?: number): string {
  const db = state.db;
  const active = db.leases.filter((l) => l.status === "active");
  if (!active.length) return `${emptyBox("قرارداد فعالی برای پرداخت نیست.")}<div class="btn-row"><button class="btn sm pri" data-act="open" data-open="lease-new">＋ قرارداد جدید</button></div>`;
  const selected = leaseId && active.some((l) => l.id === leaseId) ? leaseId : active[0].id;
  const lease = active.find((l) => l.id === selected) ?? active[0];
  const remaining = leaseRemaining(lease, db.rents);
  const next = leaseNextDue(lease);
  const isOwnerLease = leaseRole(lease) === "owner";
  return `<form data-form="leasepay">
    <label>قرارداد</label>
    <select name="leaseId">${active.map((l) => `<option value="${l.id}"${l.id === selected ? " selected" : ""}>${esc(l.title)} — مانده ${money(leaseRemaining(l, db.rents))}</option>`).join("")}</select>
    <label>قسط</label>
    <select name="scheduleNo"><option value="">تخصیص خودکار</option>${lease.schedule.map((r) => `<option value="${r.no}"${!r.paid && next?.no === r.no ? " selected" : ""}>قسط ${E.faDigits(r.no)} — ${esc(E.formatJalali(r.due))} — ${money(r.amount)}${r.paid ? " (پرداخت‌شده)" : ""}</option>`).join("")}</select>
    <div class="grid2">
      <div><label>مبلغ</label><input data-money="1" name="amount" inputmode="numeric" required value="${next ? next.amount : remaining}" /></div>
      <div><label>تاریخ</label><input name="date" type="date" value="${E.todayISO()}" /></div>
    </div>
    <label>پرداخت از حساب</label><select name="accountId">${options(cashAccounts(db))}</select>
    <label>یادداشت</label><input name="note" />
    <button class="btn pri" type="submit" style="width:100%">ثبت ${isOwnerLease ? "دریافت" : "پرداخت"} اجاره</button>
    <div class="note">سند خودکار: ${isOwnerLease ? "بدهکار حساب بانکی یا صندوق / بستانکار «درآمد اجاره زمین و سهم محصول»" : "بدهکار «اجاره و آب و برق» / بستانکار حساب بانکی یا صندوق"}. مانده اجاره و اقساط هم‌زمان به‌روز می‌شود.</div>
  </form>`;
}

function leaseSignForm(leaseId?: number): string {
  const db = state.db;
  if (!db.leases.length) return emptyBox("اول یک قرارداد اجاره ثبت کنید.");
  const selected = leaseId && db.leases.some((l) => l.id === leaseId) ? leaseId : db.leases[db.leases.length - 1].id;
  const existing = leaseSignatures(db.signatures, selected);
  return `<form data-form="leasesign">
    <label>قرارداد</label>
    <select name="leaseId">${db.leases.map((l) => `<option value="${l.id}"${l.id === selected ? " selected" : ""}>${esc(l.title)}</option>`).join("")}</select>
    <div class="grid2">
      <div><label>نقش امضاکننده</label><select name="role"><option>موجر</option><option>مستاجر</option><option>شاهد</option><option>نماینده</option></select></div>
      <div><label>نام امضاکننده</label><input name="signerName" required value="${esc(db.contacts.find((c) => c.id === db.leases.find((l) => l.id === selected)?.landlordId)?.name ?? "")}" /></div>
    </div>
    ${signaturePad("امضا")}
    <label style="display:flex;align-items:center;gap:7px"><input type="checkbox" name="confirm" style="width:auto;margin:0" required /> تأیید می‌کنم این امضا با آگاهی و در حضور طرفین ثبت می‌شود</label>
    <button class="btn pri" type="submit" style="width:100%">ثبت امضا</button>
    ${existing.length ? `<div class="note">امضاهای ثبت‌شده: ${existing.map((x) => `${esc(x.role)} (${esc(x.signerName)})`).join(" · ")}</div>` : ""}
    <div class="note">امضا در همان دستگاه ذخیره می‌شود و به قرارداد/طرف‌حساب مرتبط می‌گردد؛ این یک «ثبت توافقی درون‌برنامه‌ای» است و جایگزین تأییدیه دفتر اسناد رسمی نیست.</div>
  </form>`;
}

function signaturesList(): string {
  const db = state.db;
  if (!db.signatures.length) return `${emptyBox("امضایی ثبت نشده است.")}<div class="btn-row"><button class="btn sm pri" data-act="open" data-open="lease-sign">＋ ثبت امضا</button></div>`;
  return [...db.signatures].reverse().map((sig) => {
    const lease = sig.context === "lease" ? db.leases.find((l) => l.id === sig.refId) : null;
    const contact = sig.context === "contact" ? db.contacts.find((c) => c.id === sig.refId) : null;
    return `<div class="row" style="align-items:flex-start"><img src="${sig.image}" alt="امضا" style="width:74px;height:40px;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:8px" /><div class="grow"><div class="t">${esc(sig.role)} — ${esc(sig.signerName)}</div><div class="s">${lease ? `قرارداد: ${esc(lease.title)}` : contact ? `طرف‌حساب: ${esc(contact.name)}` : "سند"}</div><div class="s">${esc(E.formatJalali(sig.at.slice(0, 10)))} · کد اثر ${esc(sig.hash)}</div></div></div>`;
  }).join("") + `<div class="btn-row"><button class="btn sm pri" data-act="open" data-open="lease-sign">＋ ثبت امضا</button><button class="btn sm" data-act="guide" data-section="signature">؟ راهنمای امضا</button></div>`;
}

function leaseContractSheet(id: number): string {
  const text = leaseContractText(state.db, id);
  if (!text) return emptyBox("قرارداد یافت نشد.");
  return `<div class="card" style="box-shadow:none"><pre style="white-space:pre-wrap;font:inherit;font-size:11.5px;line-height:2;margin:0">${esc(text)}</pre></div>
  <div class="btn-row"><button class="btn sm pri" data-act="copy-text" data-id="${id}">کپی متن قرارداد</button><button class="btn sm" data-act="open" data-open="lease-sign" data-id="${id}">ثبت امضا</button><button class="btn sm" data-act="open" data-open="lease-pay" data-id="${id}">پرداخت اجاره</button></div>`;
}

function formSettings(db: E.DB): string {
  return `<form data-form="settings">
    <label>نام کسب‌وکار</label><input name="business" value="${esc(db.settings.business)}" />
    <label>مالک</label><input name="owner" value="${esc(db.settings.owner)}" />
    <div class="grid2">
      <div><label>نرخ مالیات (٪)</label><input name="taxRate" inputmode="numeric" value="${E.faDigits(db.settings.taxRate)}" /></div>
      <div><label>حالت دستیار</label><select name="assistantMode"><option value="assistant"${db.settings.assistantMode === "assistant" ? " selected" : ""}>دستیار</option><option value="backup"${db.settings.assistantMode === "backup" ? " selected" : ""}>پشتیبان (فقط خواندن)</option></select></div>
    </div>
    <label>تم</label><select name="theme"><option value="light"${db.settings.theme === "light" ? " selected" : ""}>روشن</option><option value="dark"${db.settings.theme === "dark" ? " selected" : ""}>تیره</option></select>
    <button class="btn pri" type="submit" style="width:100%">ذخیره</button>
  </form>`;
}

function listInvoices(db: E.DB): string {
  if (!db.invoices.length) return emptyBox("فاکتوری ثبت نشده است.");
  return `<div class="tbl-scroll"><table><thead><tr><th>شماره</th><th>نوع</th><th>طرف‌حساب</th><th>مبلغ</th><th>مانده</th><th>وضعیت</th></tr></thead><tbody>
  ${db.invoices.map((inv) => {
    const st = E.invoiceStatus(inv);
    return `<tr><td class="num">${esc(inv.no)}</td><td>${inv.type === "sale" ? "فروش" : "خرید"}</td><td>${esc(db.contacts.find((c) => c.id === inv.contactId)?.name ?? "—")}</td><td class="num">${money(inv.total)}</td><td class="num">${money(E.invoiceRemaining(inv))}</td><td><span class="chip ${st.key === "paid" ? "pos" : st.key === "partial" ? "warn" : "neg"}">${st.label}</span></td></tr>`;
  }).join("")}</tbody></table></div>
  <div class="btn-row"><button class="btn sm" data-act="open" data-open="sale">＋ فروش</button><button class="btn sm" data-act="open" data-open="purchase">＋ خرید</button><button class="btn sm" data-act="open" data-open="payment-in">دریافت</button></div>`;
}

function listCheques(db: E.DB): string {
  if (!db.cheques.length) return emptyBox("چکی ثبت نشده است.");
  return db.cheques
    .sort((a, b) => (a.due < b.due ? -1 : 1))
    .map((c) => {
      const days = E.daysBetween(E.todayISO(), c.due);
      return `<div class="row"><span class="ico">${c.direction === "received" ? "📥" : "📤"}</span>
        <div class="grow"><div class="t">${esc(c.serial)} · ${esc(c.bank)}</div>
        <div class="s">${c.direction === "received" ? "دریافتی" : "پرداختی"} · سررسید ${esc(E.formatJalali(c.due))}${c.status === "pending" ? ` · ${E.faDigits(Math.abs(days))} روز ${days < 0 ? "تأخیر" : "مانده"}` : ""}</div>
        <div class="s num">${money(c.amount)}</div></div>
        ${c.status === "pending" ? `<div style="display:flex;flex-direction:column;gap:4px"><button class="btn sm" data-act="settle" data-id="${c.id}" data-status="cleared">وصول</button><button class="btn sm danger" data-act="settle" data-id="${c.id}" data-status="bounced">برگشت</button></div>` : `<span class="chip ${c.status === "cleared" ? "pos" : "neg"}">${c.status === "cleared" ? "وصول‌شده" : "برگشتی"}</span>`}
      </div>`;
    })
    .join("");
}

function listLoans(db: E.DB): string {
  if (!db.loans.length) return emptyBox("وامی ثبت نشده است.");
  return db.loans
    .map((loan) => {
      const installments = db.installments.filter((i) => i.loanId === loan.id).sort((a, b) => a.no - b.no);
      return `<div style="margin-bottom:10px"><div class="row" style="border:0"><div class="grow"><div class="t">${esc(loan.title)}</div><div class="s">${esc(loan.lender)} · ${E.faDigits(loan.months)} قسط · نرخ ${E.faDigits(loan.rate)}٪</div></div><span class="num" style="font-weight:700">${money(loan.principal)}</span></div>
        ${installments.map((i) => `<div class="row"><div class="grow"><div class="t">قسط ${E.faDigits(i.no)} — ${esc(E.formatJalali(i.due))}</div><div class="s">اصل ${money(i.principal)} · سود ${money(i.interest)}</div></div>${i.paid ? `<span class="chip pos">پرداخت‌شده</span>` : `<button class="btn sm" data-act="payinst" data-id="${i.id}">پرداخت</button>`}</div>`).join("")}
      </div>`;
    })
    .join("");
}

function listContacts(db: E.DB): string {
  if (!db.contacts.length) return emptyBox("طرف‌حسابی ثبت نشده است.");
  const dc = E.debtorsCreditors(db);
  return `<div class="stats">${statCard("جمع طلب", money(dc.totalDebit), `${E.faDigits(dc.debtors.length)} بدهکار`, "pos")}${statCard("جمع بدهی", money(dc.totalCredit), `${E.faDigits(dc.creditors.length)} بستانکار`, "neg")}</div>
  ${E.contactSummaries(db).map((c) => `<div class="row"><span class="ico">${c.net >= 0 ? "🟢" : "🔴"}</span><div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${esc(E.contactKindLabel(c.kind))} · ${c.net >= 0 ? "بدهکار" : "بستانکار"}${c.overdue > 0 ? ` · معوق ${money(c.overdue)}` : ""}</div></div><div style="text-align:left"><span class="num ${c.net >= 0 ? "pos" : "neg"}" style="font-weight:700">${money(Math.abs(c.net))}</span><button class="btn sm" data-act="statement" data-id="${c.id}">صورتحساب</button></div></div>`).join("")}
  <div class="btn-row"><button class="btn sm pri" data-act="open" data-open="contact">＋ طرف‌حساب جدید</button><button class="btn sm" data-act="guide" data-section="contact">؟ راهنمای بدهکار/بستانکار</button></div>`;
}

function listProducts(db: E.DB): string {
  if (!db.products.length) return emptyBox("کالایی ثبت نشده است.");
  return db.products.map((p) => `<div class="row"><div class="grow"><div class="t">${esc(p.name)}</div><div class="s">${p.kind === "input" ? "نهاده" : "محصول"} · بهای واحد ${money(p.cost)}</div></div><span class="num ${p.stock <= p.min ? "neg" : ""}">${E.faDigits(p.stock)} ${esc(p.unit)}</span></div>`).join("");
}

function listAudit(db: E.DB): string {
  if (!db.audit.length) return emptyBox("رکوردی ثبت نشده است.");
  return [...db.audit].reverse().slice(0, 60).map((a) => `<div class="row"><span class="ico">${a.action === "undo" ? "↩️" : a.action === "reset" ? "🗑️" : "✓"}</span><div class="grow"><div class="t">${esc(a.summary)}</div><div class="s">${esc(a.entity)} · ${esc(E.formatJalali(a.at.slice(0, 10)))}</div></div></div>`).join("");
}

function formRestore(): string {
  return `<form data-form="restore">
    <label>محتوای فایل پشتیبان (JSON)</label>
    <textarea name="payload" rows="7" placeholder='{"version":2,...}'></textarea>
    <button class="btn pri" type="submit" style="width:100%">بازیابی و جایگزینی داده</button>
    <div class="note">پشتیبان را با دکمه «پشتیبان JSON» بگیرید و محتوای آن را اینجا بچسبانید. داده‌ی فعلی جایگزین می‌شود.</div>
  </form>`;
}

function sheetBody(kind: string, fields?: Record<string, string>): string {
  const db = state.db;
  switch (kind) {
    case "quick":
      return `<div class="list-btns">
        ${[
          ["expense", "هزینه", "خرج روزانه و نهاده"],
          ["income", "درآمد", "فروش و خدمات"],
          ["sale", "فاکتور فروش", "با مالیات"],
          ["payment-in", "دریافت", "از مشتری"],
          ["transfer", "انتقال", "صندوق ↔ بانک"],
          ["cheque-received", "چک دریافتی", "با سررسید"],
        ].map(([key, t, s]) => `<button data-act="open" data-open="${key}"><span class="t">${t}</span><span class="s">${s}</span></button>`).join("")}
      </div>
      <div class="note" style="margin-top:8px">همه‌ی ثبت‌ها سند دوطرفه می‌سازند و در گزارش عملیات قابل واگرد هستند.</div>`;
    case "expense":
    case "income":
      return formExpense(db, kind, fields);
    case "transfer":
      return formTransfer(db, fields);
    case "sale":
    case "purchase":
      return formInvoice(db, kind, fields);
    case "payment-in":
    case "payment-out":
      return formPayment(db, kind === "payment-in" ? "in" : "out", fields);
    case "cheque-received":
    case "cheque-paid":
      return formCheque(db, kind === "cheque-received" ? "received" : "paid", fields);
    case "product":
      return formProduct(db);
    case "stock":
      return db.products.length ? formStock(db) : emptyBox("اول یک کالا ثبت کنید.");
    case "asset":
      return formAsset(db);
    case "budget":
      return formBudget(db);
    case "contact":
      return formContact();
    case "project":
      return formProject();
    case "farmop":
      return db.projects.length ? formFarmOp(db) : emptyBox("اول یک زمین ثبت کنید.");
    case "loan":
      return formLoan();
    case "settings":
      return formSettings(db);
    case "restore":
      return formRestore();
    case "contact-statement":
      return contactStatementSheet(Number(fields?.id ?? 0));
    case "debtor-add":
      return debtorForm("customer");
    case "creditor-add":
      return debtorForm("supplier");
    case "lease-new":
      return leaseForm();
    case "lease-list":
      return leaseList();
    case "lease-pay":
      return leasePayForm(fields?.id ? Number(fields.id) : undefined);
    case "lease-sign":
      return leaseSignForm(fields?.id ? Number(fields.id) : undefined);
    case "signatures-list":
      return signaturesList();
    case "lease-contract":
      return leaseContractSheet(Number(fields?.id ?? 0));
    case "guides":
      return guidesSheet();
    case "opening":
      return formOpening(Number(fields?.id ?? 0));
    case "guide":
      return guideHtml(fields?.section ?? "home");
    case "account-ledger":
      return accountLedgerSheet(Number(fields?.id ?? 0));
    case "sales-list":
      return listInvoices(db);
    case "cheques-list":
      return listCheques(db);
    case "loans-list":
      return listLoans(db);
    case "contacts-list":
      return listContacts(db);
    case "products-list":
      return listProducts(db);
    case "audit-list":
      return listAudit(db);
    default:
      return emptyBox("این بخش آماده نیست.");
  }
}

function openSheet(kind: string, fields?: Record<string, string>): void {
  const wrap = $<HTMLElement>("#sheet");
  const title = document.getElementById("sheetTitle");
  const body = document.getElementById("sheetBody");
  if (title) title.textContent = SHEET_TITLES[kind] ?? "ثبت";
  if (body) body.innerHTML = sheetBody(kind, fields);
  wrap.classList.remove("hide");
  state.sheet = kind;
  initSignaturePads();
}

function closeSheet(): void {
  $<HTMLElement>("#sheet").classList.add("hide");
  state.sheet = null;
}

/* -------------------------------- عملیات UI ------------------------------- */

function applyTheme(theme: "light" | "dark"): void {
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById("themeBtn");
  if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
}

function render(): void {
  const view = document.getElementById("view");
  if (!view) return;
  const views: Record<Tab, () => string> = { home: viewHome, ledger: viewLedger, reports: viewReports, assistant: viewAssistant, more: viewMore };
  view.innerHTML = views[state.tab]();
  document.querySelectorAll<HTMLElement>("#nav button").forEach((btn) => btn.classList.toggle("on", btn.dataset.tab === state.tab));
  const biz = document.getElementById("bizname");
  if (biz) biz.textContent = state.db.settings.business;
  const subtitle = document.getElementById("subtitle");
  if (subtitle) subtitle.textContent = `دفتر کل آرام · ${state.db.settings.assistantMode === "backup" ? "حالت پشتیبان" : "حسابداری عمومی"}`;
  const chat = document.getElementById("chat");
  if (chat) chat.scrollTop = chat.scrollHeight;
  const q = document.getElementById("q") as HTMLInputElement | null;
  if (q && state.query) {
    q.addEventListener("input", () => {
      state.query = q.value;
      const view2 = document.getElementById("view");
      if (view2) view2.innerHTML = viewLedger();
      const q2 = document.getElementById("q") as HTMLInputElement | null;
      if (q2) {
        q2.focus();
        q2.setSelectionRange(q2.value.length, q2.value.length);
      }
    });
  }
}

function download(filename: string, content: string, type: string): void {
  try {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast("فایل آماده شد");
  } catch {
    toast("در این دستگاه دانلود ممکن نیست؛ از متن پشتیبان استفاده کنید", true);
  }
}

function exportCSV(): void {
  const db = state.db;
  const rows: string[] = ["تاریخ,شرح,حساب,بدهکار,بستانکار"];
  for (const e of db.entries) {
    for (const l of e.lines) {
      const name = db.accounts.find((a) => a.id === l.accountId)?.name ?? "";
      rows.push([E.formatJalali(e.date), `"${e.desc.replace(/"/g, '""')}"`, name, l.debit, l.credit].join(","));
    }
  }
  download(`kishavar-hesab-ledger-${E.todayISO()}.csv`, "\uFEFF" + rows.join("\r\n"), "text/csv;charset=utf-8");
}

async function copyBackup(): Promise<void> {
  const payload = JSON.stringify(state.db, null, 2);
  try {
    await navigator.clipboard.writeText(payload);
    toast("پشتیبان در کلیپ‌بورد کپی شد");
  } catch {
    download(`kishavar-backup-${E.todayISO()}.json`, payload, "application/json");
  }
}

function handleDraft(tool: string, fields: Record<string, string>): void {
  if (state.db.settings.assistantMode === "backup") {
    toast("حالت پشتیبان فعال است؛ ثبت سند مجاز نیست", true);
    return;
  }
  if (tool === "txn") {
    const kind = fields.kind === "income" ? "income" : fields.kind === "transfer" ? "transfer" : "expense";
    openSheet(kind, fields);
    return;
  }
  if (tool === "invoice") {
    openSheet(fields.type === "purchase" ? "purchase" : "sale", fields);
    return;
  }
  if (tool === "payment") {
    openSheet(fields.direction === "out" ? "payment-out" : "payment-in", fields);
    return;
  }
  openSheet(fields.direction === "paid" ? "cheque-paid" : "cheque-received", fields);
}

function bindEvents(): void {
  document.getElementById("nav")?.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLElement>("button[data-tab]");
    if (!btn?.dataset.tab) return;
    state.tab = btn.dataset.tab as Tab;
    render();
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || !target.matches("[data-lease-role]")) return;
    const form = target.closest<HTMLFormElement>('form[data-form="lease"]');
    if (!form) return;
    const isOwner = target.value === "owner";
    const label = form.querySelector<HTMLElement>("[data-lease-counterparty-label]");
    const nameInput = form.querySelector<HTMLInputElement>("[data-lease-party-name]");
    if (label) label.textContent = isOwner ? "طرف قرارداد — مستاجر / بهره‌بردار" : "طرف قرارداد — مالک زمین (موجر)";
    if (nameInput) nameInput.placeholder = isOwner ? "نام مستاجر / بهره‌بردار" : "نام مالک زمین (موجر)";
  });

  document.getElementById("fab")?.addEventListener("click", () => openSheet("quick"));
  document.getElementById("sheetClose")?.addEventListener("click", closeSheet);
  document.getElementById("sheet")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeSheet();
  });
  document.getElementById("themeBtn")?.addEventListener("click", () => {
    const next = state.db.settings.theme === "dark" ? "light" : "dark";
    state.db = S.updateSettings(state.db, { theme: next });
    state.db = S.saveDB(state.db);
    applyTheme(next);
    toast(next === "dark" ? "تم تیره فعال شد" : "تم روشن فعال شد");
  });

  document.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (!target) return;
    const act = target.dataset.act;
    if (act === "tab" && target.dataset.tab) {
      state.tab = target.dataset.tab as Tab;
      render();
    } else if (act === "open" && target.dataset.open) {
      openSheet(target.dataset.open, target.dataset.id ? { id: target.dataset.id } : undefined);
    } else if (act === "report" && target.dataset.key) {
      state.reportTab = target.dataset.key;
      render();
    } else if (act === "undo" && target.dataset.id) {
      if (window.confirm("این سند از دفتر کل واگرد شود؟ اثر آن در گزارش‌ها حذف می‌شود.")) {
        try {
          commit(S.removeEntry(state.db, Number(target.dataset.id)), "سند واگرد شد");
        } catch (error) {
          toast(error instanceof Error ? error.message : "واگرد انجام نشد", true);
        }
      }
    } else if (act === "settle" && target.dataset.id) {
      try {
        commit(S.settleCheque(state.db, Number(target.dataset.id), target.dataset.status === "bounced" ? "bounced" : "cleared"), "وضعیت چک به‌روز شد");
        openSheet("cheques-list");
      } catch (error) {
        toast(error instanceof Error ? error.message : "به‌روزرسانی انجام نشد", true);
      }
    } else if (act === "payinst" && target.dataset.id) {
      try {
        commit(S.payInstallment(state.db, Number(target.dataset.id)), "قسط پرداخت و سند ثبت شد");
        openSheet("loans-list");
      } catch (error) {
        toast(error instanceof Error ? error.message : "پرداخت انجام نشد", true);
      }
    } else if (act === "export") {
      if (target.dataset.kind === "csv") exportCSV();
      else void copyBackup();
    } else if (act === "demo") {
      if (window.confirm("داده‌های نمونه روی داده فعلی افزوده/جایگزین می‌شود. ادامه؟")) commit(S.demoDB(), "داده نمونه بارگذاری شد");
    } else if (act === "reset") {
      if (window.confirm("همه داده‌های محلی پاک شود؟ این کار قابل بازگشت نیست.")) commit(S.resetDB(), "همه داده‌ها پاک شد");
    } else if (act === "guides") {
      openSheet("guides");
    } else if (act === "sig-clear" && target.dataset.pad) {
      const canvas = document.getElementById(`sig${target.dataset.pad}`) as HTMLCanvasElement | null;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const hidden = document.getElementById(`sigData${target.dataset.pad}`) as HTMLInputElement | null;
        if (hidden) hidden.value = "";
      }
    } else if (act === "lease-contract" && target.dataset.id) {
      openSheet("lease-contract", { id: target.dataset.id });
    } else if (act === "lease-end" && target.dataset.id) {
      if (window.confirm("این قرارداد پایان‌یافته شود؟")) {
        try {
          commit(S.endLease(state.db, Number(target.dataset.id), "ended"), "قرارداد پایان یافت");
          openSheet("lease-list");
        } catch (error) {
          toast(error instanceof Error ? error.message : "انجام نشد", true);
        }
      }
    } else if (act === "copy-text" && target.dataset.id) {
      const text = leaseContractText(state.db, Number(target.dataset.id));
      void navigator.clipboard?.writeText(text).then(() => toast("متن قرارداد کپی شد")).catch(() => toast("کپی ممکن نشد", true));
    } else if (act === "guide" && target.dataset.section) {
      openSheet("guide", { section: target.dataset.section });
    } else if (act === "statement" && target.dataset.id) {
      openSheet("contact-statement", { id: target.dataset.id });
    } else if (act === "statement-list") {
      openSheet("contacts-list");
    } else if (act === "account-ledger" && target.dataset.id) {
      openSheet("account-ledger", { id: target.dataset.id });
    } else if (act === "pay-for" && target.dataset.id) {
      openSheet(target.dataset.direction === "out" ? "payment-out" : "payment-in", { contactId: target.dataset.id });
    } else if (act === "ask-guide" && target.dataset.text) {
      closeSheet();
      askAssistant(target.dataset.text);
    } else if (act === "copy-statement" && target.dataset.id) {
      const text = E.statementText(state.db, Number(target.dataset.id));
      void navigator.clipboard
        ?.writeText(text)
        .then(() => toast("صورتحساب در کلیپ‌بورد کپی شد"))
        .catch(() => toast("کپی ممکن نشد؛ از خروجی CSV استفاده کنید", true));
    } else if (act === "small") {
      toast("این بخش در نسخه‌ی بعد اضافه می‌شود");
    } else if (act === "sample" && target.dataset.text) {
      askAssistant(target.dataset.text);
    } else if (act === "draft" && target.dataset.tool) {
      try {
        handleDraft(target.dataset.tool, JSON.parse(target.dataset.fields ?? "{}") as Record<string, string>);
      } catch {
        toast("پیش‌نویس قابل خواندن نبود", true);
      }
    }
  });

  document.addEventListener("submit", (event) => {
    const form = event.target as HTMLFormElement;
    const kind = form.dataset.form;
    if (!kind) return;
    event.preventDefault();
    const data = new FormData(form);
    const num = (name: string) => E.toAmount(data.get(name));
    const str = (name: string) => String(data.get(name) ?? "").trim();
    try {
      switch (kind) {
        case "assistant": {
          askAssistant(str("text"));
          return;
        }
        case "txn": {
          const txnKind = form.dataset.kind === "income" ? "income" : "expense";
          commit(
            S.addTransaction(state.db, {
              kind: txnKind,
              amount: num("amount"),
              date: str("date") || E.todayISO(),
              desc: str("desc"),
              accountId: Number(data.get("accountId")),
              categoryId: Number(data.get("categoryId")),
              contactId: data.get("contactId") ? Number(data.get("contactId")) : null,
              projectId: data.get("projectId") ? Number(data.get("projectId")) : null,
            }),
            "سند ثبت شد",
          );
          break;
        }
        case "transfer": {
          commit(S.addTransfer(state.db, { amount: num("amount"), date: str("date") || E.todayISO(), desc: str("desc"), fromId: Number(data.get("fromId")), toId: Number(data.get("toId")) }), "انتقال ثبت شد");
          break;
        }
        case "invoice": {
          const type = form.dataset.type === "purchase" ? "purchase" : "sale";
          commit(
            S.addInvoice(state.db, {
              type,
              contactId: Number(data.get("contactId")),
              date: str("date") || E.todayISO(),
              due: str("due") || str("date") || E.todayISO(),
              items: [{ desc: str("desc"), qty: Number(E.normalizeDigits(str("qty")) || "1"), price: num("price"), productId: data.get("productId") ? Number(data.get("productId")) : null }],
              discount: num("discount"),
              taxRate: num("taxRate"),
              targetCode: str("targetCode") || "5120",
              applyStock: data.get("applyStock") === "on",
            }),
            "فاکتور ثبت شد",
          );
          break;
        }
        case "payment": {
          const direction = form.dataset.direction === "out" ? "out" : "in";
          commit(
            S.addPayment(state.db, {
              direction,
              amount: num("amount"),
              date: str("date") || E.todayISO(),
              accountId: Number(data.get("accountId")),
              contactId: data.get("contactId") ? Number(data.get("contactId")) : null,
              method: (str("method") as "cash" | "bank" | "cheque") || "bank",
              invoiceId: data.get("invoiceId") ? Number(data.get("invoiceId")) : null,
            }),
            "دریافت/پرداخت ثبت شد",
          );
          break;
        }
        case "cheque": {
          commit(
            S.addCheque(state.db, {
              direction: form.dataset.direction === "paid" ? "paid" : "received",
              serial: str("serial"),
              bank: str("bank"),
              amount: num("amount"),
              due: str("due") || E.todayISO(),
              contactId: data.get("contactId") ? Number(data.get("contactId")) : null,
            }),
            "چک ثبت شد",
          );
          break;
        }
        case "product":
          commit(S.addProduct(state.db, { name: str("name"), unit: str("unit"), kind: str("kind") === "input" ? "input" : "product", cost: num("cost"), price: num("price"), stock: num("stock"), min: num("min") }), "کالا ثبت شد");
          break;
        case "stock":
          commit(S.addStockMove(state.db, { productId: Number(data.get("productId")), kind: str("kind") === "out" ? "out" : "in", qty: num("qty"), unitCost: num("unitCost"), date: str("date") || E.todayISO(), note: str("note") }), "گردش انبار ثبت شد");
          break;
        case "asset":
          commit(S.addAsset(state.db, { name: str("name"), cost: num("cost"), salvage: num("salvage"), lifeMonths: num("lifeMonths"), purchase: str("purchase") || E.todayISO(), paidFromId: Number(data.get("paidFromId")) }), "دارایی ثبت شد");
          break;
        case "budget":
          commit(S.addBudget(state.db, { accountId: Number(data.get("accountId")), amount: num("amount"), year: E.toJalali(new Date()).jy }), "بودجه ثبت شد");
          break;
        case "contact":
          commit(S.addContact(state.db, { name: str("name"), kind: (str("kind") as E.Contact["kind"]) || "customer", phone: str("phone") }), "طرف‌حساب ثبت شد");
          break;
        case "project":
          commit(S.addProject(state.db, { name: str("name"), crop: str("crop"), area: num("area"), sharePercent: num("sharePercent") }), "زمین ثبت شد");
          break;
        case "farmop":
          commit(S.addFarmOp(state.db, { projectId: Number(data.get("projectId")), date: str("date") || E.todayISO(), kind: (str("kind") as E.FarmOp["kind"]) || "cost", desc: str("desc"), amount: num("amount"), qty: num("qty") || undefined, unit: str("unit") || undefined, payFromId: Number(data.get("payFromId")) }), "عملیات ثبت شد");
          break;
        case "loan":
          commit(S.addLoan(state.db, { title: str("title"), lender: str("lender"), principal: num("principal"), rate: num("rate"), months: num("months"), start: str("start") || E.todayISO() }), "وام و اقساط ساخته شد");
          break;
        case "debtor": {
          const isCustomer = form.dataset.kind !== "supplier";
          let next = S.addContact(state.db, { name: str("name"), kind: (str("contactKind") as E.Contact["kind"]) || (isCustomer ? "customer" : "supplier"), phone: str("phone") });
          const newId = next.contacts[next.contacts.length - 1].id;
          const amount = num("amount");
          if (amount > 0) next = S.addContactOpening(next, { contactId: newId, amount, side: str("side") === "credit" ? "credit" : "debit", date: str("date") || E.todayISO() });
          const image = str("signature");
          if (image) next = S.addContactSignature(next, { contactId: newId, signerName: str("name"), image, role: isCustomer ? "مشتری" : "تأمین‌کننده" });
          commit(next, isCustomer ? "بدهکار اضافه شد" : "بستانکار اضافه شد");
          break;
        }
        case "lease": {
          const leaseUserRole: "tenant" | "owner" = str("role") === "owner" ? "owner" : "tenant";
          const counterparty = S.ensureLeaseCounterparty(state.db, {
            role: leaseUserRole,
            counterpartyId: Number(data.get("counterpartyId") || 0),
            name: str("counterpartyName"),
            phone: str("counterpartyPhone"),
          });
          const startIso = E.jalaliInputToISO(str("start"));
          const endIso = E.jalaliInputToISO(str("end"));
          if (!startIso || !endIso) throw new Error("تاریخ شروع و پایان را به شکل شمسی و کامل وارد کنید؛ نمونه: ۱۴۰۵/۰۸/۰۵");
          if (endIso <= startIso) throw new Error("تاریخ پایان باید بعد از تاریخ شروع باشد.");
          let next = S.addLease(counterparty.db, {
            title: str("title"),
            kind: (str("kind") as "cash" | "share" | "mixed") || "cash",
            role: leaseUserRole,
            counterpartyId: counterparty.contactId,
            location: str("location"),
            plate: str("plate"),
            area: num("area"),
            crop: str("crop"),
            start: startIso,
            end: endIso,
            cycle: (str("cycle") as "once" | "monthly" | "seasonal" | "annual") || "seasonal",
            total: num("total"),
            sharePercent: num("sharePercent"),
            deposit: num("deposit"),
            waterShare: str("waterShare"),
            waterPaidBy: str("waterPaidBy"),
            terms: str("terms"),
            witnesses: str("witnesses"),
            accountId: Number(data.get("accountId")),
          });
          const leaseId = next.leases[next.leases.length - 1].id;
          const image = str("signature");
          if (image)
            next = S.addLeaseSignature(next, {
              leaseId,
              role: leaseUserRole === "tenant" ? "موجر" : "مستاجر",
              signerName: counterparty.name,
              image,
            });
          commit(next, "قرارداد اجاره با طرف قرارداد ثبت شد");
          break;
        }
        case "leasepay": {
          commit(
            S.addLeasePayment(state.db, {
              leaseId: Number(data.get("leaseId")),
              amount: num("amount"),
              date: str("date") || E.todayISO(),
              accountId: Number(data.get("accountId")),
              scheduleNo: str("scheduleNo") ? Number(str("scheduleNo")) : null,
              note: str("note"),
            }),
            "پرداخت اجاره ثبت شد",
          );
          break;
        }
        case "leasesign": {
          if (data.get("confirm") !== "on") throw new Error("تأیید ثبت امضا لازم است.");
          const image = str("signature");
          if (!image) throw new Error("امضا خالی است؛ روی کادر امضا بکشید.");
          commit(S.addLeaseSignature(state.db, { leaseId: Number(data.get("leaseId")), role: str("role"), signerName: str("signerName"), image }), "امضا ثبت شد");
          break;
        }
        case "opening": {
          commit(
            S.addContactOpening(state.db, {
              contactId: Number(form.dataset.id),
              amount: num("amount"),
              side: str("side") === "credit" ? "credit" : "debit",
              date: str("date") || E.todayISO(),
            }),
            "مانده اول دوره ثبت شد",
          );
          break;
        }
        case "settings": {
          const theme = str("theme") === "dark" ? "dark" : "light";
          state.db = S.updateSettings(state.db, {
            business: str("business") || "کسب‌وکار من",
            owner: str("owner"),
            taxRate: num("taxRate"),
            assistantMode: str("assistantMode") === "backup" ? "backup" : "assistant",
            theme,
          });
          applyTheme(theme);
          commit(state.db, "تنظیمات ذخیره شد");
          break;
        }
        case "restore": {
          const payload = str("payload");
          const parsed = JSON.parse(payload) as E.DB;
          if (!parsed || parsed.version !== 2 || !Array.isArray(parsed.entries)) throw new Error("فایل پشتیبان معتبر نیست");
          commit({ ...parsed, savedAt: new Date().toISOString() }, "پشتیبان بازیابی شد");
          break;
        }
        default:
          return;
      }
      closeSheet();
    } catch (error) {
      toast(error instanceof Error ? error.message : "ثبت انجام نشد", true);
    }
  });
}

function askAssistant(text: string): void {
  const value = text.trim();
  if (!value) return;
  const result = runAssistant(value, state.db);
  state.chat = [...state.chat, { role: "me", text: value }, { role: "bot", text: result.reply, result }];
  state.tab = "assistant";
  render();
}

export function startApp(): void {
  state = {
    db: S.loadDB(),
    tab: "home",
    reportTab: "pl",
    query: "",
    chat: [
      {
        role: "bot",
        text: "سلام! یک جمله بنویسید یا از نمونه‌ها استفاده کنید. من فقط پیش‌نویس می‌سازم و اعداد را از موتور قطعی حسابداری می‌خوانم؛ بدون تأیید شما سندی ثبت نمی‌شود.",
      },
    ],
    sheet: null,
  };
  applyTheme(state.db.settings.theme);
  const net = document.getElementById("netpill");
  if (net) net.innerHTML = `<span class="dot"></span>محلی${navigator.onLine ? "" : " · آفلاین"}`;
  render();
  bindEvents();
}

/* ---- جداکننده‌ی هزارگان هنگام تایپ مبلغ: 100,000,000 ---- */
function setupMoneyFormatting(): void {
  document.addEventListener(
    "input",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.dataset.money !== "1") return;
      const cleaned = E.normalizeDigits(target.value).replace(/[^0-9]/g, "");
      if (!cleaned) {
        target.value = "";
        return;
      }
      const grouped = E.groupAmount(Number(cleaned));
      if (target.value !== grouped) {
        target.value = grouped;
        try {
          target.setSelectionRange(grouped.length, grouped.length);
        } catch {
          /* برخی مرورگرها پشتیبانی نمی‌کنند */
        }
      }
    },
    true,
  );
}

if (typeof document !== "undefined") setupMoneyFormatting();
