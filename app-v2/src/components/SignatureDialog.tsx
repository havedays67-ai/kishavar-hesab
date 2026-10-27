import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  Fingerprint,
  Link2,
  PenLine,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "../utils/cn";
import { useProfile } from "../lib/profile";
import { useSignatures } from "../lib/signatureContext";
import { checkBiometric, verifyBiometric, type BiometricAvailability, type BiometricResult } from "../lib/biometric";
import { formatJalali, toPersianDigits } from "../lib/format";
import { signatureTierExplanation, shortHash, type SignableEntity, type SignatureRoleRequirement } from "../lib/signatures";
import { TextField } from "./FormControls";
import { Toast } from "./ui";

function DrawPad({ onSave, disabled }: { onSave: (data: string) => void; disabled?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);
  const pos = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = ref.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * canvas.width, y: ((event.clientY - rect.top) / rect.height) * canvas.height };
  };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const point = pos(event);
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const point = pos(event);
    ctx.lineTo(point.x, point.y);
    ctx.strokeStyle = "#132b21";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.stroke();
    setEmpty(false);
  };
  const clear = () => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#fbfaf4";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
  };
  return (
    <div>
      <div className="label">امضای دستی روی کادر <span className="text-[#c9967e]">*</span></div>
      <div className="rounded-xl border border-white/[0.1] bg-[#fbfaf4] p-1">
        <canvas ref={ref} width={640} height={180} onPointerDown={start} onPointerMove={move} onPointerUp={() => { drawing.current = false; }} onPointerLeave={() => { drawing.current = false; }} className="h-[140px] w-full touch-none rounded-lg" aria-label="کادر امضای دستی" />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={clear} className="rounded-lg border border-white/[0.09] px-2.5 py-2 text-[9px] text-[#a8bfb3]">پاک کردن کادر</button>
        <button type="button" disabled={empty || disabled} onClick={() => { const data = ref.current?.toDataURL("image/png") ?? ""; if (data) onSave(data); }} className="flex items-center gap-1.5 rounded-lg bg-mint-400 px-3 py-2 text-[9px] font-bold text-[#07110d] disabled:opacity-40"><PenLine className="h-3.5 w-3.5" /> ثبت امضای دستی</button>
      </div>
    </div>
  );
}

