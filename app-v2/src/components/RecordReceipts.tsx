import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  ImagePlus,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "../utils/cn";
import { formatJalali, todayJalali, toPersianDigits } from "../lib/format";
import {
  MAX_RECEIPT_BYTES,
  RECEIPT_ACCEPT,
  RECEIPT_PRIVACY_NOTE,
  formatBytes,
  receiptSection,
  type ReceiptSectionId,
} from "../lib/receipt-sections";
import {
  addReceipt,
  loadRecordReceipts,
  readReceiptFile,
  removeReceipt,
  RECEIPTS_CHANGED_EVENT,
  type StoredReceipt,
} from "../lib/receipts";
import { downloadReceiptFile, openReceiptExternally, receiptFileName, receiptIsPdf } from "../lib/receipt-download";
import { formatTomanAmount, parseAmountInput } from "../lib/money-format";

const money = (value: number) => formatTomanAmount(value);
const SYNC_EVENT = RECEIPTS_CHANGED_EVENT;

function notifyChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SYNC_EVENT));
}

/**
 * بعد از بستن دوربین/انتخاب فایل، فوکوس روی input مخفی در بعضی WebViewها
 * می‌ماند و مرورگر برای دیدن فیلد کوچک، صفحه را زوم می‌کند. فوکوس را آزاد
 * می‌کنیم؛ ظاهر هیچ بخشی تغییر نمی‌کند.
 */
function releaseFilePickerFocus() {
  if (typeof document === "undefined") return;
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
}

/**
 * رسیدهای همین رکورد — درست زیر مشخصاتی که کاربر نوشته است.
 * ------------------------------------------------------------------
 * • بدون سقف یک‌رسیدی: هر رکورد چند رسید می‌گیرد.
 * • دکمهٔ بزرگ و واضح «افزودن تصویر رسید» + دوربین گوشی.
 * • برای هر رسید: مشاهده (نمایش تصویر در پنجرهٔ داخلی)، دانلود و حذف.
 * • فایل‌ها آفلاین روی دستگاه می‌مانند و در بستهٔ پشتیبان هم می‌آیند.
 */
