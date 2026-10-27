import { Copy, Download, Printer, ShieldCheck, Wheat } from "lucide-react";
import { useState } from "react";
import type { SavedContract } from "../lib/data";
import { formatJalali, formatNumber, numberToPersianWords, toPersianDigits } from "../lib/format";
import { Modal } from "./ui";
import { CONTRACT_TYPES } from "../lib/data";
import { useProfile, profileDisplayName } from "../lib/profile";
import { deliverDocumentPdf, printSheetInPage } from "../lib/pdf";

export function ContractPreview({
  open,
  onClose,
  contract,
  onCopy,
}: {
  open: boolean;
  onClose: () => void;
  contract: SavedContract | null;
  onCopy: (code: string) => void;
}) {
  const { profile } = useProfile();
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  if (!contract) return null;
  const firstPartyName = contract.myName?.trim() || profileDisplayName(profile);
  const signatures = contract.signatures ?? [];
  const type = CONTRACT_TYPES.find((item) => item.id === contract.type);
  const iAmLandlord = contract.myRole === "landlord";
  const myLabel = iAmLandlord ? "موجر (مالک زمین)" : "مستاجر (بهره‌بردار)";
  const theirLabel = iAmLandlord ? "مستاجر (بهره‌بردار)" : "موجر (مالک زمین)";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="پیش‌نمایش قرارداد"
      description="این سند یک پیش‌نویس است و برای امضای نهایی باید بازبینی شود."
      size="lg"
    >
      <div className="bg-[#e9e6db] p-3 sm:p-6">
        <div id="print-root">
        <article className="print-sheet mx-auto max-w-[720px] rounded-lg bg-[#fcfaf2] p-5 text-[#1e2b24] shadow-[0_20px_60px_rgba(0,0,0,0.22)] sm:p-9">
          <div className="flex items-start justify-between gap-4 border-b border-[#d8d2c0] pb-5">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#1b5742] text-[#f3e7be]">
                <Wheat className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-sm font-extrabold sm:text-base">قرارداد {type?.label ?? "بهره‌برداری زمین"}</h1>
                <p className="mt-1 text-[9px] text-[#6d776f]">پیش‌نویس داخلی · {firstPartyName}</p>
              </div>
            </div>
            <div className="text-left">
              <div className="rounded-md bg-[#eae5d5] px-2 py-1 text-[9px] font-medium text-[#57665b]">
                شماره {contract.code}
              </div>
              <div className="mt-1.5 text-[8px] text-[#7b857c]">تاریخ تنظیم: {formatJalali(contract.createdAt, "long")}</div>
            </div>
          </div>

          <div className="my-5 rounded-lg border border-[#c9b97d]/50 bg-[#f7f1db] p-3 text-[9px] leading-5 text-[#6e6034]">
            این قرارداد به‌صورت الکترونیکی در «{firstPartyName}» تنظیم شده است. ثبت آن در نرم‌افزار جایگزین تشریفات قانونی،
            ثبت رسمی یا امضای حضوری نیست.
          </div>

          <section className="mb-5">
            <h2 className="mb-2.5 flex items-center gap-2 text-[11px] font-bold text-[#214535]">
              <span className="h-3 w-1 rounded-full bg-[#39795c]" />
              طرفین قرارداد
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-[#ddd8c8] bg-[#f6f4ea] p-3">
                <div className="text-[8px] text-[#718076]">{myLabel}</div>
                <div className="mt-1 text-[11px] font-semibold">{firstPartyName}</div>
                <div className="mt-0.5 text-[8px] text-[#6f796f]">طرف اول · ثبت‌کننده قرارداد</div>
              </div>
              <div className="rounded-md border border-[#ddd8c8] bg-[#f6f4ea] p-3">
                <div className="text-[8px] text-[#718076]">{theirLabel}</div>
                <div className="mt-1 text-[11px] font-semibold">{contract.partyName}</div>
                <div className="mt-0.5 text-[8px] text-[#6f796f]">طرف دوم · انتخاب‌شده از طرف‌حساب‌ها</div>
              </div>
            </div>
          </section>

          <section className="mb-5">
            <h2 className="mb-2.5 flex items-center gap-2 text-[11px] font-bold text-[#214535]">
              <span className="h-3 w-1 rounded-full bg-[#39795c]" />
              موضوع و مدت قرارداد
            </h2>
            <div className="overflow-hidden rounded-md border border-[#ddd8c8]">
              {[
                ["نوع قرارداد", type?.label ?? "—"],
                ["ملک / زمین", `${contract.landTitle}${contract.area ? ` · ${contract.area} هکتار` : ""}`],
                ["محصول", contract.crop],
                ["مدت", `از ${formatJalali(contract.start, "long")} تا ${formatJalali(contract.end, "long")}`],
                ["شماره پلاک ثبتی", contract.plaque || "ثبت نشده"],
                ["حقابه / سهم آب", contract.waterShare || "طبق عرف محل"],
              ].map(([label, value], index) => (
                <div key={label} className={`grid grid-cols-[110px_1fr] text-[9px] ${index % 2 === 0 ? "bg-[#f8f6ee]" : "bg-[#f1eee2]"}`}>
                  <div className="border-l border-[#e1ddce] px-3 py-2 text-[#788477]">{label}</div>
                  <div className="px-3 py-2 font-medium text-[#354b3e]">{value}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-5">
            <h2 className="mb-2.5 flex items-center gap-2 text-[11px] font-bold text-[#214535]">
              <span className="h-3 w-1 rounded-full bg-[#39795c]" />
              شرایط مالی
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["اجاره کل", contract.rent ? `${formatNumber(contract.rent)} تومان` : "ندارد"],
                ["ودیعه", `${formatNumber(contract.deposit)} تومان`],
                ["دوره پرداخت", contract.period],
                ["سهم مالک از محصول", `${toPersianDigits(contract.cropShare)}٪`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-[#dfdacb] bg-[#f7f4ea] p-2.5">
                  <div className="text-[8px] text-[#788477]">{label}</div>
                  <div className="mt-1 text-[10px] font-bold text-[#2c4737]">{value}</div>
                </div>
              ))}
            </div>
            {contract.rent > 0 && (
              <p className="mt-2 text-[8px] leading-5 text-[#6e7a70]">
                مبلغ {numberToPersianWords(contract.rent)} تومان در سررسیدهای {contract.period} پرداخت می‌شود.
              </p>
            )}
          </section>

          <section className="mb-5">
            <h2 className="mb-2 flex items-center gap-2 text-[11px] font-bold text-[#214535]">
              <span className="h-3 w-1 rounded-full bg-[#39795c]" />
              تعهدات و شرایط
            </h2>
            <p className="rounded-md bg-[#f5f2e7] p-3 text-[9px] leading-6 text-[#566357]">
              {contract.obligations || "طرفین متعهد به رعایت عرف محلی، حفظ کاربری زمین و انجام تعهدات توافق‌شده هستند."}
              <br />
              هزینه آب، برق و پمپ بر عهده {contract.utilities} است.
            </p>
          </section>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[{ role: "landlord", label: "موجر / مالک" }, { role: "tenant", label: "مستاجر / بهره‌بردار" }, { role: "witness", label: "شاهد (اختیاری)" }].map((slot) => {
              const signature = signatures.find((row) => row.role === slot.role);
              return (
                <div key={slot.role} className="rounded border border-[#c8c3b5] p-2 text-center">
                  <div className="mb-1 text-[8px] font-semibold text-[#4c5a51]">{slot.label}</div>
                  {signature ? (
                    <>
                      <img src={signature.image} alt={`امضای ${signature.signerName}`} className="mx-auto h-12 max-w-full object-contain" />
                      <div className="mt-1 text-[8px] font-medium text-[#2e4a38]">{signature.signerName}</div>
                      <div className="text-[7px] text-[#7c877d]">{formatJalali(signature.signedAt, "short")} · کد اثر {signature.hash}</div>
                    </>
                  ) : (
                    <>
                      <div className="mb-5 border-b border-dashed border-[#a9a394] pb-1" />
                      <div className="text-[8px] text-[#9aa096]">نام، مهر و امضا</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded border border-[#cdbf8b] bg-[#f8f3e2] px-2.5 py-2 text-[7px] leading-4 text-[#6b623f]">
            <span>امضای الکترونیکی ثبت‌شده در برنامه؛ برای اعتبار رسمی، امضای حضوری/ثبت در دفتر اسناد رسمی نیز لازم است.</span>
            <span className="font-mono">کد پیگیری: {contract.trackingCode || contract.code}</span>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#e1dccd] pt-3 text-[8px] text-[#8b9289]">
            <span>صفحه ۱ از ۱ · سند پیش‌نویس</span>
            <span className="flex items-center gap-1 text-[#5f7d67]">
              <ShieldCheck className="h-3 w-3" />
              کد پیگیری: {contract.trackingCode || contract.code}
            </span>
          </div>
        </article>
        </div>
      </div>

      <div className="no-print flex flex-wrap items-center gap-2 border-t border-white/[0.08] bg-[#0d1d16] p-4">
        <button
          type="button"
          onClick={() => onCopy(contract.code)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-mint-400 px-4 py-2.5 text-[11px] font-semibold text-[#07110d] transition hover:bg-mint-300"
        >
          <Copy className="h-3.5 w-3.5" />
          کپی شماره قرارداد
        </button>
        <button
          type="button"
          onClick={() => printSheetInPage(document.getElementById("print-root"), `قرارداد ${contract.code}`)}
          className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-4 py-2.5 text-[11px] text-[#c7dad0] transition hover:bg-white/[0.05]"
        >
          <Printer className="h-3.5 w-3.5" />
          چاپ با امضا
        </button>
        <button
          type="button"
          onClick={async () => {
            setPdfStatus("در حال ساخت PDF…");
            const result = await deliverDocumentPdf(document.getElementById("print-root"), contract.trackingCode || contract.code);
            setPdfStatus(result.message);
          }}
          className="flex items-center justify-center gap-2 rounded-xl border border-[#9fd4ee]/30 bg-[#9fd4ee]/10 px-4 py-2.5 text-[11px] text-[#bfe6f7] transition hover:bg-[#9fd4ee]/20"
        >
          <Download className="h-3.5 w-3.5" />
          دانلود PDF امضاشده
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-2.5 text-[11px] text-[#91aa9e] transition hover:text-white"
        >
          بستن
        </button>
        {pdfStatus && <p className="w-full text-[8px] text-[#8fb2c4]">{pdfStatus}</p>}
      </div>
    </Modal>
  );
}
