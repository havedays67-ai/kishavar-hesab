import { Icon } from "@/components/ui";
import { formatDate, formatJalaliNumeric, formatMoney, formatMoneyWords, formatNumber } from "@/lib/format";
import { DOC_TYPES, GRADE_LABEL, TRADE_MODE_META, type DocType, type TradeCalc } from "@/lib/trade/engine";
import { calcOf, type PaymentRow, type TradeRow } from "@/lib/trade/service";

const toman = (value: number) => `${formatNumber(Math.round(value || 0))} تومان`;
const kg = (value: number) => `${formatNumber(Math.round((value || 0) * 1000) / 1000)} کیلوگرم`;

export function TradeDocument({
  trade,
  payments,
  docType,
  serial,
  issuedAt,
  verifyUrl,
  qrSvg,
}: {
  trade: TradeRow;
  payments: PaymentRow[];
  docType: DocType;
  serial: string;
  issuedAt: Date;
  verifyUrl: string;
  qrSvg: string;
}) {
  const calc = calcOf(trade) as TradeCalc;
  const meta = DOC_TYPES[docType];
  const paid = payments.reduce((sum, payment) => sum + Number(payment.amountToman || 0), 0);
  const balance = Math.max(0, Number(trade.totalToman) - paid);
  const isInvoice = docType === "invoice";
  const numberIssuer = trade.direction === "sell" ? trade.sellerName : trade.buyerName;
  const numberIssuerId = trade.direction === "sell" ? trade.sellerNationalId : trade.buyerNationalId;
  const numberIssuerPhone = trade.direction === "sell" ? trade.sellerPhone : trade.buyerPhone;

  return (
    <article className="print-doc" dir="rtl">
      <header className="doc-head">
        <div className="doc-head-brand">
          <span className="doc-logo">
            <Icon name="sprout" className="h-7 w-7" />
          </span>
          <div>
            <strong>{numberIssuer || "کشاورزحساب"}</strong>
            <span>شناسه/کد ملی: {numberIssuerId || "—"}</span>
            <span>تلفن: {numberIssuerPhone || "—"}</span>
          </div>
        </div>
        <div className="doc-head-title">
          <span className="doc-republic">جمهوری اسلامی ایران</span>
          <h1>{meta.title}</h1>
          <span className="doc-subtitle">سند معامله محصول کشاورزی — {trade.cropName}</span>
        </div>
        <div className="doc-head-meta">
          <span>شماره سریال: <b className="num">{serial}</b></span>
          <span>تاریخ صدور: <b>{formatJalaliNumeric(issuedAt)}</b></span>
          <span>کد معامله: <b className="num">{trade.code}</b></span>
          <span>تاریخ قرارداد: <b>{formatJalaliNumeric(trade.contractDate)}</b></span>
        </div>
      </header>

      <div className="doc-rule" />

      <section className="doc-grid-2">
        <div className="doc-box">
          <h2>مشخصات فروشنده</h2>
          <Row label="نام / عنوان" value={trade.sellerName || "—"} />
          <Row label="کد ملی / شناسه ملی" value={trade.sellerNationalId || "—"} />
          <Row label="تلفن" value={trade.sellerPhone || "—"} />
          <Row label="استان" value={trade.province || "—"} />
        </div>
        <div className="doc-box">
          <h2>مشخصات خریدار</h2>
          <Row label="نام / عنوان" value={trade.buyerName || "—"} />
          <Row label="نوع خریدار" value={buyerTypeLabel(trade.buyerType)} />
          <Row label="کد ملی / شناسه ملی" value={trade.buyerNationalId || "—"} />
          <Row label="تلفن" value={trade.buyerPhone || "—"} />
        </div>
      </section>

      <section className="doc-section">
        <h2>مشخصات محصول و تحویل</h2>
        <table className="doc-table">
          <tbody>
            <tr>
              <th>نوع محصول</th>
              <td>{trade.cropName}</td>
              <th>رقم / واریته</th>
              <td>{trade.variety || "—"}</td>
            </tr>
            <tr>
              <th>نوع معامله</th>
              <td>{TRADE_MODE_META[trade.mode as keyof typeof TRADE_MODE_META]?.label ?? trade.mode}</td>
              <th>درجه کیفی</th>
              <td>{trade.gradeLabel || GRADE_LABEL[calc.quality.grade]}</td>
            </tr>
            <tr>
              <th>محل تحویل</th>
              <td>{trade.deliveryPlace || "—"}</td>
              <th>تاریخ تحویل</th>
              <td>{trade.deliveryDate ? formatDate(trade.deliveryDate) : "—"}</td>
            </tr>
            <tr>
              <th>پلاک خودرو</th>
              <td>{trade.vehiclePlate || "—"}</td>
              <th>نام راننده</th>
              <td>{trade.driverName || "—"}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {(docType === "weighing" || docType === "contract" || docType === "invoice" || docType === "settlement") && (
        <section className="doc-section">
          <h2>وزن و کسورات</h2>
          <table className="doc-table">
            <tbody>
              <tr>
                <th>وزن پر (ناخالص)</th>
                <td className="num">{trade.grossKg > 0 ? kg(trade.grossKg) : "—"}</td>
                <th>وزن خالی</th>
                <td className="num">{trade.tareKg > 0 ? kg(trade.tareKg) : "—"}</td>
              </tr>
              <tr>
                <th>وزن خالص</th>
                <td className="num"><b>{kg(trade.netKg)}</b></td>
                <th>وزن تعدیل‌شده (پس از افت)</th>
                <td className="num"><b>{kg(trade.adjustedKg)}</b></td>
              </tr>
              <tr>
                <th>افت رطوبت مازاد</th>
                <td className="num">{calc.weights.moistureDeductionPct}٪ — {kg(calc.weights.moistureDeductionKg)}</td>
                <th>افت ناخالصی مازاد</th>
                <td className="num">{kg(calc.weights.foreignDeductionKg)}</td>
              </tr>
              <tr>
                <th>افت مفید و غیرمفید</th>
                <td className="num">{kg(calc.weights.standardDeductionKg)}</td>
                <th>افت دانه شکسته</th>
                <td className="num">{kg(calc.weights.brokenDeductionKg)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {docType === "quality" && (
        <section className="doc-section">
          <h2>شاخص‌های کیفی نمونه</h2>
          <table className="doc-table">
            <thead>
              <tr>
                <th>شاخص</th>
                <th>مقدار اندازه‌گیری‌شده</th>
                <th>حد مجاز / پذیرش</th>
                <th>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              <QualityRow label="رطوبت" value={`${trade.moisturePct}٪`} limit={`پایه ${calc.weights.moistureExcessPct > 0 ? calc.weights.moistureExcessPct : 0}٪ مازاد`} ok={trade.moisturePct <= 14} />
              <QualityRow label="ناخالصی (خاک، سنگ، کاه)" value={`${trade.foreignMatterPct}٪`} limit="حداکثر ۲٪ (مازاد کسر وزنی)" ok={trade.foreignMatterPct <= 2} />
              <QualityRow label="دانه شکسته" value={`${trade.brokenPct}٪`} limit="حداکثر ۲٪" ok={trade.brokenPct <= 2} />
              <QualityRow label="سن‌زدگی" value={`${trade.pestPct}٪`} limit="حداکثر ۰٫۵٪" ok={trade.pestPct <= 0.5} />
              <QualityRow label="وزن هکتولیتر" value={trade.hectoliter ? `${trade.hectoliter} kg/hl` : "اندازه‌گیری نشده"} limit="درجه یک ≥ ۷۸ · دو ≥ ۷۵ · سه ≥ ۷۲" ok={trade.hectoliter >= 72} />
              <QualityRow label="پروتئین" value={trade.proteinPct ? `${trade.proteinPct}٪` : "اختیاری"} limit="مبنای درجه‌بندی گندم" ok />
            </tbody>
          </table>
          <p className="doc-note">
            نتیجه درجه‌بندی: <b>{trade.gradeLabel}</b> · امتیاز کیفی: <b>{calc.quality.score} از ۱۰۰</b> · ضریب قیمت: <b>{calc.quality.priceFactor}</b>
          </p>
          {calc.quality.notes.length > 0 && (
            <ul className="doc-list">
              {calc.quality.notes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          )}
          <p className="doc-body-text">
            نمونه‌برداری در محل تحویل و بر اساس روش استاندارد انجام شده است. طرفین حق دارند در صورت اعتراض، نمونه دوم را در مرجع
            آزمایشگاه‌های مجاز بررسی کنند. اعداد این صورتجلسه مبنای محاسبه فاکتور و تسویه است.
          </p>
        </section>
      )}

      {(isInvoice || docType === "contract" || docType === "settlement") && (
        <section className="doc-section">
          <h2>صورت مالی</h2>
          <table className="doc-table doc-money">
            <thead>
              <tr>
                <th>شرح</th>
                <th>مقدار / نرخ</th>
                <th>مبلغ</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>ارزش {trade.cropName} پس از کسورات</td>
                <td className="num">{kg(trade.adjustedKg)} × {formatNumber(calc.price.gradePricePerKgToman)} تومان</td>
                <td className="num">{formatMoney(calc.money.grossToman)}</td>
              </tr>
              {calc.money.insuranceToman > 0 && (
                <tr>
                  <td>حق بیمه محصول</td>
                  <td className="num">{formatNumber(calc.price.insurancePerKgToman)} تومان/کیلو</td>
                  <td className="num">{formatMoney(calc.money.insuranceToman)}</td>
                </tr>
              )}
              {calc.money.commissionToman > 0 && (
                <tr>
                  <td>کارمزد / دلالی</td>
                  <td className="num">{calc.money.vatRatePct > 0 ? `${formatNumber(calc.money.vatRatePct)}٪ مالیات بر خدمات` : "—"}</td>
                  <td className="num">− {formatMoney(calc.money.commissionToman)}</td>
                </tr>
              )}
              {calc.money.sellerFeesToman > 0 && (
                <tr>
                  <td>کرایه حمل، تخلیه، باسکول و سایر هزینه‌ها</td>
                  <td className="num">—</td>
                  <td className="num">− {formatMoney(calc.money.sellerFeesToman)}</td>
                </tr>
              )}
              {calc.money.vatToman > 0 && (
                <tr>
                  <td>مالیات و عوارض ارزش افزوده</td>
                  <td className="num">{calc.money.vatRatePct}٪</td>
                  <td className="num">{formatMoney(calc.money.vatToman)}</td>
                </tr>
              )}
              {calc.money.delayPenaltyToman > 0 && (
                <tr>
                  <td>خسارت تأخیر در پرداخت</td>
                  <td className="num">{calc.money.delayPenaltyToman ? `${formatNumber(Number(calc.money.delayPenaltyToman))}` : "—"}</td>
                  <td className="num">− {formatMoney(calc.money.delayPenaltyToman)}</td>
                </tr>
              )}
              {calc.money.adjustmentToman !== 0 && (
                <tr>
                  <td>تعدیل توافقی</td>
                  <td className="num">—</td>
                  <td className="num">{formatMoney(calc.money.adjustmentToman)}</td>
                </tr>
              )}
              <tr className="doc-total-row">
                <td colSpan={2}>مبلغ قابل تسویه</td>
                <td className="num">{formatMoney(trade.totalToman)}</td>
              </tr>
              <tr>
                <td colSpan={2}>پیش‌پرداخت / دریافتی ثبت‌شده</td>
                <td className="num">{formatMoney(paid || trade.prepaidToman)}</td>
              </tr>
              <tr className="doc-total-row">
                <td colSpan={2}>مانده قابل پرداخت</td>
                <td className="num">{formatMoney(balance)}</td>
              </tr>
            </tbody>
          </table>
          <p className="doc-words">
            مبلغ به حروف: <b>{formatMoneyWords(trade.totalToman)}</b>
            {balance > 0 ? <> — مانده به حروف: <b>{formatMoneyWords(balance)}</b></> : null}
          </p>
          {isInvoice && calc.money.vatToman === 0 && (
            <p className="doc-note">
              مالیات بر ارزش افزوده: با توجه به معافیت محصولات کشاورزی فرآوری‌نشده (بند الف ماده ۹ قانون مالیات بر ارزش افزوده مصوب ۱۴۰۰)
              مبلغ مالیات صفر است. در صورت فرآوری محصول، نرخ مالیات را در تنظیمات معامله وارد کنید.
            </p>
          )}
        </section>
      )}

      {docType === "contract" && (
        <section className="doc-section">
          <h2>شرایط و تعهدات</h2>
          <ol className="doc-list doc-terms">
            <li>فروشنده متعهد است محصول را با مشخصات کیفی این قرارداد در محل و تاریخ توافق‌شده تحویل دهد.</li>
            <li>مبنای وزن، قبض باسکول معتبر و مبنای کیفیت، صورتجلسه نمونه‌برداری پیوست است.</li>
            <li>قیمت هر کیلوگرم {formatNumber(trade.pricePerKgToman)} تومان توافق شد؛ کسورات و هزینه‌های این قرارداد صریحاً مشخص است.</li>
            <li>خریدار متعهد است مانده مبلغ را حداکثر تا سررسید {trade.dueDate ? formatJalaliNumeric(trade.dueDate) : "توافق‌شده"} پرداخت کند.</li>
            <li>در صورت تأخیر، خسارت تأخیر روزانه {calc.money.delayPenaltyToman > 0 ? "مطابق جدول صورت مالی" : "مطابق توافق کتبی طرفین"} محاسبه می‌شود.</li>
            <li>هزینه‌های حمل/تخلیه بر اساس تعیین‌شده در فرم معامله بر عهده هر یک از طرفین است.</li>
            <li>هرگونه اختلاف ابتدا از طریق سازش و سپس در مرجع صالح قانونی رسیدگی می‌شود.</li>
            {trade.terms ? <li>{trade.terms}</li> : null}
            <li>این سند با امضای طرفین و در صورت نیاز شهود، نزد طرفین معتبر و لازم‌الاجراست.</li>
          </ol>
          <p className="doc-body-text">
            این قرارداد در تاریخ {formatJalaliNumeric(trade.contractDate)} بین طرفین منعقد شد و از تاریخ امضا لازم‌الاجراست. مستند به ماده ۱۰
            قانون مدنی، توافق‌های خصوصی طرفین در حدود قوانین برای آنان نافذ است.
          </p>
        </section>
      )}

      {docType === "settlement" && (
        <section className="doc-section">
          <h2>ریز دریافتی‌ها</h2>
          {payments.length === 0 ? (
            <p className="doc-note">دریافتی جدا از پیش‌پرداخت اولیه ({formatMoney(trade.prepaidToman)}) ثبت نشده است.</p>
          ) : (
            <table className="doc-table">
              <thead>
                <tr>
                  <th>تاریخ</th>
                  <th>روش</th>
                  <th>مرجع</th>
                  <th>مبلغ</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatJalaliNumeric(payment.paidAt)}</td>
                    <td>{{ cash: "نقدی", bank: "بانکی", cheque: "چک", deduction: "تهاتر" }[payment.method] ?? payment.method}</td>
                    <td>{[payment.reference, payment.note].filter(Boolean).join(" — ") || "—"}</td>
                    <td className="num">{formatMoney(payment.amountToman)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="doc-body-text">
            با توجه به صورتحساب فوق، مبلغ کل {formatMoney(trade.totalToman)} و مجموع دریافتی {formatMoney(paid || trade.prepaidToman)} است.
            مانده نهایی <b>{formatMoney(balance)}</b> ({formatMoneyWords(balance)}) اعلام می‌گردد و طرفین برای مبلغ باقیمانده تعهد به پرداخت
            در سررسید {trade.dueDate ? formatJalaliNumeric(trade.dueDate) : "توافق‌شده"} دارند. با تسویه کامل، این برگه رسید تسویه محسوب می‌شود.
          </p>
        </section>
      )}

      {docType === "weighing" && (
        <section className="doc-section">
          <h2>اظهار تحویل‌گیرنده</h2>
          <p className="doc-body-text">
            بار موضوع این قبض در تاریخ {trade.deliveryDate ? formatJalaliNumeric(trade.deliveryDate) : formatJalaliNumeric(trade.contractDate)} در
            محل {trade.deliveryPlace || "محل خریدار"} تحویل و وزن آن با باسکول مجاز اندازه‌گیری شد. وزن مندرج در این قبض در صورتجلسه کیفیت و
            فاکتور نیز ملاک است.
          </p>
        </section>
      )}

      <section className="doc-signatures">
        <div className="doc-sign">
          <span>فروشنده / صاحب محصول</span>
          <small>{trade.sellerName || "—"}</small>
          <span className="doc-sign-space">مهر و امضا</span>
        </div>
        <div className="doc-sign">
          <span>خریدار / نماینده کارخانه</span>
          <small>{trade.buyerName || "—"}</small>
          <span className="doc-sign-space">مهر و امضا</span>
        </div>
        <div className="doc-sign">
          <span>{docType === "weighing" ? "مسئول باسکول" : docType === "quality" ? "نمونه‌بردار / مسئول کیفیت" : "ناظر و شاهد"}</span>
          <small>تأیید نهایی</small>
          <span className="doc-sign-space">امضا</span>
        </div>
      </section>

      <footer className="doc-foot">
        <div className="doc-foot-qr">
          <div className="qr-svg" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <div>
            <strong>استعلام اصالت سند</strong>
            <span className="num">{verifyUrl}</span>
            <span>سریال {serial}</span>
          </div>
        </div>
        <div className="doc-foot-meta">
          <span>صادرشده با سامانه کشاورزحساب · موتور محاسبه {trade.engineVersion}</span>
          <span>این سند از پایگاه داده سامانه قابل بازیابی و چاپ مجدد است.</span>
          <span>تاریخ چاپ: {formatDate(issuedAt)} — ساعت {new Date(issuedAt).toLocaleTimeString("fa-IR")}</span>
        </div>
      </footer>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="doc-kv">
      <span>{label}</span>
      <b>{value}</b>
    </p>
  );
}

function QualityRow({ label, value, limit, ok }: { label: string; value: string; limit: string; ok: boolean }) {
  return (
    <tr>
      <td>{label}</td>
      <td className="num">{value}</td>
      <td>{limit}</td>
      <td className={ok ? "doc-ok" : "doc-bad"}>{ok ? "قبول" : "نیازمند بررسی"}</td>
    </tr>
  );
}

function buyerTypeLabel(value: string): string {
  return { factory: "کارخانه / کارگاه فرآوری", silo: "سیلو / مرکز خرید دولتی", coop: "تعاونی / اتحادیه", trader: "دلال / بازرگان", other: "سایر" }[value] ?? value;
}
