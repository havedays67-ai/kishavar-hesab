import { useState } from "react";
import {
  Calculator,
  Check,
  Droplets,
  Leaf,
  MapPinned,
  Plus,
  Printer,
  Sprout,
  Trash2,
  TrendingUp,
  Wallet,
  Wheat,
} from "lucide-react";
import { RecordReceipts } from "../components/RecordReceipts";
import { cn } from "../utils/cn";
import { numberToPersianWords, toEnglishDigits, toPersianDigits } from "../lib/format";
import { formatAmount } from "../lib/money-format";
import { CROP_COST_LABELS, type CropPlot, plotCost, plotMetrics } from "../lib/samples";
import { makeDocument, type DocumentSpec } from "../lib/documents";
import { AmountField, SelectField, TextField } from "../components/FormControls";
import { Modal } from "../components/ui";
import { CROPS } from "../lib/data";

// مبلغ/عدد با ارقام لاتین و جداکنندهٔ هزارگان (یکدست در کل برنامه)
const fa = (value: number) => formatAmount(value, { decimals: 0 });
const money = (value: number) => `${fa(value)} تومان`;

const newPlotTemplate: Omit<CropPlot, "id"> = {
  title: "",
  location: "پارس‌آباد",
  areaHa: 5,
  crop: "گندم",
  season: "۱۴۰۵–۱۴۰۶",
  ownership: "leased",
  rent: 0,
  seed: 0,
  fertilizer: 0,
  water: 0,
  labor: 0,
  machinery: 0,
  other: 0,
  yieldKgPerHa: 5000,
  pricePerKg: 49500,
};

