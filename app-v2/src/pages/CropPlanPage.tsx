import { useMemo, useState } from "react";
import { CalendarDays, Droplets, FlaskConical, Leaf, ShieldAlert, Sprout, Sun, TrendingUp } from "lucide-react";
import { cn } from "../utils/cn";
import { formatAmount } from "../lib/money-format";
import { formatJalali, toPersianDigits, todayJalali, type JDate } from "../lib/format";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { useProfile } from "../lib/profile";
import {
  CROPS,
  planCrop,
  type ClimateZone,
  type CropId,
  type FarmProfile,
  type SoilType,
  type WaterSource,
} from "../lib/ai/agronomy-planner";
import { buildSeasonPlan, CROP_SCHEDULES, TASK_LABELS, type TaskKind } from "../lib/agronomy/season-plan";

const CLIMATE_LABELS: Record<ClimateZone, string> = {
  cold: "سرد",
  temperate: "معتدل",
  warm: "گرم",
  dry: "خشک",
  humid: "مرطوب",
};
const SOIL_LABELS: Record<SoilType, string> = {
  clay: "رسوبی/سنگین",
  loam: "لومی (متوسط)",
  sandy: "شنی (سبک)",
  saline: "شور",
};
const WATER_LABELS: Record<WaterSource, string> = {
  well: "چاه",
  canal: "کانال",
  qanat: "قنات",
  rain: "دیم/باران",
};
const TASK_STYLE: Record<TaskKind, { chip: string; dot: string }> = {
  prep: { chip: "bg-white/[0.06] text-[#b9cdc2]", dot: "#9fb6aa" },
  planting: { chip: "bg-mint-300/10 text-mint-300", dot: "#6ee7b7" },
  fertilizer: { chip: "bg-[#c5b97f]/10 text-[#d8c896]", dot: "#e3d39a" },
  spray: { chip: "bg-[#f0a59a]/10 text-[#f0a59a]", dot: "#f0a59a" },
  irrigation: { chip: "bg-[#60a5fa]/10 text-[#9cc4f5]", dot: "#93c5fd" },
  harvest: { chip: "bg-mint-400/15 text-[#a7f3d0]", dot: "#34d399" },
};

function ScoreRing({ score }: { score: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.max(0, Math.min(100, score)) / 100;
  const color = score >= 75 ? "#6ee7b7" : score >= 50 ? "#e3d39a" : "#f0a59a";
  return (
    <div className="relative grid h-24 w-24 shrink-0 place-items-center">
      <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
        <circle cx="40" cy="40" r={radius} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${circumference * filled} ${circumference}`} />
      </svg>
      <div className="absolute text-center">
        <div className="text-[15px] font-bold text-white">{toPersianDigits(score)}</div>
        <div className="text-[7px] text-[#78968a]">از ۱۰۰</div>
      </div>
    </div>
  );
}

function SeasonTimeline({ start, duration, tasks }: { start: JDate; duration: number; tasks: { offset: number; kind: TaskKind; title: string }[] }) {
  const width = 1000;
  const ticks = useMemo(() => {
    const step = Math.max(30, Math.round(duration / 8));
    return Array.from({ length: Math.floor(duration / step) + 1 }, (_, index) => index * step);
  }, [duration]);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} 130`} className="h-[130px] w-full min-w-[620px]" role="img" aria-label="خط زمانی فصل">
        <line x1="20" y1="86" x2={width - 20} y2="86" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
        {ticks.map((day) => {
          const x = 20 + (day / duration) * (width - 40);
          return (
            <g key={day}>
              <line x1={x} y1="78" x2={x} y2="94" stroke="rgba(255,255,255,0.15)" />
              <text x={x} y="110" textAnchor="middle" fontSize="13" fill="#78968a">
                {toPersianDigits(`${day} روز`)}
              </text>
            </g>
          );
        })}
        {tasks.map((task, index) => {
          const x = 20 + (task.offset / duration) * (width - 40);
          const lane = index % 2 === 0 ? 56 : 24;
          return (
            <g key={`${task.title}-${index}`}>
              <line x1={x} y1={lane + 8} x2={x} y2="80" stroke={TASK_STYLE[task.kind].dot} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
              <circle cx={x} cy="86" r="6" fill={TASK_STYLE[task.kind].dot} />
              <text x={x} y={lane} textAnchor="middle" fontSize="12" fill={TASK_STYLE[task.kind].dot}>
                {task.title.length > 18 ? `${task.title.slice(0, 18)}…` : task.title}
              </text>
            </g>
          );
        })}
        <text x="20" y="18" fontSize="13" fill="#93ad9f">شروع: {formatJalali(start, "long")}</text>
      </svg>
    </div>
  );
}

