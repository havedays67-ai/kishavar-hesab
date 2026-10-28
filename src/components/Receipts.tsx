"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/ui";
import {
  MAX_RECEIPT_BYTES,
  RECEIPT_ACCEPT,
  RECEIPT_PRIVACY_NOTE,
  RECEIPT_SECTIONS,
  formatBytes,
  isReceiptSection,
  receiptSection,
  validateReceiptFile,
  type ReceiptSectionId,
} from "@/lib/receipt-sections";

export type ReceiptRow = {
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
const faMoney = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return "";
  try {
    return new Intl.NumberFormat("fa-IR").format(Math.round(value)) + " تومان";
  } catch {
    return String(value);
  }
};

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

function sectionFromPath(pathname: string): ReceiptSectionId {
  const first = `/${(pathname || "/").split("/")[1] ?? ""}`;
  const map: Record<string, ReceiptSectionId> = {
    "/trade": "trade",
    "/contracts": "contracts",
    "/finance": "finance",
    "/transactions": "finance",
    "/inventory": "inventory",
    "/lands": "crops",
    "/crops": "crops",
    "/labor": "finance",
    "/equipment": "inventory",
    "/documents": "documents",
    "/receipts": "other",
  };
  return map[first] ?? "other";
}

function ReceiptForm({
  section,
  showSection,
  onDone,
  compact,
}: {
  section: ReceiptSectionId;
  showSection: boolean;
  onDone: () => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<ReceiptSectionId>(section);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => setSelected(section), [section]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setMessage({ tone: "error", text: "اول عکس یا PDF رسید را انتخاب کنید." });
      return;
    }
    const check = validateReceiptFile({ name: file.name, type: file.type, size: file.size });
    if (!check.ok) {
      setMessage({ tone: "error", text: check.message });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const prepared = await prepareUpload(file);
      const form = new FormData();
      form.set("file", prepared);
      form.set("section", selected);
      form.set("title", title);
      form.set("amount", amount);
      form.set("reference", reference);
      form.set("note", note);
      const res = await fetch("/api/receipts", { method: "POST", body: form });
      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "آپلود انجام نشد");
      setMessage({ tone: "ok", text: data.message || "رسید ذخیره شد." });
      setTitle("");
      setAmount("");
      setReference("");
      setNote("");
      setFile(null);
      const input = document.getElementById("receipt-file-input") as HTMLInputElement | null;
      if (input) input.value = "";
      router.refresh();
      onDone();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "آپلود انجام نشد" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className={compact ? "grid gap-3" : "grid gap-3 sm:grid-cols-2"}>
        <label className="block">
          <span className="label">عنوان رسید *</span>
          <input
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="مثلاً فیش واریز خریدار - قبض باسکول"
            required
            maxLength={180}
          />
        </label>
        <label className="block">
          <span className="label">مبلغ (تومان، اختیاری)</span>
          <input
            className="input num"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="numeric"
            placeholder="۱۲۵۰۰۰۰۰"
          />
        </label>
        <label className="block">
          <span className="label">شمارهٔ پیگیری / شمارهٔ قرارداد</span>
          <input
            className="input"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="مثلاً ۱۴۰۴-۸۸۲۳۱ یا قرارداد ۱۲"
            maxLength={120}
          />
        </label>
        {showSection && (
          <label className="block">
            <span className="label">این رسید مربوط به کدام بخش است؟</span>
            <select
              className="input"
              value={selected}
              onChange={(event) => setSelected(isReceiptSection(event.target.value) ? event.target.value : "other")}
            >
              {RECEIPT_SECTIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <label className="block">
        <span className="label">توضیح کوتاه</span>
        <textarea
          className="input min-h-16"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={1200}
          placeholder="پرداخت بابت کدام محموله/قرارداد بود؟ نام پرداخت‌کننده و دریافت‌کننده را هم بنویسید."
        />
      </label>

      <div className="rounded-xl border border-dashed border-farm-300 bg-farm-50/60 p-3">
        <input
          id="receipt-file-input"
          type="file"
          accept={RECEIPT_ACCEPT}
          onChange={(event) => {
            const next = event.target.files?.[0] ?? null;
            if (!next) {
              setFile(null);
              return;
            }
            const check = validateReceiptFile({ name: next.name, type: next.type, size: next.size });
            if (!check.ok) {
              setMessage({ tone: "error", text: check.message });
              setFile(null);
              return;
            }
            setFile(next);
            setMessage(null);
          }}
          className="block w-full cursor-pointer text-xs text-[#3f5245] file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-farm-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#5b6a5e]">
          <span className="chip">عکس یا PDF</span>
          <span>حداکثر {formatBytes(MAX_RECEIPT_BYTES)}</span>
          {file && (
            <span className="chip border-farm-300 bg-white text-farm-800">
              {file.name} · {formatBytes(file.size)}
            </span>
          )}
        </div>
        <p className="mt-2 text-[10px] leading-5 text-[#6a7a6d]">
          عکس رسید با دوربین موبایل هم قابل انتخاب است. فایل‌های بزرگ‌تر از ۷۰۰ کیلوبایت پیش از ارسال فشرده می‌شوند.
        </p>
      </div>

      {message && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-xs ${
            message.tone === "ok" ? "bg-farm-50 text-farm-800" : "bg-[#fdf1ee] text-[#a33a1e]"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] leading-5 text-[#6a7a6d]">{RECEIPT_PRIVACY_NOTE}</span>
        <button type="submit" className="btn btn-primary btn-sm shrink-0" disabled={busy}>
          <Icon name="check" className="h-4 w-4" />
          {busy ? "در حال آپلود…" : "ذخیرهٔ رسید"}
        </button>
      </div>
    </form>
  );
}

export function ReceiptUploader({
  section = "other",
  showSection = false,
  heading = "آپلود رسید و فیش",
  subtitle = "فیش واریز، قبض باسکول، رسید دریافت پول یا عکس فاکتور را همین‌جا نگه دارید.",
}: {
  section?: ReceiptSectionId;
  showSection?: boolean;
  heading?: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/receipts${showSection ? "" : `?section=${section}`}`, { cache: "no-store" });
      const data = (await res.json()) as { receipts?: ReceiptRow[] };
      setRows(data.receipts ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [section, showSection]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (id: number) => {
    if (!window.confirm("این رسید حذف شود؟ (فقط از همین دستگاه/سرور)")) return;
    await fetch(`/api/receipts/${id}`, { method: "DELETE" });
    await load();
    router.refresh();
  };

  return (
    <article className="card card-pad">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-farm-900">
            <Icon name="receipt" className="h-4 w-4 text-farm-700" />
            {heading}
          </h2>
          <p className="mt-1 max-w-2xl text-[11px] leading-6 text-[#5b6a5e]">{subtitle}</p>
        </div>
        <span className="chip border-sand-300 bg-sand-50 text-[#7a6533]">یادداشت حمایتی</span>
      </div>

      <div className="mt-3">
        <ReceiptForm section={section} showSection={showSection} onDone={() => void load()} />
      </div>

      <div className="mt-4 border-t border-[#eee9dc] pt-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#33463a]">
            رسیدهای ذخیره‌شده {showSection ? "در همهٔ بخش‌ها" : `در ${receiptSection(section).label}`}
          </h3>
          <span className="text-[10px] text-[#7a8a7d]">{rows.length} مورد</span>
        </div>
        {loading && <p className="text-[11px] text-[#7a8a7d]">در حال خواندن…</p>}
        {!loading && rows.length === 0 && (
          <p className="rounded-lg bg-sand-50 px-3 py-2 text-[11px] text-[#6a7a6d]">
            هنوز رسیدی آپلود نشده است. اولین فیش را بالا اضافه کنید.
          </p>
        )}
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-xl border border-[#eee9dc] bg-white p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[#26382c]">{row.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[#6a7a6d]">
                    <span className="chip py-0">{receiptSection(row.section).label}</span>
                    {row.receiptDate && <span>{faDate(row.receiptDate)}</span>}
                    <span>{faDate(row.createdAt)}</span>
                    {row.amount !== null && <span className="num">{faMoney(row.amount)}</span>}
                    {row.reference && <span>پیگیری: {row.reference}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <a className="btn btn-sm btn-ghost" href={`/api/receipts/${row.id}`} target="_blank" rel="noreferrer">
                    مشاهده
                  </a>
                  <button type="button" className="btn btn-sm btn-ghost text-[#a33a1e]" onClick={() => void remove(row.id)}>
                    <Icon name="trash" className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {row.note && <p className="mt-1 text-[10px] leading-5 text-[#6a7a6d]">{row.note}</p>}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export function ReceiptQuickAction() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const section = sectionFromPath(pathname ?? "/");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="no-print fixed bottom-20 left-4 z-40 flex items-center gap-2 rounded-full bg-farm-700 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-farm-900/25 transition hover:bg-farm-800 lg:bottom-6"
        aria-label="آپلود رسید"
      >
        <Icon name="receipt" className="h-4 w-4" />
        آپلود رسید
      </button>
      {open && (
        <div className="no-print fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="بستن"
            className="absolute inset-0 bg-[#0d1a12]/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:max-w-2xl sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-farm-900">
                آپلود رسید برای «{receiptSection(section).label}»
              </h2>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setOpen(false)}>
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-[11px] text-[#5b6a5e]">{receiptSection(section).hint}</p>
            <ReceiptForm
              section={section}
              showSection
              compact
              onDone={() => {
                setOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
