"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import {
  MAX_RECEIPT_BYTES,
  RECEIPT_ACCEPT,
  formatBytes,
  validateReceiptFile,
  type ReceiptSectionId,
} from "@/lib/receipt-sections";

export type InlineReceipt = {
  id: number;
  section: string;
  title: string;
  amount: number | null;
  receiptDate: string | null;
  reference: string;
  note: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

const faDate = (value: string | null) => {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return "";
  }
};

/** فشرده‌سازی عکس‌های بزرگ پیش از ارسال (همان رفتار مرکز رسیدها). */
async function prepareUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 700 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
    if (!blob) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** دانلود واقعی: blob + نام فایل درست (به‌جای لینک inline که فایل را باز می‌کرد). */
async function downloadReceipt(row: InlineReceipt) {
  const res = await fetch(`/api/receipts/${row.id}?download=1`, { cache: "no-store" });
  if (!res.ok) throw new Error("دریافت فایل رسید انجام نشد");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const name = row.fileName?.trim() || `receipt-${row.id}`;
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function RecordReceipts({
  refType,
  refId,
  label = "رسید و تصویر",
  hint = "عکس رسید، فیش واریز، فاکتور یا چک را همین‌جا ضمیمه کنید.",
  section = "other",
  compact = false,
  defaultOpen = false,
}: {
  refType: string;
  refId: number;
  label?: string;
  hint?: string;
  section?: ReceiptSectionId;
  compact?: boolean;
  defaultOpen?: boolean;
}) {
  const [rows, setRows] = useState<InlineReceipt[]>([]);
  const [open, setOpen] = useState(defaultOpen);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [viewer, setViewer] = useState<InlineReceipt | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/receipts?refType=${encodeURIComponent(refType)}&refId=${refId}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { receipts?: InlineReceipt[] };
      setRows(data.receipts ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [refType, refId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const accepted: File[] = [];
    for (const file of Array.from(files)) {
      const check = validateReceiptFile({ name: file.name, type: file.type, size: file.size });
      if (!check.ok) {
        setMessage({ tone: "error", text: check.message });
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length) {
      setPending((prev) => [...prev, ...accepted].slice(0, 12));
      setMessage(null);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const upload = async () => {
    if (!pending.length) {
      setMessage({ tone: "error", text: "اول عکس یا PDF رسید را انتخاب کنید." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      let saved = 0;
      for (const file of pending) {
        const prepared = await prepareUpload(file);
        const form = new FormData();
        form.set("file", prepared);
        form.set("section", section);
        form.set("refType", refType);
        form.set("refId", String(refId));
        form.set("title", title.trim() || prepared.name.replace(/\.[^.]+$/, "") || label);
        const res = await fetch("/api/receipts", { method: "POST", body: form });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error || "آپلود رسید انجام نشد");
        saved += 1;
      }
      setPending([]);
      setTitle("");
      setMessage({ tone: "ok", text: `${saved} رسید ذخیره شد.` });
      await load();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "آپلود انجام نشد" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: InlineReceipt) => {
    if (!window.confirm(`رسید «${row.title}» حذف شود؟ این کار برگشت‌پذیر نیست.`)) return;
    try {
      const res = await fetch(`/api/receipts/${row.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("حذف انجام نشد");
      setRows((prev) => prev.filter((item) => item.id !== row.id));
      if (viewer?.id === row.id) setViewer(null);
      setMessage({ tone: "ok", text: "رسید حذف شد." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "حذف انجام نشد" });
    }
  };

  const download = async (row: InlineReceipt) => {
    try {
      await downloadReceipt(row);
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "دانلود انجام نشد" });
    }
  };

  return (
    <div className={compact ? "mt-2 border-t border-[#f0ecdf] pt-2" : "mt-3 rounded-xl border border-[#eee9dc] bg-sand-50/50 p-3"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex items-center gap-1.5 text-[11px] font-bold text-farm-800"
          aria-expanded={open}
        >
          <Icon name="receipt" className="h-3.5 w-3.5" />
          {label}
          <span className={`chip py-0 text-[10px] ${rows.length ? "border-farm-300 bg-white text-farm-800" : ""}`}>
            {loading ? "…" : `${rows.length} رسید`}
          </span>
          <Icon name={open ? "chevron-up" : "chevron-down"} className="h-3 w-3 opacity-70" />
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            window.setTimeout(() => inputRef.current?.click(), 60);
          }}
          className="btn btn-sm btn-ghost text-farm-800"
        >
          <Icon name="plus" className="h-3.5 w-3.5" />
          افزودن رسید
        </button>
      </div>

      {rows.length > 0 && (
        <ul className={`mt-2 ${compact ? "flex flex-wrap gap-1.5" : "grid gap-1.5 sm:grid-cols-2"}`}>
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-1.5 rounded-lg border border-[#e9e3d4] bg-white px-2 py-1 text-[10px]">
              <span className="min-w-0 flex-1 truncate font-semibold text-[#33463a]" title={row.title}>
                {row.title}
              </span>
              <button type="button" className="link-quiet shrink-0" onClick={() => setViewer(row)} title="مشاهده رسید">
                مشاهده
              </button>
              <button type="button" className="link-quiet shrink-0" onClick={() => void download(row)} title="دانلود فایل">
                دانلود
              </button>
              <button
                type="button"
                className="shrink-0 text-[#a33a1e]"
                onClick={() => void remove(row)}
                title="حذف رسید"
                aria-label={`حذف ${row.title}`}
              >
                <Icon name="trash" className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-2 space-y-2">
          <p className="text-[10px] leading-5 text-[#6a7a6d]">{hint}</p>
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              addFiles(event.dataTransfer?.files ?? null);
            }}
            className={`rounded-xl border-2 border-dashed p-3 text-center transition ${
              dragging ? "border-farm-500 bg-farm-50" : "border-farm-300 bg-white"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              name="receipts"
              accept={RECEIPT_ACCEPT}
              multiple
              className="hidden"
              onChange={(event) => addFiles(event.target.files)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center gap-1 rounded-lg px-2 py-1"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-farm-600 text-white">
                <Icon name="upload" className="h-4 w-4" />
              </span>
              <span className="text-[11px] font-bold text-farm-900">انتخاب یا کشیدن عکس رسید</span>
              <span className="text-[10px] text-[#6a7a6d]">
                چند فایل هم‌زمان مجاز است · عکس یا PDF تا {formatBytes(MAX_RECEIPT_BYTES)}
              </span>
            </button>
          </div>

          {pending.length > 0 && (
            <ul className="space-y-1">
              {pending.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1 text-[10px]">
                  <span className="truncate">{file.name}</span>
                  <span className="shrink-0 text-[#6a7a6d]">{formatBytes(file.size)}</span>
                  <button
                    type="button"
                    className="shrink-0 text-[#a33a1e]"
                    onClick={() => setPending((prev) => prev.filter((_, i) => i !== index))}
                    aria-label="حذف از صف آپلود"
                  >
                    <Icon name="trash" className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input h-8 flex-1 text-[11px]"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="عنوان این رسید (اختیاری) — مثلاً رسید دریافت از مهدی"
              maxLength={180}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void upload()} disabled={busy || !pending.length}>
              <Icon name="check" className="h-3.5 w-3.5" />
              {busy ? "در حال ذخیره…" : `ذخیره ${pending.length > 1 ? `${pending.length} رسید` : "رسید"}`}
            </button>
          </div>

          {message && (
            <p
              role="status"
              className={`rounded-lg px-2 py-1 text-[10px] ${
                message.tone === "ok" ? "bg-farm-50 text-farm-800" : "bg-[#fdf1ee] text-[#a33a1e]"
              }`}
            >
              {message.text}
            </p>
          )}
        </div>
      )}

      {viewer && (
        <div className="no-print fixed inset-0 z-[80] flex items-center justify-center p-3" role="dialog" aria-modal="true">
          <button type="button" aria-label="بستن" className="absolute inset-0 bg-[#0d1a12]/60 backdrop-blur-sm" onClick={() => setViewer(null)} />
          <div className="relative flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eee9dc] p-2.5">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-[#26382c]">{viewer.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-[#6a7a6d]">
                  <span>{faDate(viewer.createdAt)}</span>
                  <span>{formatBytes(viewer.sizeBytes)}</span>
                  {viewer.reference ? <span>پیگیری: {viewer.reference}</span> : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => void download(viewer)}>
                  <Icon name="download" className="h-3.5 w-3.5" /> دانلود
                </button>
                <a className="btn btn-sm btn-ghost" href={`/api/receipts/${viewer.id}`} target="_blank" rel="noreferrer">
                  تبوی جدید
                </a>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setViewer(null)}>
                  بستن
                </button>
              </div>
            </div>
            <div className="min-h-[40dvh] flex-1 overflow-auto bg-[#f5f3ee] p-2">
              {viewer.mimeType === "application/pdf" ? (
                <iframe title={viewer.title} src={`/api/receipts/${viewer.id}`} className="h-[70dvh] w-full rounded-lg bg-white" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/receipts/${viewer.id}`}
                  alt={viewer.title}
                  className="mx-auto max-h-[76dvh] w-auto rounded-lg bg-white object-contain shadow-sm"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * آپلود تصویر داخل فرم‌های ثبت رکورد (چند فایل، ظاهر بزرگ و حرفه‌ای).
 * فایل‌ها با نام `receipts` ارسال می‌شوند و Server Action آن‌ها را به رکورد
 * تازه پیوند می‌زند؛ بنابراین رسید از همان لحظهٔ ثبت کنار رکورد است.
 */
export function ReceiptField({
  label = "آپلود تصویر رسید",
  hint = "عکس رسید، فیش، فاکتور یا چک — چند فایل مجاز است.",
  name = "receipts",
}: {
  label?: string;
  hint?: string;
  name?: string;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (list: FileList | null) => {
    if (!list?.length) return;
    const accepted: File[] = [];
    for (const file of Array.from(list)) {
      const check = validateReceiptFile({ name: file.name, type: file.type, size: file.size });
      if (!check.ok) {
        setError(check.message);
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length) {
      setError("");
      setFiles((prev) => {
        const next = [...prev, ...accepted].slice(0, 6);
        // سقف کل فرم (ارسال با Server Action) تا آپلود نیمه‌کاره نشود.
        const total = next.reduce((sum, file) => sum + file.size, 0);
        if (total > 18 * 1024 * 1024) {
          setError("مجموع فایل‌ها بیش از ۱۸ مگابایت است؛ چند رسید را در مرحلهٔ بعد اضافه کنید.");
          return prev;
        }
        return next;
      });
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="sm:col-span-2">
      <span className="label">{label}</span>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          add(event.dataTransfer?.files ?? null);
        }}
        className={`rounded-2xl border-2 border-dashed p-3 transition ${dragging ? "border-farm-500 bg-farm-50" : "border-farm-300 bg-white"}`}
      >
        {/* ورودی واقعی فرم؛ فایل‌ها با name ارسال می‌شوند */}
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept={RECEIPT_ACCEPT}
          multiple
          className="hidden"
          onChange={(event) => add(event.target.files)}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center gap-3 rounded-xl px-1 py-1 text-right"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-farm-600 text-white shadow-sm">
            <Icon name="upload" className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-bold text-farm-900">انتخاب تصویر رسید (چند فایل)</span>
            <span className="mt-0.5 block text-[10px] leading-5 text-[#6a7a6d]">{hint}</span>
          </span>
        </button>
        {files.length > 0 && (
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-lg bg-sand-50 px-2 py-1 text-[10px]">
                <span className="truncate">{file.name}</span>
                <span className="shrink-0 text-[#6a7a6d]">{formatBytes(file.size)}</span>
                <button
                  type="button"
                  className="shrink-0 text-[#a33a1e]"
                  onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                  aria-label="حذف فایل"
                >
                  <Icon name="trash" className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error ? <p className="mt-1 text-[10px] text-[#a33a1e]">{error}</p> : null}
      <p className="mt-1 text-[10px] leading-5 text-[#7a8a7d]">
        رسیدها «یادداشت حمایتی» هستند و جای سند رسمی، ثبت صیاد یا فاکتور مؤدیان را نمی‌گیرند.
      </p>
    </div>
  );
}
