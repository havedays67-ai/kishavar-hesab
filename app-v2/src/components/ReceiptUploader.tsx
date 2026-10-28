import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, Download, FileText, Info, Trash2, Upload } from "lucide-react";
import { cn } from "../utils/cn";
import { formatJalali, todayJalali } from "../lib/format";
import { RECEIPT_NOTE } from "../lib/document-validity";
import { RECEIPT_SECTIONS, RECEIPT_ACCEPT, isReceiptSection, receiptSection, type ReceiptSectionId } from "../lib/receipt-sections";
import { addReceipt, loadReceipts, readReceiptFile, receiptsStats, removeReceipt, type StoredReceipt } from "../lib/receipts";

const money = (value: number) => `${Math.round(value).toLocaleString("fa-IR")} تومان`;
const bytes = (value: number) => (value > 1024 * 1024 ? `${(value / 1048576).toFixed(1)} مگابایت` : `${Math.max(1, Math.round(value / 1024))} کیلوبایت`);

export function ReceiptUploader({
  section = "other",
  showSection = false,
  compact = false,
}: {
  section?: ReceiptSectionId;
  showSection?: boolean;
  compact?: boolean;
}) {
  const [selected, setSelected] = useState<ReceiptSectionId>(section);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [rows, setRows] = useState<StoredReceipt[]>([]);

  const reload = () => setRows(loadReceipts());
  useEffect(() => {
    reload();
    setSelected(section);
  }, [section]);

  const shown = useMemo(() => (showSection ? rows : rows.filter((row) => row.section === selected)), [rows, showSection, selected]);
  const stats = useMemo(() => receiptsStats(rows), [rows]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setMessage({ tone: "error", text: "اول عکس یا PDF رسید را انتخاب کنید." });
      return;
    }
    if (title.trim().length < 2) {
      setMessage({ tone: "error", text: "عنوان رسید را بنویسید." });
      return;
    }
    setBusy(true);
    const read = await readReceiptFile(file);
    if (!read.ok || !read.dataUrl) {
      setBusy(false);
      setMessage({ tone: "error", text: read.error ?? "خواندن فایل ممکن نشد." });
      return;
    }
    const result = addReceipt({
      section: selected,
      title: title.trim().slice(0, 160),
      amount: amount.trim() ? Number(amount.replace(/[,٬\s]/g, "").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))) : null,
      date: todayJalali(),
      reference: reference.trim().slice(0, 100),
      note: note.trim().slice(0, 600),
      fileName: read.fileName ?? file.name,
      mimeType: read.mimeType ?? file.type,
      sizeBytes: read.sizeBytes ?? file.size,
      dataUrl: read.dataUrl,
    });
    setBusy(false);
    if (!result.ok) {
      setMessage({ tone: "error", text: result.error ?? "ذخیره ممکن نشد." });
      return;
    }
    setMessage({ tone: "ok", text: "رسید در حافظهٔ دستگاه ذخیره شد." });
    setTitle("");
    setAmount("");
    setReference("");
    setNote("");
    setFile(null);
    reload();
  };

  return (
    <div className="glass rounded-2xl p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-[11px] font-semibold text-[#e6f3eb]">
            <Camera className="h-3.5 w-3.5 text-mint-300" /> آپلود رسید و فیش
          </h2>
          <p className="mt-1 max-w-xl text-[9px] font-light leading-5 text-[#93ad9f]">{RECEIPT_NOTE}</p>
        </div>
        <span className="shrink-0 rounded border border-sand-300/25 bg-sand-300/[0.08] px-1.5 py-0.5 text-[8px] text-sand-300">یادداشت حمایتی</span>
      </div>

      <form onSubmit={submit} className="mt-3 space-y-2.5">
        <div className={cn("grid gap-2.5", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
          <input className="field text-[11px]" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="عنوان رسید: فیش واریز، قبض باسکول…" required />
          <input className="field text-[11px]" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="مبلغ (تومان، اختیاری)" inputMode="numeric" />
          <input className="field text-[11px]" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="شمارهٔ پیگیری / شمارهٔ قرارداد" />
          {showSection && (
            <select className="field text-[11px]" value={selected} onChange={(event) => setSelected(isReceiptSection(event.target.value) ? event.target.value : "other")}>
              {RECEIPT_SECTIONS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          )}
        </div>
        <textarea className="field min-h-14 text-[11px]" value={note} onChange={(event) => setNote(event.target.value)} placeholder="توضیح کوتاه: پرداخت بابت چه چیزی بود؟ نام پرداخت‌کننده و دریافت‌کننده" />
        <label className="block cursor-pointer rounded-xl border border-dashed border-[#375546] bg-white/[0.02] p-3 text-center text-[10px] text-[#a9c3b6] transition hover:border-mint-300/30">
          <input
            type="file"
            accept={RECEIPT_ACCEPT}
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              const next = event.target.files?.[0] ?? null;
              setFile(next);
              setMessage(null);
            }}
          />
          <Upload className="mx-auto mb-1 h-4 w-4 text-mint-300" />
          {file ? `${file.name} · ${bytes(file.size)}` : "انتخاب عکس رسید یا PDF (دوربین گوشی هم باز می‌شود)"}
        </label>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[8px] text-[#7b978a]">حداکثر ۶ مگابایت · عکس به‌صورت خودکار فشرده و آفلاین ذخیره می‌شود</span>
          <button type="submit" className="shrink-0 rounded-lg bg-mint-400 px-3 py-2 text-[10px] font-bold text-[#07110d] disabled:opacity-60" disabled={busy}>
            {busy ? "در حال ذخیره…" : "ذخیرهٔ رسید"}
          </button>
        </div>
        {message && (
          <p className={cn("flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[9px]", message.tone === "ok" ? "bg-mint-300/10 text-mint-300" : "bg-red-400/10 text-red-300")}>
            {message.tone === "ok" ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />} {message.text}
          </p>
        )}
      </form>

      <div className="mt-3 border-t border-white/[0.06] pt-2.5">
        <div className="mb-1.5 flex items-center justify-between text-[9px] text-[#8faa9d]">
          <span>رسیدهای ذخیره‌شده</span>
          <span>{shown.length.toLocaleString("fa-IR")} مورد · {bytes(stats.bytes)}</span>
        </div>
        {shown.length === 0 && <p className="rounded-lg bg-white/[0.03] px-2 py-1.5 text-[9px] text-[#8faa9d]">هنوز رسیدی ثبت نشده است.</p>}
        <ul className="space-y-1.5">
          {shown.slice(0, 30).map((row) => (
            <li key={row.id} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md bg-white/[0.05] text-mint-300">
                {row.mimeType.startsWith("image/") ? <img src={row.dataUrl} alt={row.title} className="h-full w-full object-cover" /> : <FileText className="h-3.5 w-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] text-[#e2f0e8]">{row.title}</p>
                <p className="truncate text-[8px] text-[#86a294]">
                  {receiptSection(row.section).label} · {formatJalali(row.date, "long")}
                  {row.amount !== null ? ` · ${money(row.amount)}` : ""}
                  {row.reference ? ` · پیگیری ${row.reference}` : ""}
                </p>
              </div>
              <a href={row.dataUrl} download={row.fileName} className="rounded-md border border-white/10 p-1.5 text-[#b8cec3] transition hover:text-white" aria-label="دانلود رسید">
                <Download className="h-3 w-3" />
              </a>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("این رسید حذف شود؟")) {
                    removeReceipt(row.id);
                    reload();
                  }
                }}
                className="rounded-md border border-white/10 p-1.5 text-red-300 transition hover:bg-red-400/10"
                aria-label="حذف رسید"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
        {!showSection && <p className="mt-2 flex items-start gap-1 text-[8px] leading-4 text-[#7b978a]"><Info className="mt-0.5 h-2.5 w-2.5 shrink-0" /> این بخش فقط رسیدهای همین صفحه را نشان می‌دهد؛ همهٔ رسیدها در «مرکز رسیدها» است.</p>}
      </div>
    </div>
  );
}
