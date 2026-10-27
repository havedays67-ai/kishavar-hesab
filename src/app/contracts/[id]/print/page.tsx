import { notFound } from "next/navigation";
import { db } from "@/db";
import { agriContractPayments, agriContracts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DocPrintBar } from "@/components/print/DocPrintBar";
import { Icon } from "@/components/ui";
import { formatJalaliNumeric, formatMoney, formatMoneyWords, formatNumber } from "@/lib/format";
import { contractTypeLabel, perspectiveLabel } from "@/lib/contracts/model";

export const dynamic = "force-dynamic";

export default async function ContractPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contractId = Number(id);
  if (!Number.isFinite(contractId) || contractId <= 0) notFound();
  const [contract] = await db.select().from(agriContracts).where(eq(agriContracts.id, contractId)).limit(1);
  if (!contract) notFound();
  const payments = await db.select().from(agriContractPayments).where(eq(agriContractPayments.contractId, contractId));
  const paid = payments.filter((p) => p.kind === "rent").reduce((sum, p) => sum + Number(p.amountToman || 0), 0);
  const remaining = Math.max(0, Number(contract.totalRentToman) - paid);
  const serial = `AG-${contract.id}-${formatJalaliNumeric(contract.startDate).replace(/\//g, "")}`;
  const myRole = perspectiveLabel(contract.perspective);
  const otherRole = contract.perspective === "lessee" ? "موجر / مالک زمین" : "مستأجر / عامل";

  return (
    <div className="mx-auto max-w-[860px] space-y-3">
      <DocPrintBar backHref="/contracts" hint="سند قرارداد زمین؛ برای نسخه رسمی، امضا و مهر طرفین و شهود لازم است." />

      <article className="print-doc" dir="rtl">
        <header className="doc-head">
          <div className="doc-head-brand">
            <span className="doc-logo"><Icon name="sprout" className="h-7 w-7" /></span>
            <div>
              <strong>کشاورزحساب</strong>
              <span>سند قرارداد زمین کشاورزی</span>
              <span>کد پیگیری: {serial}</span>
            </div>
          </div>
          <div className="doc-head-title">
            <span className="doc-republic">جمهوری اسلامی ایران</span>
            <h1>قرارداد {contractTypeLabel(contract.type)}</h1>
            <span className="doc-subtitle">{contract.title}</span>
          </div>
          <div className="doc-head-meta">
            <span>تاریخ تنظیم: <b>{formatJalaliNumeric(contract.startDate)}</b></span>
            <span>شروع: <b>{formatJalaliNumeric(contract.startDate)}</b></span>
            <span>پایان: <b>{formatJalaliNumeric(contract.endDate)}</b></span>
            <span>وضعیت: <b>{{ draft: "پیش‌نویس", active: "فعال", ended: "پایان‌یافته", canceled: "لغوشده" }[contract.status] ?? contract.status}</b></span>
          </div>
        </header>
        <div className="doc-rule" />

        <section className="doc-grid-2">
          <div className="doc-box">
            <h2>طرف اول (این سند)</h2>
            <p className="doc-kv"><span>نقش</span><b>{myRole}</b></p>
            <p className="doc-kv"><span>طرف قرارداد</span><b>{contract.counterpartyName}</b></p>
            <p className="doc-kv"><span>تلفن</span><b>{contract.counterpartyPhone || "—"}</b></p>
          </div>
          <div className="doc-box">
            <h2>مشخصات مورد قرارداد</h2>
            <p className="doc-kv"><span>نقش طرف مقابل</span><b>{otherRole}</b></p>
            <p className="doc-kv"><span>مساحت</span><b>{contract.areaHa ? `${formatNumber(contract.areaHa)} هکتار` : "—"}</b></p>
            <p className="doc-kv"><span>محل / پلاک</span><b>{[contract.location, contract.plate].filter(Boolean).join(" — ") || "—"}</b></p>
          </div>
        </section>

        <section className="doc-section">
          <h2>موضوع و مدت قرارداد</h2>
          <table className="doc-table">
            <tbody>
              <tr>
                <th>نوع قرارداد</th>
                <td>{contractTypeLabel(contract.type)}</td>
                <th>محصول مورد کشت</th>
                <td>{contract.crop || "—"}</td>
              </tr>
              <tr>
                <th>مدت</th>
                <td>{formatJalaliNumeric(contract.startDate)} تا {formatJalaliNumeric(contract.endDate)}</td>
                <th>دوره پرداخت</th>
                <td>{{ once: "یک‌باره", monthly: "ماهانه", seasonal: "فصلی", annual: "سالانه" }[contract.cycle] ?? contract.cycle}</td>
              </tr>
              <tr>
                <th>مال‌الاجاره / تعهد نقدی</th>
                <td className="num">{formatMoney(contract.totalRentToman)}</td>
                <th>ودیعه</th>
                <td className="num">{formatMoney(contract.depositToman)}</td>
              </tr>
              <tr>
                <th>سهم مالک از محصول</th>
                <td className="num">{contract.landownerSharePercent}٪</td>
                <th>سهم آب</th>
                <td>{contract.waterShare || "—"}</td>
              </tr>
              <tr>
                <th>هزینه آب</th>
                <td>{{ farmer: "کشاورز", landowner: "مالک", split: "تقسیم مساوی" }[contract.waterPaidBy] ?? contract.waterPaidBy}</td>
                <th>هزینه‌های کشت</th>
                <td>{{ farmer: "کشاورز", landowner: "مالک", split: "تقسیم مساوی" }[contract.costsPaidBy] ?? contract.costsPaidBy}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="doc-section">
          <h2>وضعیت مالی</h2>
          <table className="doc-table doc-money">
            <thead>
              <tr><th>شرح</th><th>مبلغ</th></tr>
            </thead>
            <tbody>
              <tr><td>تعهد کل نقدی</td><td className="num">{formatMoney(contract.totalRentToman)}</td></tr>
              <tr><td>پرداخت‌شده</td><td className="num">{formatMoney(paid)}</td></tr>
              <tr className="doc-total-row"><td>مانده</td><td className="num">{formatMoney(remaining)}</td></tr>
            </tbody>
          </table>
          <p className="doc-words">مانده به حروف: <b>{formatMoneyWords(remaining)}</b></p>
          {payments.length > 0 ? (
            <table className="doc-table" style={{ marginTop: 6 }}>
              <thead>
                <tr><th>تاریخ</th><th>نوع</th><th>حساب</th><th>مبلغ</th><th>یادداشت</th></tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatJalaliNumeric(payment.paidAt)}</td>
                    <td>{{ rent: "اجاره", deposit: "ودیعه", deposit_refund: "برگشت ودیعه", crop_share: "سهم محصول", other: "سایر" }[payment.kind] ?? payment.kind}</td>
                    <td>{{ bank: "بانکی", cash: "نقدی" }[payment.account] ?? payment.account}</td>
                    <td className="num">{formatMoney(payment.amountToman)}</td>
                    <td>{payment.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>

        <section className="doc-section">
          <h2>شرایط و تعهدات</h2>
          <ol className="doc-list doc-terms">
            <li>طرفین با رعایت مقررات قانون مدنی و احکام مربوط به {contractTypeLabel(contract.type)}، مورد قرارداد را با شرایط مندرج در این سند توافق کردند.</li>
            <li>تحویل مورد قرارداد در تاریخ {formatJalaliNumeric(contract.startDate)} انجام و پس از پایان مدت، با رعایت عرف و شرایط سند، مسترد می‌شود.</li>
            <li>پرداخت تعهد نقدی مطابق دوره توافق‌شده انجام می‌شود و مانده مندرج در جدول مالی، تعهد باقیمانده است.</li>
            <li>سهم آب، سهم محصول و هزینه‌های کشت بر اساس جدول موضوع قرارداد تقسیم می‌شود.</li>
            {contract.terms ? <li>{contract.terms}</li> : null}
            <li>هرگونه تغییر در شرایط، تنها با توافق کتبی طرفین و در قالب الحاقیه معتبر است.</li>
            <li>این سند با امضای طرفین و شهود (در صورت وجود) لازم‌الاجراست؛ مستند به ماده ۱۰ قانون مدنی.</li>
          </ol>
          {contract.notes ? <p className="doc-body-text">یادداشت: {contract.notes}</p> : null}
          {contract.witnesses ? <p className="doc-note">شهود / امضاکنندگان: {contract.witnesses}</p> : null}
        </section>

        <section className="doc-signatures">
          <div className="doc-sign">
            <span>طرف اول</span>
            <small>{myRole}</small>
            <span className="doc-sign-space">مهر و امضا</span>
          </div>
          <div className="doc-sign">
            <span>{otherRole}</span>
            <small>{contract.counterpartyName}</small>
            <span className="doc-sign-space">مهر و امضا</span>
          </div>
          <div className="doc-sign">
            <span>شاهد / ناظر</span>
            <small>{contract.witnesses || "—"}</small>
            <span className="doc-sign-space">امضا</span>
          </div>
        </section>

        <footer className="doc-foot">
          <div>
            <strong style={{ fontSize: 10, color: "#1e5827" }}>کد پیگیری سند: {serial}</strong>
            <span style={{ display: "block", fontSize: 9, color: "#5b6a5e" }}>این سند از سامانه کشاورزحساب صادر شده و در پایگاه داده قابل بازیابی است.</span>
          </div>
          <div className="doc-foot-meta">
            <span>تاریخ چاپ: {formatJalaliNumeric(new Date())}</span>
            <span>کشاورزحساب — قرارداد زمین کشاورزی</span>
          </div>
        </footer>
      </article>
    </div>
  );
}
