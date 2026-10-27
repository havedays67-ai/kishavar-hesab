import Link from "next/link";
import { Card, Icon, PageHeader } from "@/components/ui";
import { runSelfTests, selfTestSummary } from "@/lib/trade/selftest";
import { TRADE_ENGINE_VERSION } from "@/lib/trade/engine";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function DiagnosticsPage() {
  const results = runSelfTests();
  const summary = selfTestSummary(results);
  let tables: string[] = [];
  let dbError = "";
  try {
    const rows = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    );
    tables = rows.rows.map((row) => row.table_name);
  } catch (error) {
    dbError = error instanceof Error ? error.message : "خطای پایگاه داده";
  }
  const required = ["crop_trades", "trade_payments", "trade_documents", "agri_contracts", "transactions"];
  const missing = required.filter((table) => !tables.includes(table));

  return (
    <div className="space-y-4">
      <PageHeader
        title="تست و عیب‌یابی"
        subtitle="آزمون‌های قطعی موتور محاسبه معامله، وضعیت پایگاه داده و نسخه موتور — بدون دخالت هوش مصنوعی."
        icon="alert"
        actions={
          <Link href="/api/self-test" className="btn" target="_blank">
            <Icon name="bolt" className="h-4 w-4" />
            خروجی JSON
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Card className="card-pad">
          <span className="text-[10px] text-[#7d8b80]">آزمون‌ها</span>
          <span className="num block text-xl font-extrabold text-farm-900">{summary.total}</span>
        </Card>
        <Card className="card-pad">
          <span className="text-[10px] text-[#7d8b80]">موفق</span>
          <span className="num block text-xl font-extrabold text-farm-700">{summary.passed}</span>
        </Card>
        <Card className="card-pad">
          <span className="text-[10px] text-[#7d8b80]">ناموفق</span>
          <span className={`num block text-xl font-extrabold ${summary.failed ? "text-red-700" : "text-farm-700"}`}>{summary.failed}</span>
        </Card>
        <Card className="card-pad">
          <span className="text-[10px] text-[#7d8b80]">نسخه موتور / پایگاه داده</span>
          <span className="block text-sm font-bold text-farm-900 num">{TRADE_ENGINE_VERSION}</span>
          <span className={`text-[10px] ${dbError || missing.length ? "text-red-700" : "text-farm-700"}`}>
            {dbError ? "خطای اتصال" : missing.length ? `جداول ناقص: ${missing.join(", ")}` : "سالم"}
          </span>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#eee9dc] px-4 py-3">
          <h2 className="section-title">آزمون‌های موتور معامله محصول</h2>
          <span className={`chip ${summary.ok ? "border-farm-200 text-farm-800" : "border-red-200 text-red-700"}`}>
            {summary.ok ? "همه آزمون‌ها موفق" : `${summary.failed} آزمون ناموفق`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>آزمون</th>
                <th>انتظار</th>
                <th>نتیجه واقعی</th>
                <th>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr key={result.id}>
                  <td className="text-[11px]">{result.title}</td>
                  <td className="num text-[10px] text-[#6a7a6d]">{result.expected}</td>
                  <td className="num text-[10px] text-[#6a7a6d]">{result.actual}</td>
                  <td>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${result.passed ? "bg-farm-50 text-farm-700" : "bg-red-50 text-red-700"}`}>
                      {result.passed ? "قبول" : "رد"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="card-pad">
        <h2 className="section-title">جداول پایگاه داده</h2>
        {dbError ? <p className="mt-1 text-[11px] text-red-700">{dbError}</p> : null}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tables.map((table) => (
            <span key={table} className={`chip ${required.includes(table) ? "border-farm-200 text-farm-800" : ""}`}>
              {table}
            </span>
          ))}
          {tables.length === 0 ? <span className="text-[11px] text-[#84907f]">جدولی یافت نشد.</span> : null}
        </div>
        {missing.length > 0 ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] leading-5 text-amber-900">
            برای ساخت جداول جدید دستور <code className="num">npx drizzle-kit push</code> را اجرا کنید.
          </p>
        ) : null}
      </Card>

      <Card className="card-pad bg-sand-50">
        <h2 className="section-title">چطور از درستی محاسبات مطمئن شویم؟</h2>
        <ul className="mt-2 space-y-1 text-[11px] leading-5 text-[#4a5a4c]">
          <li>• موتور محاسبه در فایل <code className="num">src/lib/trade/engine.ts</code> تابع خالص است و در فرم وب، سرور و آزمون‌ها یکی است.</li>
          <li>• هر مبلغ و وزن با مسیر مرحله‌به‌مرحله (ردّ حسابرسی) بازتولید می‌شود؛ هیچ عددی از سمت مرورگر به‌عنوان مبلغ نهایی پذیرفته نمی‌شود.</li>
          <li>• اجرای آزمون‌های خط فرمان: <code className="num">npx vitest run</code> و بررسی خودکار در GitHub Actions.</li>
          <li>• در صورت مغایرت با قبض باسکول، ابتدا وزن پر/خالی و کیفیت آزمایشگاه را کنترل کنید، نه مبلغ نهایی را.</li>
        </ul>
      </Card>
    </div>
  );
}