function Bar({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[8px]">
        <span className="text-[#93ad9f]">{label}</span>
        <span className="text-[#dcebe2]">{toPersianDigits(value.toLocaleString("en-US"))}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function CropPlanPage() {
  const { profile } = useProfile();
  const [cropId, setCropId] = useState<CropId>("wheat-irrigated");
  const [climate, setClimate] = useState<ClimateZone>("cold");
  const [soil, setSoil] = useState<SoilType>("loam");
  const [waterSource, setWaterSource] = useState<WaterSource>("well");
  const [areaHa, setAreaHa] = useState(5);
  const [planting, setPlanting] = useState<JDate | null>(todayJalali());

  const crop = CROPS[cropId];

  const farm: FarmProfile = {
    region: profile.city || "منطقهٔ شما",
    climate,
    areaHa: Math.max(0.1, areaHa),
    soil,
    waterSource,
    season: "autumn",
  };

  const plan = useMemo(() => planCrop(cropId, farm), [cropId, climate, soil, waterSource, areaHa, profile.city]);
  const season = useMemo(() => {
    const date = planting ?? todayJalali();
    const schedule = CROP_SCHEDULES[cropId];
    const harvestOffset = Math.round((crop.daysToHarvest[0] + crop.daysToHarvest[1]) / 2);
    return buildSeasonPlan(cropId, crop.name, date, Math.max(0.1, areaHa), crop.waterNeedMm / Math.max(0.1, areaHa) / 10 * Math.max(0.1, areaHa), {
      plantingWindowDays: schedule.plantingWindowDays,
      daysToHarvest: harvestOffset,
    });
  }, [cropId, crop, areaHa, planting]);

  const groups = useMemo(() => {
    const fertilizer = season.tasks.filter((task) => task.kind === "fertilizer");
    const spray = season.tasks.filter((task) => task.kind === "spray");
    return { fertilizer, spray };
  }, [season]);

  return (
    <div className="space-y-4">
      <section className="glass rounded-[22px] p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-mint-300/15 bg-mint-300/10 text-mint-300"><CalendarDays className="h-4 w-4" /></span>
          <div>
            <h1 className="text-[12px] font-semibold text-white">تقویم کشت و نهاده</h1>
            <p className="mt-0.5 text-[8px] text-[#78968a]">چه بکارم، کِی بکارم، کِی کود و سم بدهم — با محاسبهٔ قطعی، نه حدس.</p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block">
            <span className="mb-1 block text-[8px] text-[#78968a]">محصول</span>
            <select value={cropId} onChange={(event) => setCropId(event.target.value as CropId)} className="field w-full py-2 text-[10px]">
              {(Object.keys(CROPS) as CropId[]).map((id) => <option key={id} value={id}>{CROPS[id].name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[8px] text-[#78968a]">اقلیم منطقه</span>
            <select value={climate} onChange={(event) => setClimate(event.target.value as ClimateZone)} className="field w-full py-2 text-[10px]">
              {(Object.keys(CLIMATE_LABELS) as ClimateZone[]).map((id) => <option key={id} value={id}>{CLIMATE_LABELS[id]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[8px] text-[#78968a]">خاک</span>
            <select value={soil} onChange={(event) => setSoil(event.target.value as SoilType)} className="field w-full py-2 text-[10px]">
              {(Object.keys(SOIL_LABELS) as SoilType[]).map((id) => <option key={id} value={id}>{SOIL_LABELS[id]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[8px] text-[#78968a]">منبع آب</span>
            <select value={waterSource} onChange={(event) => setWaterSource(event.target.value as WaterSource)} className="field w-full py-2 text-[10px]">
              {(Object.keys(WATER_LABELS) as WaterSource[]).map((id) => <option key={id} value={id}>{WATER_LABELS[id]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[8px] text-[#78968a]">مساحت (هکتار)</span>
            <input type="number" min={0.1} step={0.1} value={areaHa} onChange={(event) => setAreaHa(Number(event.target.value) || 0.1)} className="field w-full py-2 text-[10px]" />
          </label>
        </div>
        <div className="mt-2 max-w-[240px]">
          <JalaliDatePicker label="تاریخ کاشت" value={planting} onChange={setPlanting} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
        <section className="glass rounded-[22px] p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold text-white"><Sprout className="h-3.5 w-3.5 text-mint-300" /> ارزیابی زمین برای {crop.name}</h2>
          <div className="flex items-center gap-3">
            <ScoreRing score={plan.score} />
            <div className="min-w-0">
              <p className={cn("text-[10px] font-semibold", plan.score >= 75 ? "text-mint-300" : plan.score >= 50 ? "text-sand-300" : "text-[#f0a59a]")}>{plan.verdict}</p>
              <p className="mt-1 text-[8px] leading-4 text-[#93ad9f]">پنجرهٔ کاشت: <span className="text-[#dcebe2]">{plan.window}</span></p>
              <p className="text-[8px] leading-4 text-[#93ad9f]">آب لازم: <span className="text-[#dcebe2]">{toPersianDigits(season.waterM3.toLocaleString("en-US"))} متر مکعب</span></p>
            </div>
          </div>
          {season.windowWarning && (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-[#c5b97f]/25 bg-[#c5b97f]/[0.06] px-2 py-1.5 text-[8px] leading-4 text-[#e3d39a]"><ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />{season.windowWarning}</p>
          )}
          <div className="mt-3 space-y-1.5">
            {plan.risks.slice(0, 3).map((risk) => <p key={risk} className="text-[8px] leading-4 text-[#a9c1b5]">• {risk}</p>)}
          </div>
          {plan.questions.length > 0 && (
            <p className="mt-2 rounded-lg bg-white/[0.03] px-2 py-1.5 text-[8px] leading-4 text-[#93ad9f]">{plan.questions[0]}</p>
          )}
        </section>

        <section className="glass rounded-[22px] p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold text-white"><TrendingUp className="h-3.5 w-3.5 text-mint-300" /> اعداد کلیدی فصل</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-white/[0.06] p-2.5">
              <p className="mb-1 text-[8px] text-[#78968a]">طول فصل</p>
              <p className="text-[11px] font-semibold text-white">{toPersianDigits(season.durationDays)} روز</p>
              <p className="mt-0.5 text-[7px] text-[#6f8c7f]">برداشت: {formatJalali(season.harvest, "long")}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] p-2.5">
              <p className="mb-1 text-[8px] text-[#78968a]">کود کل فصل</p>
              <p className="text-[11px] font-semibold text-white">{toPersianDigits(season.fertilizerTotalKg.toLocaleString("en-US"))} کیلوگرم</p>
              <p className="mt-0.5 text-[7px] text-[#6f8c7f]">برای {toPersianDigits(areaHa)} هکتار</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] p-2.5">
              <p className="mb-1 text-[8px] text-[#78968a]">فاصلهٔ آبیاری</p>
              <p className="text-[11px] font-semibold text-white">{season.irrigationIntervalDays > 0 ? `${toPersianDigits(season.irrigationIntervalDays)} روز` : "دیم"}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] p-2.5">
              <p className="mb-1 text-[8px] text-[#78968a]">سود برآوردی</p>
              <p className="text-[11px] font-semibold text-mint-300">{formatAmount(plan.economics.profitToman[0])} تا {formatAmount(plan.economics.profitToman[1])}</p>
              <p className="mt-0.5 text-[7px] text-[#6f8c7f]">تومان — بازهٔ راهنما</p>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <Bar label="آب مورد نیاز فصل (متر مکعب)" value={season.waterM3} max={Math.max(season.waterM3, plan.water.availableM3 ?? 0) || 1} tone="bg-[#60a5fa]" />
            {plan.water.availableM3 !== null && <Bar label="آب در دسترس (متر مکعب)" value={plan.water.availableM3} max={Math.max(season.waterM3, plan.water.availableM3) || 1} tone="bg-mint-400" />}
          </div>
        </section>
      </div>

      <section className="glass rounded-[22px] p-4">
        <h2 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-white"><Sun className="h-3.5 w-3.5 text-mint-300" /> خط زمانی فصل</h2>
        <p className="mb-2 text-[8px] text-[#78968a]">هر نقطه یک عملیات است؛ رنگ = نوع کار.</p>
        <SeasonTimeline start={season.planting} duration={season.durationDays} tasks={season.tasks.map((task) => ({ offset: task.offset, kind: task.kind, title: task.title }))} />
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(TASK_LABELS) as TaskKind[]).map((kind) => (
            <span key={kind} className="flex items-center gap-1 text-[7px] text-[#93ad9f]"><span className="h-1.5 w-1.5 rounded-full" style={{ background: TASK_STYLE[kind].dot }} />{TASK_LABELS[kind]}</span>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass rounded-[22px] p-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-white"><FlaskConical className="h-3.5 w-3.5 text-[#d8c896]" /> برنامهٔ کوددهی</h2>
          <div className="space-y-2">
            {groups.fertilizer.map((task) => (
              <div key={`${task.offset}-${task.title}`} className="rounded-xl border border-white/[0.06] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[9px] font-medium text-[#dcebe2]">{task.title}</p>
                  <span className="shrink-0 rounded bg-white/[0.05] px-1.5 py-0.5 text-[7px] text-[#93ad9f]">{formatJalali(task.date, "short")}</span>
                </div>
                <p className="mt-1 text-[8px] leading-4 text-[#93ad9f]">{task.detail}</p>
                {task.total ? <p className="mt-1 text-[7px] text-[#78968a]">مقدار: {toPersianDigits(task.total.toLocaleString("en-US"))} {task.unit} برای کل زمین</p> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="glass rounded-[22px] p-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-white"><ShieldAlert className="h-3.5 w-3.5 text-[#f0a59a]" /> برنامهٔ سم‌پاشی</h2>
          <div className="space-y-2">
            {groups.spray.map((task) => (
              <div key={`${task.offset}-${task.title}`} className="rounded-xl border border-white/[0.06] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[9px] font-medium text-[#dcebe2]">{task.title}</p>
                  <span className="shrink-0 rounded bg-white/[0.05] px-1.5 py-0.5 text-[7px] text-[#93ad9f]">{formatJalali(task.date, "short")}</span>
                </div>
                <p className="mt-1 text-[8px] leading-4 text-[#93ad9f]">{task.detail}</p>
                {task.total ? <p className="mt-1 text-[7px] text-[#78968a]">مقدار: {toPersianDigits(task.total.toLocaleString("en-US"))} {task.unit} برای کل زمین</p> : null}
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="glass rounded-[22px] p-4">
        <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-white"><Leaf className="h-3.5 w-3.5 text-mint-300" /> همهٔ عملیات به ترتیب تاریخ</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-right text-[8px]">
            <thead className="text-[#78968a]">
              <tr className="border-b border-white/[0.06]">
                <th className="py-1.5 font-medium">تاریخ</th>
                <th className="py-1.5 font-medium">نوع</th>
                <th className="py-1.5 font-medium">کار</th>
                <th className="py-1.5 font-medium">مرحله</th>
                <th className="py-1.5 font-medium">مقدار (کل زمین)</th>
              </tr>
            </thead>
            <tbody>
              {season.tasks.map((task) => (
                <tr key={`${task.offset}-${task.kind}-${task.title}`} className="border-b border-white/[0.03] last:border-0">
                  <td className="py-1.5 text-[#dcebe2]">{formatJalali(task.date, "short")}</td>
                  <td className="py-1.5"><span className={cn("rounded px-1.5 py-0.5", TASK_STYLE[task.kind].chip)}>{TASK_LABELS[task.kind]}</span></td>
                  <td className="py-1.5 text-[#dcebe2]">{task.title}</td>
                  <td className="py-1.5 text-[#93ad9f]">{task.stage}</td>
                  <td className="py-1.5 text-[#93ad9f]">{task.total ? `${toPersianDigits(task.total.toLocaleString("en-US"))} ${task.unit}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 flex items-start gap-1 text-[7px] leading-4 text-[#6f8c7f]"><Droplets className="mt-0.5 h-2.5 w-2.5 shrink-0" /> دوزها راهنمای عمومی است؛ برچسب سم/کود و نظر کارشناس منطقه همیشه مقدم است.</p>
      </section>
    </div>
  );
}