export function RecordReceipts({
  refType,
  refId,
  section,
  label = "رسیدهای این رکورد",
  hint,
  compact = false,
}: {
  refType: string;
  refId: string;
  section: ReceiptSectionId;
  label?: string;
  hint?: string;
  compact?: boolean;
}) {
  const [rows, setRows] = useState<StoredReceipt[]>([]);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [viewing, setViewing] = useState<StoredReceipt | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => setRows(loadRecordReceipts(refType, refId)), [refType, refId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const onSync = () => reload();
    window.addEventListener(SYNC_EVENT, onSync);
    window.addEventListener("storage", onSync);
    return () => {
      window.removeEventListener(SYNC_EVENT, onSync);
      window.removeEventListener("storage", onSync);
    };
  }, [reload]);

  // پنجرهٔ رسید پیش‌تر داخل کارتِ صفحه رندر می‌شد و backdrop-filter پدر،
  // fixed را به همان کارت محدود می‌کرد؛ نتیجه «به‌هم‌ریختن و بزرگ‌شدن کل برنامه».
  // اکنون در body پورتال می‌شود و اسکرول پس‌زمینه هم قفل/بازگردانی می‌شود.
  useEffect(() => {
    if (!viewing) return;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbar = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewing(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      window.removeEventListener("keydown", onKey);
    };
  }, [viewing]);

  const totals = useMemo(
    () => ({
      count: rows.length,
      amount: rows.reduce((sum, row) => sum + (row.amount ?? 0), 0),
      bytes: rows.reduce((sum, row) => sum + row.sizeBytes, 0),
    }),
    [rows]
  );

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      if (file.size > MAX_RECEIPT_BYTES) {
        setMessage({ tone: "error", text: `«${file.name}» بزرگ‌تر از ${formatBytes(MAX_RECEIPT_BYTES)} است.` });
        continue;
      }
      if (next.some((item) => item.name === file.name && item.size === file.size)) continue;
      next.push(file);
    }
    setFiles(next.slice(0, 12));
    setMessage(null);
    releaseFilePickerFocus();
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!files.length) {
      setMessage({ tone: "error", text: "اول عکس یا PDF رسید را انتخاب کنید." });
      return;
    }
    setBusy(true);
    let saved = 0;
    let lastError = "";
    for (const file of files) {
      const read = await readReceiptFile(file);
      if (!read.ok || !read.dataUrl) {
        lastError = read.error ?? "خواندن فایل ممکن نشد.";
        continue;
      }
      const receiptTitle =
        title.trim() || (files.length === 1 ? label : file.name.replace(/\.[^.]+$/, "")) || "رسید";
      const result = addReceipt({
        refType,
        refId,
        section,
        title: receiptTitle.slice(0, 160),
        amount: parseAmountInput(amount),
        date: todayJalali(),
        reference: reference.trim().slice(0, 80),
        note: note.trim().slice(0, 500),
        fileName: read.fileName ?? file.name,
        mimeType: read.mimeType ?? file.type ?? "image/jpeg",
        sizeBytes: read.sizeBytes ?? file.size,
        dataUrl: read.dataUrl,
        thumbnailDataUrl: read.thumbnailDataUrl,
      });
      if (result.ok) saved += 1;
      else lastError = result.error ?? "ذخیرهٔ رسید ممکن نشد.";
    }
    setBusy(false);
    setFiles([]);
    setTitle("");
    setAmount("");
    setReference("");
    setNote("");
    if (inputRef.current) inputRef.current.value = "";
    reload();
    notifyChange();
    if (saved > 0) {
      setMessage({
        tone: "ok",
        text: `${toPersianDigits(saved)} رسید برای این رکورد ثبت شد${lastError ? ` (${lastError})` : ""}.`,
      });
      if (saved === 1) setOpen(true);
    } else {
      setMessage({ tone: "error", text: lastError || "ذخیرهٔ رسید ممکن نشد." });
    }
  };

  const remove = (row: StoredReceipt) => {
    if (!window.confirm(`رسید «${row.title}» حذف شود؟ این کار برگشت‌پذیر نیست.`)) return;
    const result = removeReceipt(row.id);
    reload();
    notifyChange();
    setViewing(null);
    setMessage(
      result.ok
        ? { tone: "ok", text: "رسید حذف شد." }
        : { tone: "error", text: result.error ?? "حذف رسید ممکن نشد." }
    );
  };

  const download = async (row: StoredReceipt) => {
    const result = await downloadReceiptFile(row);
    setMessage({ tone: result.ok ? "ok" : "error", text: result.message });
  };

  return (
    <div
      className={cn(
        "no-print rounded-2xl border border-white/[0.07] bg-white/[0.022]",
        compact ? "p-2.5" : "p-3.5"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen((value) => !value)} className="flex items-center gap-2 text-right">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-mint-300/10 text-mint-300">
            <Camera className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-[10px] font-semibold text-[#e4f1e9]">{label}</span>
            <span className="block text-[8px] text-[#84a294]">
              {totals.count > 0
                ? `${toPersianDigits(totals.count)} رسید · ${totals.amount > 0 ? money(totals.amount) : formatBytes(totals.bytes)}`
                : "هنوز رسیدی ضمیمه نشده است"}
            </span>
          </span>
        </button>
        <div className="flex items-center gap-1.5">
          {totals.count > 0 && (
            <span className="rounded-md border border-mint-300/20 bg-mint-300/[0.08] px-1.5 py-0.5 text-[8px] text-mint-300">
              {toPersianDigits(totals.count)} فایل
            </span>
          )}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[8px] text-[#b8cec3] transition hover:border-mint-300/30 hover:text-white"
          >
            {open ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />} {open ? "بستن" : "افزودن رسید"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-2.5 space-y-2.5">
          <form onSubmit={submit} className="space-y-2">
            <label
              className={cn(
                "group block cursor-pointer rounded-xl border-2 border-dashed border-mint-300/25 bg-gradient-to-br from-[#16301f]/70 to-[#0a1712]/70 text-center transition hover:border-mint-300/50 hover:from-[#1a3a26]/80",
                compact ? "p-3" : "p-4"
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept={RECEIPT_ACCEPT}
                multiple
                className="sr-only"
                onChange={(event) => addFiles(event.target.files)}
              />
              <span className="mx-auto mb-1.5 grid h-10 w-10 place-items-center rounded-full bg-mint-300/12 text-mint-300 transition group-hover:bg-mint-300/20">
                <ImagePlus className="h-5 w-5" />
              </span>
              <span className={cn("block font-bold text-mint-200", compact ? "text-[10px]" : "text-[11px]")}>
                افزودن تصویر رسید
              </span>
              <span className="mt-0.5 block text-[8px] leading-4 text-[#8fae9d]">
                عکس یا PDF · چند فایل هم‌زمان · تا {formatBytes(MAX_RECEIPT_BYTES)} برای هر فایل
              </span>
            </label>

            {files.length > 0 && (
              <ul className="space-y-1">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${file.size}-${index}`}
                    className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.025] px-2 py-1.5 text-[9px] text-[#cfe3d8]"
                  >
                    <FileText className="h-3 w-3 shrink-0 text-mint-300" />
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <span className="shrink-0 text-[8px] text-[#7f9b8e]">{formatBytes(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => setFiles(files.filter((_, position) => position !== index))}
                      className="rounded p-0.5 text-red-300 hover:bg-red-400/10"
                      aria-label={`حذف ${file.name} از فهرست`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid grid-cols-1 gap-1.5">
              <input
                className="field py-1.5 text-[10px]"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="شمارهٔ پیگیری (اختیاری)"
              />
              <input
                className="field py-1.5 text-[10px]"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="توضیح کوتاه: پرداخت بابت چه چیزی و به چه کسی؟"
              />
              <p className="text-[7.5px] leading-4 text-[#78968a]">عنوان و مبلغ رسید لازم نیست؛ همان مبلغ و دلیل پرداخت در دفتر ثبت شده است.</p>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[7.5px] leading-4 text-[#78968a]">{RECEIPT_PRIVACY_NOTE}</span>
              <button
                type="submit"
                disabled={busy || files.length === 0}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-mint-400 px-3 py-2 text-[10px] font-bold text-[#07110d] disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                {busy ? "در حال ذخیره…" : files.length > 1 ? `ثبت ${toPersianDigits(files.length)} رسید` : "ثبت رسید"}
              </button>
            </div>
          </form>

          {message && (
            <p
              className={cn(
                "flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-[9px] leading-4",
                message.tone === "ok" ? "bg-mint-300/10 text-mint-300" : "bg-red-400/10 text-red-300"
              )}
              role="status"
            >
              {message.tone === "ok" ? (
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              )}
              {message.text}
            </p>
          )}

          <div className="border-t border-white/[0.06] pt-2">
            <div className="mb-1.5 flex items-center justify-between text-[8px] text-[#8faa9d]">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-mint-300" /> بایگانی رسیدهای همین رکورد
              </span>
              <span>{toPersianDigits(totals.count)} مورد</span>
            </div>
            {rows.length === 0 ? (
              <p className="rounded-lg bg-white/[0.03] px-2 py-2 text-[9px] leading-4 text-[#8faa9d]">
                رسید ثبت‌شده‌ای برای این رکورد نیست. {hint ?? "عکس فیش، قبض یا اسکن سند را همین‌جا ضمیمه کنید."}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] p-2"
                  >
                    <button
                      type="button"
                      onClick={() => setViewing(row)}
                      className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.05] text-mint-300"
                      aria-label={`مشاهدهٔ ${row.title}`}
                    >
                      {row.mimeType.startsWith("image/") ? (
                        <img
                          src={row.thumbnailDataUrl ?? row.dataUrl}
                          alt={row.title}
                          className="h-full w-full object-cover"
                          width={40}
                          height={40}
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                        />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] text-[#e4f1e9]">{row.title}</p>
                      <p className="truncate text-[8px] text-[#86a294]">
                        {receiptSection(row.section).label} · {formatJalali(row.date, "long")}
                        {row.amount !== null ? ` · ${money(row.amount)}` : ""}
                        {row.reference ? ` · پیگیری ${row.reference}` : ""}
                      </p>
                      <p className="truncate text-[7.5px] text-[#6f8c7f]">{receiptFileName(row)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setViewing(row)}
                        className="flex items-center gap-0.5 rounded-md border border-mint-300/25 bg-mint-300/[0.07] px-1.5 py-1 text-[8px] text-mint-300 transition hover:bg-mint-300/[0.14]"
                      >
                        <Eye className="h-3 w-3" /> مشاهده
                      </button>
                      <button
                        type="button"
                        onClick={() => download(row)}
                        className="rounded-md border border-white/10 p-1.5 text-[#b8cec3] transition hover:text-white"
                        aria-label={`دانلود ${row.title}`}
                        title="دانلود"
                      >
                        <Download className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(row)}
                        className="rounded-md border border-white/10 p-1.5 text-red-300 transition hover:bg-red-400/10"
                        aria-label={`حذف ${row.title}`}
                        title="حذف"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {viewing &&
        createPortal(
          <div className="fixed inset-0 z-[95] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={viewing.title}>
          <button
            type="button"
            className="absolute inset-0 bg-[#020806]/85 backdrop-blur-sm"
            onClick={() => setViewing(null)}
            aria-label="بستن پنجرهٔ رسید"
          />
          <div className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#0a1712] shadow-2xl sm:max-w-2xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-2 border-b border-white/[0.07] p-3">
              <div className="min-w-0">
                <h3 className="truncate text-[11px] font-semibold text-white">مشاهدهٔ رسید — {viewing.title}</h3>
                <p className="mt-0.5 truncate text-[8px] text-[#8faa9d]">
                  {receiptSection(viewing.section).label} · {formatJalali(viewing.date, "long")}
                  {viewing.amount !== null ? ` · ${money(viewing.amount)}` : ""}
                  {viewing.reference ? ` · پیگیری ${viewing.reference}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewing(null)}
                className="shrink-0 rounded-lg border border-white/10 p-1.5 text-[#9fb6aa] transition hover:text-white"
                aria-label="بستن"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-black/30 p-2.5">
              {receiptIsPdf(viewing) ? (
                <div className="space-y-2">
                  <object data={viewing.dataUrl} type="application/pdf" className="h-[55dvh] w-full rounded-lg bg-white">
                    <p className="p-4 text-center text-[10px] text-[#0a1712]">
                      پیش‌نمایش PDF در این دستگاه پشتیبانی نمی‌شود؛ از دکمهٔ دانلود استفاده کنید.
                    </p>
                  </object>
                  <button
                    type="button"
                    onClick={async () => {
                      const opened = await openReceiptExternally(viewing);
                      if (!opened) await download(viewing);
                    }}
                    className="w-full rounded-lg border border-mint-300/25 bg-mint-300/[0.08] py-2 text-[10px] font-bold text-mint-300 sm:hidden"
                  >
                    بازکردن PDF با برنامهٔ دستگاه
                  </button>
                </div>
              ) : (
                <img
                  src={viewing.dataUrl}
                  alt={viewing.title}
                  className="mx-auto max-h-[62dvh] w-auto max-w-full rounded-lg object-contain"
                  loading="eager"
                  decoding="async"
                  draggable={false}
                />
              )}
              {viewing.note && (
                <p className="mt-2 rounded-lg bg-white/[0.04] p-2 text-[9px] leading-5 text-[#b8cec3]">{viewing.note}</p>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] p-2.5">
              <span className="truncate text-[8px] text-[#7f9b8e]">{receiptFileName(viewing)}</span>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => remove(viewing)}
                  className="flex items-center gap-1 rounded-lg border border-red-400/25 bg-red-400/[0.08] px-2.5 py-2 text-[9px] text-red-300"
                >
                  <Trash2 className="h-3 w-3" /> حذف
                </button>
                <button
                  type="button"
                  onClick={() => download(viewing)}
                  className="flex items-center gap-1 rounded-lg bg-mint-400 px-3 py-2 text-[9px] font-bold text-[#07110d]"
                >
                  <Download className="h-3 w-3" /> دانلود
                </button>
              </div>
            </div>
            {message && (
              <p className={cn("border-t border-white/[0.07] px-3 py-1.5 text-[8px]", message.tone === "ok" ? "text-mint-300" : "text-red-300")}>
                {message.text}
              </p>
            )}
          </div>
        </div>,
          document.body
        )}
    </div>
  );
}