export function SignatureDialog({ entity, open, onClose }: { entity: SignableEntity | null; open: boolean; onClose: () => void }) {
  const { profile } = useProfile();
  const { sign, remove, audit } = useSignatures();
  const [role, setRole] = useState<SignatureRoleRequirement | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [biometric, setBiometric] = useState<BiometricAvailability | null>(null);
  const [bioResult, setBioResult] = useState<BiometricResult | null>(null);
  const [bioBusy, setBioBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRole(null);
    setBioResult(null);
    setError("");
    void checkBiometric().then(setBiometric);
  }, [open, entity?.id]);

  useEffect(() => {
    if (!role) return;
    setName(role.signer === "me" ? profile.fullName : "");
    setPhone(role.signer === "me" ? profile.phone : "");
    setNationalId(role.signer === "me" ? profile.nationalId : "");
    setNote("");
    setBioResult(null);
    setError("");
  }, [role, profile]);

  if (!open || !entity) return null;
  const report = audit(entity);

  const runBiometric = async () => {
    setBioBusy(true);
    setBioResult(null);
    const result = await verifyBiometric(`امضای ${role?.label ?? "سند"}: ${entity.title}`, 3);
    setBioResult(result);
    setBioBusy(false);
  };

  const submit = (image: string) => {
    if (!role) return;
    if (name.trim().length < 3) return setError("نام امضاکننده را کامل وارد کنید.");
    if (phone.trim().length < 8) return setError("شماره تماس امضاکننده را وارد کنید.");
    if (bioResult && !bioResult.ok && bioResult.reason !== "not_native") {
      // امضای دستی هنوز مجاز است، ولی کاربر باید بداند تأیید بیومتریک ناموفق بوده.
    }
    const hasBiometric = Boolean(bioResult?.ok);
    sign({ entity, role: role.role, signerName: name, signerPhone: phone, signerNationalId: nationalId, method: hasBiometric ? "draw+biometric" : "draw", image, biometricVerified: hasBiometric, biometricAttempts: bioResult?.attemptsUsed ?? 0, note });
    setRole(null);
    setToast(hasBiometric ? "امضا با تأیید بیومتریک ثبت شد" : "امضای دستی ثبت شد");
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-[#020806]/80 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label="امضای الکترونیکی سند">
      <div className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[24px] border border-[#29483b] bg-[#0d1d16] sm:rounded-[24px]">
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] p-4 sm:p-5">
          <div className="flex items-start gap-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-mint-300/20 bg-mint-300/10 text-mint-300"><Fingerprint className="h-5 w-5" /></span>
            <div>
              <h2 className="text-sm font-bold text-white">امضای الکترونیکی — {entity.title}</h2>
              <p className="mt-1 text-[9px] leading-5 text-[#8aa497]">{entity.subtitle}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[8px]">
                <span className={cn("rounded px-1.5 py-0.5", report.complete ? "bg-mint-300/10 text-mint-300" : "bg-sand-300/10 text-sand-300")}>{toPersianDigits(report.signed)} از {toPersianDigits(report.required)} امضای الزامی</span>
                <span className={cn("rounded px-1.5 py-0.5", report.chainValid ? "bg-mint-300/10 text-mint-300" : "bg-[#a25649]/15 text-[#efad9f]")}>{report.chainValid ? "زنجیره اصالت معتبر" : "هشدار: زنجیره امضا معتبر نیست"}</span>
                <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[#a8bfb3]">{report.tierLabel}</span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 text-[#9fb6aa]" aria-label="بستن"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
          <div className="rounded-xl border border-[#c5b97f]/25 bg-[#c5b97f]/[0.05] p-3 text-[8px] leading-5 text-[#d7cba1]">
            <b>صادقانه بدانید:</b> این امضا «امضای الکترونیکی ساده» است و با ثبت نام، زمان، اثر انگشت دستگاه و hash محتوا تقویت می‌شود.
            «امضای الکترونیکی مطمئن» طبق ماده ۱۰ قانون تجارت الکترونیکی به گواهی مرکز صدور گواهی معتبر نیاز دارد و بدون آن، در دادگاه
            به‌تنهایی مانند سند رسمی نیست. برای قرارداد زمین با مبلغ بالا، چک و تعهدات سنگین، ثبت رسمی و امضای حضوری توصیه می‌شود.
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {entity.roles.map((requirement) => {
              const record = report.records.find((row) => row.role === requirement.role);
              return (
                <div key={requirement.role} className={cn("rounded-xl border p-2.5", record ? "border-mint-300/25 bg-mint-300/[0.05]" : "border-white/[0.08] bg-white/[0.02]")}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] font-medium text-[#e3f0e8]">{record ? <Check className="h-3 w-3 text-mint-300" /> : <span className="h-3 w-3 rounded-full border border-[#6f8e80]" />}{requirement.label}{requirement.required ? <span className="text-[#c9967e]">*</span> : <span className="text-[7px] text-[#78968a]">(اختیاری)</span>}</div>
                      <p className="mt-1 text-[8px] leading-4 text-[#819d90]">{requirement.why}</p>
                    </div>
                    {!record && <button type="button" onClick={() => setRole(requirement)} className="shrink-0 rounded-lg bg-mint-300/10 px-2 py-1 text-[8px] text-mint-300">ثبت امضا</button>}
                  </div>
                  {record && (
                    <div className="mt-2 rounded-lg bg-[#071510]/50 px-2 py-1.5">
                      <div className="flex items-center justify-between gap-1 text-[8px]"><span className="text-[#d3e4da]">{record.signerName}</span><button type="button" onClick={() => { if (window.confirm("این امضا حذف شود؟")) { remove(record.id); setToast("امضا حذف شد"); } }} className="text-[#8a6b63] hover:text-[#efad9f]" aria-label="حذف امضا"><Trash2 className="h-3 w-3" /></button></div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[7px] text-[#78968a]"><span>{formatJalali(record.signedAt, "long")}</span><span>{record.method === "draw+biometric" ? "دستی + بیومتریک" : "دستی"}</span><span className="font-mono">{shortHash(record.signatureHash)}</span></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {report.missing.length > 0 && (
            <div className="rounded-xl border border-sand-300/20 bg-sand-300/[0.05] p-2.5 text-[8px] leading-5 text-[#d8cca6]">
              <b>امضاهای باقی‌مانده:</b> {report.missing.map((row) => row.label).join("، ")} — تا تکمیل نشدن، این تعهد «ناقص» است.
            </div>
          )}

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-[#dcebe2]"><Fingerprint className="h-3.5 w-3.5 text-mint-300" /> تأیید هویت با اثر انگشت گوشی</div>
                <p className="mt-1 text-[8px] leading-4 text-[#78968a]">{biometric?.note ?? "در حال بررسی حسگر…"} (نوع: {biometric?.label ?? "—"})</p>
              </div>
              <span className={cn("rounded-full border px-2 py-0.5 text-[8px]", biometric?.status === "available" ? "border-mint-300/25 text-mint-300" : "border-sand-300/25 text-sand-300")}>{biometric?.status === "available" ? "حسگر آماده" : "بدون تأیید بیومتریک"}</span>
            </div>
            {role && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" onClick={runBiometric} disabled={bioBusy || biometric?.status !== "available"} className="flex items-center gap-1.5 rounded-lg border border-mint-300/25 bg-mint-300/[0.08] px-2.5 py-1.5 text-[8px] text-mint-300 disabled:opacity-40"><Fingerprint className="h-3 w-3" /> {bioBusy ? "منتظر تأیید حسگر…" : "تأیید با اثر انگشت (تا ۳ تلاش)"}</button>
                {bioResult && <span className={cn("text-[8px]", bioResult.ok ? "text-mint-300" : "text-[#efad9f]")}>{bioResult.ok ? "✓ هویت بیومتریک تأیید شد" : bioResult.message}</span>}
              </div>
            )}
            <p className="mt-2 text-[7px] leading-4 text-[#6f8c7f]">اندروید تصویر اثر انگشت را در اختیار برنامه قرار نمی‌دهد؛ برنامه فقط نتیجه تأیید حسگر دستگاه را ثبت می‌کند. می‌توانید چند اثر انگشت در تنظیمات گوشی ثبت کنید و هر یک در همین تأیید پذیرفته می‌شود. اثر انگشت ناخوانا یا ناموفق، به‌صراحت علامت‌گذاری می‌شود.</p>
          </div>

          {role && (
            <div className="space-y-2.5 rounded-xl border border-mint-300/20 bg-mint-300/[0.03] p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <TextField label="نام امضاکننده" value={name} onChange={setName} required suggestions={[profile.fullName]} placeholder="نام و نام خانوادگی" />
                <TextField label="شماره تماس" value={phone} onChange={setPhone} numeric required suggestions={[profile.phone]} placeholder="۰۹۱۲۱۲۳۴۵۶۷" />
                <TextField label="کد ملی (اختیاری)" value={nationalId} onChange={setNationalId} numeric placeholder="۱۰ رقم" />
                <TextField label="یادداشت امضا (اختیاری)" value={note} onChange={setNote} placeholder="مثلاً به نمایندگی از کارخانه" />
              </div>
              <DrawPad onSave={submit} disabled={!role} />
              {error && <p className="text-[9px] text-[#f0a59a]">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { if (bioResult?.ok && !error) { submit(""); } else setError("برای ثبت بیومتریک، ابتدا اثر انگشت را تأیید کنید و نام/تلفن را وارد کنید."); }} disabled={!bioResult?.ok} className="flex items-center gap-1.5 rounded-lg bg-[#9fd4ee]/15 px-2.5 py-2 text-[9px] text-[#bfe6f7] disabled:opacity-40"><Fingerprint className="h-3.5 w-3.5" /> ثبت امضا با تأیید بیومتریک (بدون امضای دستی)</button>
                <button type="button" onClick={() => setRole(null)} className="px-2 py-2 text-[9px] text-[#819d90]">انصراف</button>
              </div>
            </div>
          )}

          <details className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
            <summary className="cursor-pointer text-[9px] font-medium text-[#b9cec3]">مبنای قانونی و محدودیت‌ها (برای هر بخش)</summary>
            <ul className="mt-2 space-y-1.5 text-[8px] leading-5 text-[#819d90]">
              {signatureTierExplanation().map((line) => <li key={line}>• {line}</li>)}
            </ul>
          </details>

          <div className="flex flex-wrap items-center gap-2 text-[8px] text-[#6f8c7f]">
            <ShieldCheck className="h-3 w-3 text-mint-300" /> hash محتوا: <span className="font-mono">{shortHash(report.payloadHash, 20)}</span>
            <Link2 className="h-3 w-3 text-mint-300" /> آخرین امضا: <span className="font-mono">{report.records.length ? shortHash(report.records[report.records.length - 1].signatureHash, 20) : "—"}</span>
            {report.chainValid ? <span className="flex items-center gap-1 text-mint-300"><BadgeCheck className="h-3 w-3" /> زنجیره سالم</span> : <span className="flex items-center gap-1 text-[#efad9f]"><AlertTriangle className="h-3 w-3" /> زنجیره نیازمند بازبینی</span>}
          </div>
        </div>
      </div>
      <Toast open={Boolean(toast)} message={toast ?? ""} onClose={() => setToast(null)} />
    </div>,
    document.body
  );
}