export function CropsPage({
  plots,
  onAddPlot,
  onDeletePlot,
  onUpdatePlot,
  onOpenDocument,
}: {
  plots: CropPlot[];
  onAddPlot: (plot: CropPlot) => void;
  onDeletePlot: (id: string) => void;
  onUpdatePlot: (plot: CropPlot) => void;
  onOpenDocument: (spec: DocumentSpec) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<Omit<CropPlot, "id">>(newPlotTemplate);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<CropPlot | null>(null);

  const totals = plots.reduce(
    (acc, plot) => {
      const metrics = plotMetrics(plot);
      acc.area += plot.areaHa;
      acc.cost += metrics.cost;
      acc.revenue += metrics.revenue;
      acc.profit += metrics.profit;
      acc.yield += metrics.yieldKg;
      return acc;
    },
    { area: 0, cost: 0, revenue: 0, profit: 0, yield: 0 }
  );
  const totalCostPerKg = totals.yield > 0 ? totals.cost / totals.yield : 0;
  const maxCost = Math.max(...plots.map((plot) => plotCost(plot)), 1);

  const printCostReport = () => {
    const costRows = plots.map((plot) => {
      const metrics = plotMetrics(plot);
      return {
        title: plot.title,
        areaHa: plot.areaHa,
        crop: plot.crop,
        totalCost: metrics.cost,
        yieldKg: metrics.yieldKg,
        revenue: metrics.revenue,
        profit: metrics.profit,
      };
    });
    onOpenDocument(makeDocument("cost-report", { costRows }));
  };

  const openEdit = (plot: CropPlot) => {
    setEditing(plot);
    const { id: _id, ...rest } = plot;
    setForm(rest);
    setAddOpen(true);
  };

  const submit = () => {
    if (!form.title.trim()) {
      setError("عنوان زمین را وارد کنید.");
      return;
    }
    if (form.areaHa <= 0) {
      setError("مساحت زمین باید بیشتر از صفر باشد.");
      return;
    }
    const created: CropPlot = {
      ...form,
      id: editing?.id ?? `plot-${Date.now()}`,
      title: form.title.trim(),
      areaHa: Number(String(form.areaHa).replace(/[^\d.]/g, "")) || 0,
    };
    if (editing) onUpdatePlot(created);
    else onAddPlot(created);
    setEditing(null);
    setForm(newPlotTemplate);
    setAddOpen(false);
    setError("");
  };

  return (
    <div className="animate-rise">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] text-[#84a294]">
            <Sprout className="h-3.5 w-3.5 text-mint-300" />
            زمین و کشت
            <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[8px] text-[#a8bfb3]">بهای تمام‌شده</span>
          </div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-white sm:text-[26px]">زمین‌ها، کشت و سود هر کیلو</h1>
          <p className="mt-1.5 max-w-2xl text-[11px] font-light leading-6 text-[#89a598]">
            هزینه واقعی هر زمین، عملکرد، سود، حاشیه سود و نقطه سربه‌سر را ببینید. این اعداد مبنای تصمیم برای فروش و
            مذاکره با کارخانه است.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={printCostReport} className="flex items-center gap-1.5 rounded-xl border border-white/[0.09] bg-white/[0.025] px-3 py-2.5 text-[9px] text-[#b9cec3] transition hover:text-white">
            <Printer className="h-3.5 w-3.5" />
            چاپ گزارش
          </button>
          <button type="button" onClick={() => { setEditing(null); setForm(newPlotTemplate); setAddOpen(true); }} className="flex items-center gap-1.5 rounded-xl bg-mint-400 px-3 py-2.5 text-[9px] font-bold text-[#07110d]">
            <Plus className="h-3.5 w-3.5" />
            افزودن زمین
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: "مساحت کل", value: toPersianDigits(totals.area.toFixed(1)), unit: "هکتار", icon: MapPinned },
          { label: "هزینه تولید", value: fa(totals.cost), unit: "تومان", icon: Wallet },
          { label: "ارزش محصول", value: fa(totals.revenue), unit: "تومان", icon: TrendingUp },
          { label: "سود برآوردی", value: fa(totals.profit), unit: "تومان", icon: Check, tone: "mint" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="glass rounded-2xl p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-[#91ad9f]">{item.label}</span>
                <Icon className={cn("h-3.5 w-3.5", item.tone === "mint" ? "text-mint-300" : "text-[#8ba598]")} />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={cn("truncate text-base font-bold", item.label === "سود برآوردی" ? "text-mint-300" : "text-[#eef8f1]")}>{item.value}</span>
                <span className="text-[8px] text-[#738f82]">{item.unit}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-mint-300/15 bg-mint-300/[0.04] px-3.5 py-2.5">
        <span className="flex items-center gap-1.5 text-[9px] text-[#a9c4b8]">
          <Calculator className="h-3.5 w-3.5 text-mint-300" />
          میانگین بهای تمام‌شده هر کیلو محصول
        </span>
        <span className="text-[12px] font-bold text-mint-300">{money(totalCostPerKg)}</span>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        {plots.map((plot) => {
          const metrics = plotMetrics(plot);
          const cost = plotCost(plot);
          return (
            <article key={plot.id} className="glass overflow-hidden rounded-[22px]">
              <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3.5">
                <div className="flex items-start gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-mint-300/15 bg-mint-300/[0.07] text-mint-300">
                    <Leaf className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-[12px] font-semibold text-[#eaf5ee]">{plot.title}</h2>
                    <p className="mt-0.5 flex items-center gap-1 text-[8px] text-[#7e9b8e]"><MapPinned className="h-2.5 w-2.5" /> {plot.location} · {plot.crop} · {toPersianDigits(plot.areaHa)} هکتار</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[8px] text-[#a8bfb3]">{plot.season}</span>
                  <button type="button" onClick={() => openEdit(plot)} className="grid h-7 w-7 place-items-center rounded-lg text-[#78968a] transition hover:bg-white/[0.05] hover:text-mint-300" aria-label={`ویرایش ${plot.title}`}><Check className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => { if (window.confirm(`زمین ${plot.title} حذف شود؟`)) onDeletePlot(plot.id); }} className="grid h-7 w-7 place-items-center rounded-lg text-[#78968a] transition hover:bg-white/[0.05] hover:text-[#efad9f]" aria-label={`حذف ${plot.title}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
                {[
                  ["هزینه کل", money(cost)],
                  ["هزینه هر کیلو", money(metrics.costPerKg)],
                  ["نقطه سربه‌سر", `${money(metrics.breakEven)} / کیلو`],
                  ["عملکرد", `${fa(metrics.yieldKg)} کیلو`],
                  ["درآمد", money(metrics.revenue)],
                  ["سود", money(metrics.profit)],
                  ["حاشیه سود", `${toPersianDigits(metrics.margin.toFixed(1))}٪`],
                  ["قیمت فروش", `${fa(plot.pricePerKg)} تومان`],
                ].map(([label, value], index) => (
                  <div key={label} className={cn("rounded-lg bg-white/[0.02] p-2", index === 5 && "bg-mint-300/[0.05]")}>
                    <div className="text-[8px] text-[#78968a]">{label}</div>
                    <div className={cn("mt-0.5 text-[9px] font-medium", index === 5 ? "text-mint-300" : "text-[#d3e4da]")}>{value}</div>
                  </div>
                ))}
              </div>
              <div className="px-4 pb-3">
                <div className="mb-1.5 flex items-center justify-between text-[8px] text-[#78968a]">
                  <span>ترکیب هزینه‌ها</span>
                  <span className="text-[#a8bfb3]">{toPersianDigits(CROP_COST_LABELS.length)} سرفصل</span>
                </div>
                <div className="mb-1.5 flex h-2 overflow-hidden rounded-full bg-white/[0.05]">
                  {CROP_COST_LABELS.map((item, index) => {
                    const share = cost > 0 ? (plot[item.key] / cost) * 100 : 0;
                    const colors = ["#5cc49b", "#82b3a1", "#c9b578", "#8b9fbd", "#a58ab5", "#c48f7c", "#647f71"];
                    return <div key={item.key} style={{ width: `${share}%`, backgroundColor: colors[index] }} />;
                  })}
                </div>
                <div className="flex flex-wrap gap-x-2 gap-y-1">
                  {CROP_COST_LABELS.filter((item) => plot[item.key] > 0).slice(0, 5).map((item, index) => (
                    <span key={item.key} className="flex items-center gap-1 text-[7px] text-[#7f9b8e]">
                      <span className="h-1 w-1 rounded-full" style={{ backgroundColor: ["#5cc49b", "#82b3a1", "#c9b578", "#8b9fbd", "#a58ab5"][index] }} />
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-white/[0.05] px-4 py-2.5">
                <div className="flex items-center gap-1 text-[8px] text-[#6f8c7f]">
                  <Sprout className="h-3 w-3 text-mint-300" />
                  عملکرد {toPersianDigits(plot.yieldKgPerHa)} کیلو در هکتار
                </div>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-gradient-to-l from-mint-400 to-[#c8e6a2]" style={{ width: `${Math.max(4, Math.min(100, (cost / maxCost) * 100))}%` }} />
                </div>
              </div>
              <div className="px-4 pb-3">
                <RecordReceipts refType="crop" refId={plot.id} section="crops" label="رسید هزینهٔ این کشت" hint="فیش آب، کارگر، سم و کود همین قطعه را ضمیمه کنید." compact />
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h2 className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-[#dcebe2]"><Droplets className="h-3.5 w-3.5 text-mint-300" /> اصلاح مدیریتی هزینه‌ها</h2>
          <p className="text-[9px] font-light leading-5 text-[#819d90]">
            هر زمین یک مرکز هزینه است. هزینه‌های واقعی (اجاره، نهاده، آب، کارگر، ماشین) را ثبت کنید تا بهای تمام‌شده هر
            کیلو و نقطه سربه‌سر به‌دست آید. اگر نرخ فروش پایین‌تر از نقطه سربه‌سر باشد، هشدار سود منفی نمایش داده می‌شود.
          </p>
          <div className="mt-2 rounded-lg bg-[#071510]/45 px-2.5 py-2 text-[8px] text-[#78968a]">
            فرمول: (اجاره + بذر + کود و سم + آب + کارگر + ماشین + سایر) ÷ عملکرد کل = هزینه هر کیلو
          </div>
        </div>
        <div className="rounded-2xl border border-sand-300/15 bg-sand-300/[0.04] p-4">
          <h2 className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-sand-300"><Wheat className="h-3.5 w-3.5" /> گام بعدی برای فروش</h2>
          <p className="text-[9px] font-light leading-5 text-[#d3c8a8]">
            در صفحه «معامله محصول»، وزن باسکول و رطوبت را وارد کنید تا مبلغ نهایی و اسناد فروش ساخته شود. عدد بهای
            تمام‌شده این صفحه، کف قیمت مذاکره شماست.
          </p>
          <button type="button" onClick={printCostReport} className="mt-2 flex items-center gap-1.5 rounded-lg bg-sand-300/10 px-2.5 py-1.5 text-[8px] font-medium text-sand-300">
            <Printer className="h-3 w-3" />
            چاپ گزارش بهای تمام‌شده
          </button>
        </div>
      </div>

      <Modal open={addOpen} onClose={() => { setAddOpen(false); setEditing(null); setForm(newPlotTemplate); }} title={editing ? "ویرایش زمین و کشت" : "افزودن زمین و کشت"} description="هزینه‌ها و عملکرد برآوردی را وارد کنید؛ سود و بهای هر کیلو خودکار محاسبه می‌شود." size="lg">
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <TextField label="عنوان زمین" value={form.title} onChange={(value) => setForm((current) => ({ ...current, title: value }))} placeholder="قطعه شرقی — گندم" required />
          <TextField label="موقعیت" value={form.location} onChange={(value) => setForm((current) => ({ ...current, location: value }))} />
          <SelectField label="محصول" value={CROPS.includes(form.crop) ? form.crop : form.crop ? "__custom__" : ""} onChange={(value) => setForm((current) => ({ ...current, crop: value === "__custom__" ? "" : value }))} options={CROPS.filter((crop) => crop !== "سایر").map((crop) => ({ value: crop, label: crop }))} searchable allowCustom customValue={CROPS.includes(form.crop) ? "" : form.crop} onCustomChange={(value) => setForm((current) => ({ ...current, crop: value }))} customPlaceholder="نام محصول را بنویسید…" />
          <SelectField label="نوع مالکیت" value={form.ownership} onChange={(value) => setForm((current) => ({ ...current, ownership: value as CropPlot["ownership"] }))} options={[{ value: "owned", label: "ملکی" }, { value: "leased", label: "اجاره‌ای" }, { value: "shared", label: "مشارکتی" }]} />
          <TextField label="مساحت (هکتار)" value={String(form.areaHa)} onChange={(value) => setForm((current) => ({ ...current, areaHa: Number(toEnglishDigits(value).replace(/[^\d.]/g, "")) || 0 }))} />
          <TextField label="عملکرد (کیلوگرم در هکتار)" value={String(form.yieldKgPerHa)} onChange={(value) => setForm((current) => ({ ...current, yieldKgPerHa: Number(toEnglishDigits(value).replace(/[^\d.]/g, "")) || 0 }))} />
          <AmountField label="قیمت فروش هر کیلو" value={form.pricePerKg} onChange={(value) => setForm((current) => ({ ...current, pricePerKg: value }))} suffix="تومان" required />
          <div className="text-[9px] leading-5 text-[#78968a] sm:col-span-2">هزینه‌ها (تومان):</div>
          {CROP_COST_LABELS.map((item) => (
            <AmountField
              key={item.key}
              label={item.label}
              value={form[item.key]}
              onChange={(value) => setForm((current) => ({ ...current, [item.key]: value }))}
              suffix="تومان"
            />
          ))}
          {error && <p className="rounded-lg border border-[#8f4c44]/30 bg-[#8f4c44]/10 px-3 py-2 text-[10px] text-[#f0a59a] sm:col-span-2">{error}</p>}
          <div className="rounded-lg border border-mint-300/15 bg-mint-300/[0.05] p-3 text-[9px] leading-5 text-[#b6d3c2] sm:col-span-2">
            برآورد: هزینه {money(plotCost({ ...form, id: "preview" }))} · ارزش محصول {money(form.areaHa * form.yieldKgPerHa * form.pricePerKg)} ·{" "}
            {numberToPersianWords(form.areaHa * form.yieldKgPerHa * form.pricePerKg - plotCost({ ...form, id: "preview" }))} تومان سود
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <button type="button" onClick={submit} className="flex-1 rounded-xl bg-mint-400 py-2.5 text-[10px] font-bold text-[#07110d]">{editing ? "ذخیره تغییرات" : "ثبت زمین"}</button>
            <button type="button" onClick={() => setAddOpen(false)} className="rounded-xl border border-white/[0.09] px-4 py-2.5 text-[10px] text-[#a9c1b5]">انصراف</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
