import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, CalendarDays, CircleCheck, CloudRain, Droplets, FlaskConical, Leaf, Loader2, Search, ShieldAlert, Sparkles, Sprout, Sun, TrendingUp, X } from "lucide-react";
import { cn } from "../utils/cn";
import { formatAmount } from "../lib/money-format";
import { dateToJalali, formatJalali, JALALI_MONTHS, jalaliToDate, toPersianDigits, todayJalali, type JDate } from "../lib/format";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { SelectField, type SelectOption } from "../components/FormControls";
import { ProductPicker } from "../components/ProductPicker";
import { Modal } from "../components/ui";
import { ProfileLocationDialog } from "../components/ProfileLocationDialog";
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
import { cachedCropInsight, researchCrop, type CropInsight } from "../lib/ai/crop-research";
import { scoreCatalog } from "../lib/agronomy/crop-catalog";
import { guessClimate } from "../lib/agronomy/region";
import { checkProfile } from "../lib/profile-check";
import { verifyProfilePlace } from "../lib/ai/place-check";

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
const CLIMATE_OPTIONS: SelectOption[] = (Object.keys(CLIMATE_LABELS) as ClimateZone[]).map((id) => ({ value: id, label: CLIMATE_LABELS[id] }));
const SOIL_OPTIONS: SelectOption[] = (Object.keys(SOIL_LABELS) as SoilType[]).map((id) => ({ value: id, label: SOIL_LABELS[id] }));
const WATER_OPTIONS: SelectOption[] = (Object.keys(WATER_LABELS) as WaterSource[]).map((id) => ({ value: id, label: WATER_LABELS[id] }));

const TASK_STYLE: Record<TaskKind, { chip: string; dot: string }> = {
  prep: { chip: "bg-white/[0.06] text-[#b9cdc2]", dot: "#9fb6aa" },
  planting: { chip: "bg-mint-300/10 text-mint-300", dot: "#6ee7b7" },
  fertilizer: { chip: "bg-[#c5b97f]/10 text-[#d8c896]", dot: "#e3d39a" },
  spray: { chip: "bg-[#f0a59a]/10 text-[#f0a59a]", dot: "#f0a59a" },
  irrigation: { chip: "bg-[#60a5fa]/10 text-[#9cc4f5]", dot: "#93c5fd" },
  harvest: { chip: "bg-mint-400/15 text-[#a7f3d0]", dot: "#34d399" },
};

/** فاصلهٔ تقریبی تا پنجرهٔ کاشت از متن پنجره (اولین ماه شمسی که نام برده شده). */
function monthsUntilWindow(windowText: string, today: JDate): { months: number | null; label: string } {
  const index = JALALI_MONTHS.findIndex((month) => windowText.includes(month));
  if (index === -1) return { months: null, label: "پنجرهٔ کاشت را از جدول محصول ببین" };
  const targetMonth = index + 1;
  const months = (targetMonth - today.jm + 12) % 12;
  if (months === 0) return { months: 0, label: "همین الان داخل پنجرهٔ کاشت هستی" };
  return { months, label: `${toPersianDigits(months)} ماه دیگر` };
}

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

type SavedCropPlan = {
  cropId?: CropId;
  climate?: ClimateZone;
  soil?: SoilType;
  waterSource?: WaterSource;
  areaHa?: number;
  planting?: JDate | null;
  productMode?: "crop" | "other";
  otherName?: string;
  catalogQuery?: string;
  analyzed?: boolean;
  locationDeclined?: boolean;
  acceptedInsight?: CropInsight | null;
  aiBrief?: { state: "idle" | "ready" | "error"; text: string };
};

const CROP_PLAN_STORAGE = "kishavar.crop-plan.v1";

function readSavedPlan(key: string): SavedCropPlan | null {
  try {
    const raw = localStorage.getItem(`${CROP_PLAN_STORAGE}:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedCropPlan;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function addDays(date: JDate, days: number): JDate {
  const base = jalaliToDate(date);
  base.setDate(base.getDate() + days);
  return dateToJalali(base);
}

export function CropPlanPage() {
  const { profile, saveProfile, openOnboarding } = useProfile();
  const [cropId, setCropId] = useState<CropId>("wheat-irrigated");
  const [climate, setClimate] = useState<ClimateZone>(() => guessClimate(profile.province || profile.city));
  const [soil, setSoil] = useState<SoilType>("loam");
  const [waterSource, setWaterSource] = useState<WaterSource>("well");
  const [areaHa, setAreaHa] = useState(5);
  const [planting, setPlanting] = useState<JDate | null>(todayJalali());
  const [productMode, setProductMode] = useState<"crop" | "other">("crop");
  const [otherName, setOtherName] = useState("");
  const [pendingInsight, setPendingInsight] = useState<CropInsight | null>(null);
  const [acceptedInsight, setAcceptedInsight] = useState<CropInsight | null>(null);
  const [researchState, setResearchState] = useState<"idle" | "waiting" | "ready" | "notfound" | "error">("idle");
  const [researchMessage, setResearchMessage] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [analyzed, setAnalyzed] = useState(false);
  const [rescueOpen, setRescueOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [assistantStatus, setAssistantStatus] = useState("");
  const [locationDeclined, setLocationDeclined] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const storageKey = `${profile.province || "-"}|${profile.city || "-"}`;
  const [restored, setRestored] = useState(false);
  const [aiBrief, setAiBrief] = useState<{ state: "idle" | "loading" | "ready" | "error"; text: string }>({ state: "idle", text: "" });
  const [aiPlan, setAiPlan] = useState<{ state: "idle" | "loading" | "ready" | "error"; data: CropInsight | null; message: string }>({ state: "idle", data: null, message: "" });
  const planRequestRef = useRef(0);
  const skipAutoPlanRef = useRef(false);

  const crop = CROPS[cropId];
  const productValue = productMode === "other" ? otherName : crop.name.startsWith("گندم") ? "گندم" : crop.name;

  function chooseCrop(id: CropId) {
    setCropId(id);
    setProductMode("crop");
    setResearchState("idle");
  }

  function chooseProduct(name: string) {
    const clean = name.trim();
    if (!clean) return;
    if (clean === "گندم") {
      chooseCrop(waterSource === "rain" ? "wheat-rainfed" : "wheat-irrigated");
      setOtherName("");
      return;
    }
    const matched = (Object.keys(CROPS) as CropId[]).find((id) => CROPS[id].name === clean);
    if (matched) {
      chooseCrop(matched);
      setOtherName("");
      return;
    }
    setProductMode("other");
    setOtherName(clean);
    setResearchState("idle");
  }

  function announceReasoning(quick = false) {
    setAssistantStatus("کشاورزیار در حال استدلال اطلاعات بر اساس موقعیت مکانی شما است…");
    setNoticeOpen(true);
    if (quick) {
      window.setTimeout(() => setAssistantStatus((current) => (current.startsWith("کشاورزیار در حال استدلال") ? "استدلال تمام شد؛ نتیجه و امتیازها پایین آماده است." : current)), 2_500);
    }
  }

  async function requestSeasonPlan(force = false) {
    const token = ++planRequestRef.current;
    const name = crop.name.startsWith("گندم") ? "گندم" : crop.name;
    const options = { city: profile.city, province: profile.province, climate, today: formatJalali(todayJalali(), "long") };
    const cached = force ? null : cachedCropInsight(name, options);
    if (cached) {
      if (token !== planRequestRef.current) return;
      setAiPlan({ state: "ready", data: cached, message: "" });
      setAiBrief({ state: "ready", text: cached.summary || `تقویم ${cached.name} بر پایهٔ منطقه و تاریخ کاشت آماده است.` });
      setAssistantStatus(`تقویم ${cached.name} برای ${[profile.city, profile.province].filter(Boolean).join("، ") || "منطقهٔ شما"} آماده است.`);
      return;
    }
    if (token !== planRequestRef.current) return;
    setAiPlan({ state: "loading", data: null, message: "" });
    setAssistantStatus(`کشاورزیار دارد تقویم ${name} را برای منطقه، خاک، آب و تاریخ کاشت شما استدلال می‌کند…`);
    const result = await researchCrop(name, options);
    if (token !== planRequestRef.current) return;
    if (result.ok) {
      setAiPlan({ state: "ready", data: result.data, message: "" });
      setAiBrief({ state: "ready", text: result.data.summary || `تقویم ${result.data.name} بر پایهٔ منطقه و داده‌های زمین آماده است.` });
      setAssistantStatus(`استدلال تقویم ${result.data.name} تمام شد؛ برنامهٔ پایین بر پایهٔ منطقه، تاریخ کاشت و داده‌های زمین است.`);
    } else {
      setAiPlan({ state: "error", data: null, message: result.message });
      setAssistantStatus("استدلال آنلاین تقویم الان ممکن نشد؛ برنامهٔ محاسباتی پایه نمایش داده می‌شود.");
    }
  }


  async function beginAnalysis() {
    if (verifying) return;
    setVerifying(true);
    const check = checkProfile(profile);
    if (check.personalIssue) {
      setAssistantStatus("برای شروع، نام و شمارهٔ پروفایل را کامل کن.");
      openOnboarding();
      setVerifying(false);
      return;
    }
    if (check.locationIssue && !locationDeclined) {
      setRescueOpen(true);
      setVerifying(false);
      return;
    }
    setAssistantStatus("کشاورزیار دارد اطلاعات منطقه را بررسی می‌کند…");
    if (!locationDeclined) {
      const place = await verifyProfilePlace(profile.province, profile.city);
      if (place === "not-found") {
        setAssistantStatus("اطلاعات منطقه در سرویس‌های نقشه پیدا نشد؛ لطفاً تأیید کن.");
        setRescueOpen(true);
        setVerifying(false);
        return;
      }
    }
    skipAutoPlanRef.current = !analyzed;
    setAnalyzed(true);
    announceReasoning(true);
    setVerifying(false);
    void requestSeasonPlan(true);
  }

  async function runResearch() {
    const name = otherName.trim();
    if (name.length < 2) {
      setResearchMessage("نام محصول را کامل بنویس.");
      setResearchState("error");
      return;
    }
    const cached = cachedCropInsight(name, { city: profile.city, province: profile.province, climate, today: formatJalali(todayJalali(), "long") });
    if (cached) {
      setPendingInsight(cached);
      setResearchState("ready");
      return;
    }
    setPendingInsight(null);
    setResearchMessage("");
    setResearchState("waiting");
    setAssistantStatus("کشاورزیار در حال استدلال اطلاعات بر اساس موقعیت مکانی شما است…");
    announceReasoning(false);
    const result = await researchCrop(name, {
      city: profile.city,
      province: profile.province,
      climate: CLIMATE_LABELS[climate],
      today: formatJalali(todayJalali(), "long"),
    });
    setAssistantStatus("");
    if (result.ok) {
      setPendingInsight(result.data);
      setResearchState("ready");
    } else if (result.kind === "irrelevant") {
      setResearchMessage("درخواست شما یافت نشد");
      setResearchState("notfound");
    } else {
      setResearchMessage(result.message || "استدلال محصول الان ممکن نیست؛ کمی بعد دوباره تلاش کن.");
      setResearchState("error");
    }
  }

  useEffect(() => {
    const saved = readSavedPlan(storageKey);
    if (saved) {
      if (saved.cropId && CROPS[saved.cropId]) setCropId(saved.cropId);
      if (saved.climate && CLIMATE_LABELS[saved.climate]) setClimate(saved.climate);
      if (saved.soil && SOIL_LABELS[saved.soil]) setSoil(saved.soil);
      if (saved.waterSource && WATER_LABELS[saved.waterSource]) setWaterSource(saved.waterSource);
      if (typeof saved.areaHa === "number" && saved.areaHa > 0) setAreaHa(saved.areaHa);
      if (saved.planting && typeof saved.planting === "object") setPlanting(saved.planting);
      if (saved.productMode === "crop" || saved.productMode === "other") setProductMode(saved.productMode);
      if (typeof saved.otherName === "string") setOtherName(saved.otherName);
      if (typeof saved.catalogQuery === "string") setCatalogQuery(saved.catalogQuery);
      if (saved.analyzed) {
        setAnalyzed(true);
        setAssistantStatus("استدلال تمام شد؛ نتیجه و امتیازها پایین آماده است.");
      }
      if (saved.locationDeclined) setLocationDeclined(true);
      if (saved.acceptedInsight && Array.isArray(saved.acceptedInsight.tasks)) setAcceptedInsight(saved.acceptedInsight);
      if (saved.aiBrief && (saved.aiBrief.state === "ready" || saved.aiBrief.state === "error")) setAiBrief(saved.aiBrief);
    }
    setRestored(true);
  }, [storageKey]);

  useEffect(() => {
    if (!restored) return;
    const payload: SavedCropPlan = {
      cropId, climate, soil, waterSource, areaHa, planting, productMode, otherName, catalogQuery,
      analyzed, locationDeclined, acceptedInsight,
      aiBrief: aiBrief.state === "ready" ? { state: "ready", text: aiBrief.text } : aiBrief.state === "error" ? { state: "error", text: aiBrief.text } : { state: "idle", text: "" },
    };
    try {
      localStorage.setItem(`${CROP_PLAN_STORAGE}:${storageKey}`, JSON.stringify(payload));
    } catch {
      /* حافظهٔ دستگاه پر است؛ صفحه همچنان کار می‌کند. */
    }
  }, [restored, storageKey, cropId, climate, soil, waterSource, areaHa, planting, productMode, otherName, catalogQuery, analyzed, locationDeclined, acceptedInsight, aiBrief]);

  useEffect(() => {
    if (!analyzed) return;
    if (skipAutoPlanRef.current) {
      skipAutoPlanRef.current = false;
      return;
    }
    void requestSeasonPlan();
    // استدلال فقط با تغییر محصول/منطقه یا تحلیل تازه انجام می‌شود؛ تغییر خاک/آب/مساحت تقویم ذخیره‌شده را بی‌دلیل نمی‌سوزاند.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyzed, cropId, productMode, otherName, profile.city, profile.province]);

  const farm: FarmProfile = {
    region: [profile.city, profile.province].filter(Boolean).join("، ") || "منطقهٔ شما",
    climate,
    areaHa: Math.max(0.1, areaHa),
    soil,
    waterSource,
    season: "autumn",
  };

  const plan = useMemo(() => planCrop(cropId, farm), [cropId, climate, soil, waterSource, areaHa, profile.city, profile.province]);
  const season = useMemo(() => {
    const date = planting ?? todayJalali();
    const schedule = CROP_SCHEDULES[cropId];
    const harvestOffset = Math.round((crop.daysToHarvest[0] + crop.daysToHarvest[1]) / 2);
    return buildSeasonPlan(cropId, crop.name, date, Math.max(0.1, areaHa), crop.waterNeedMm / Math.max(0.1, areaHa) / 10 * Math.max(0.1, areaHa), {
      plantingWindowDays: schedule.plantingWindowDays,
      daysToHarvest: harvestOffset,
    });
  }, [cropId, crop, areaHa, planting]);

  const catalog = useMemo(() => scoreCatalog(farm, todayJalali().jm), [climate, soil, waterSource, areaHa, profile.city, profile.province]);
  const filteredCatalog = useMemo(() => {
    const query = catalogQuery.trim();
    return query ? catalog.filter((item) => `${item.name} ${item.category}`.includes(query)) : catalog;
  }, [catalog, catalogQuery]);
  const bestWindow = useMemo(() => monthsUntilWindow(crop.windows[climate], todayJalali()), [crop, climate]);

  const groups = useMemo(() => {
    const fertilizer = season.tasks.filter((task) => task.kind === "fertilizer");
    const spray = season.tasks.filter((task) => task.kind === "spray");
    return { fertilizer, spray };
  }, [season]);

  const aiData = aiPlan.state === "ready" && aiPlan.data ? aiPlan.data : null;
  const aiTasks = useMemo(() => {
    if (!aiData || aiData.tasks.length === 0) return null;
    return aiData.tasks
      .filter((task) => task && typeof task.day === "number" && task.kind)
      .map((task) => ({
        offset: Math.max(0, Math.round(task.day)),
        date: addDays(season.planting, Math.max(0, Math.round(task.day))),
        kind: task.kind,
        title: task.title,
        detail: task.detail,
        stage: TASK_LABELS[task.kind] ?? "",
        total: undefined as number | undefined,
        unit: "",
      }));
  }, [aiData, season.planting]);
  const displayTasks = aiTasks ?? season.tasks;
  const displayDuration = aiData?.harvestDays && aiData.harvestDays >= 20 ? Math.round(aiData.harvestDays) : season.durationDays;
  const displayHarvest = aiData?.harvestDays && aiData.harvestDays >= 20 ? addDays(season.planting, Math.round(aiData.harvestDays)) : season.harvest;
  const displayWaterM3 = aiData?.waterMm && aiData.waterMm > 0 ? Math.round(aiData.waterMm * Math.max(0.1, areaHa)) : season.waterM3;
  const displayFertilizer = aiData ? displayTasks.filter((task) => task.kind === "fertilizer") : groups.fertilizer;
  const displaySpray = aiData ? displayTasks.filter((task) => task.kind === "spray") : groups.spray;
  const riskItems = [...(aiData?.risks ?? []), ...plan.risks].slice(0, 5);

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

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <div className="sm:col-span-2">
            <ProductPicker label="محصول" value={productValue} onChange={chooseProduct} categories={["غلات", "دانه‌های روغنی", "نباتات علوفه‌ای", "سبزیجات", "صیفی‌جات", "میوه و درخت", "حبوبات", "صنعتی و نقدی"]} />
          </div>
          <SelectField label="اقلیم منطقه" value={climate} options={CLIMATE_OPTIONS} onChange={(next) => setClimate(next as ClimateZone)} />
          <SelectField label="خاک" value={soil} options={SOIL_OPTIONS} onChange={(next) => setSoil(next as SoilType)} />
          <SelectField label="منبع آب" value={waterSource} options={WATER_OPTIONS} onChange={(next) => setWaterSource(next as WaterSource)} />
          <div>
            <div className="label">مساحت (هکتار)</div>
            <input type="number" min={0.1} step={0.1} value={areaHa} onChange={(event) => setAreaHa(Number(event.target.value) || 0.1)} className="field w-full py-2 text-[10px]" />
          </div>
        </div>
        <p className="mt-2 rounded-lg bg-white/[0.025] px-2.5 py-1.5 text-[8px] leading-4 text-[#93ad9f]">
          مبنای امتیازدهی: اقلیم <span className="text-[#dcebe2]">{CLIMATE_LABELS[climate]}</span>، خاک <span className="text-[#dcebe2]">{SOIL_LABELS[soil]}</span>، منبع آب <span className="text-[#dcebe2]">{WATER_LABELS[waterSource]}</span>، {toPersianDigits(areaHa)} هکتار
          {profile.city ? <> — منطقهٔ <span className="text-[#dcebe2]">{profile.city}</span></> : <> — <span className="text-sand-300">شهر پروفایل خالی است؛ برای امتیاز دقیق‌تر آن را تکمیل کن</span></>}
          . هیچ نتیجه‌ای از قبل ذخیره نشده و همه‌چیز با همین مقادیر محاسبه می‌شود.
        </p>
        {!analyzed && (
          <button type="button" onClick={() => void beginAnalysis()} disabled={verifying} className="mt-2 w-full rounded-xl bg-mint-300 px-3 py-2.5 text-[10px] font-semibold text-[#10201a] disabled:opacity-60">
            {verifying ? "در حال بررسی اطلاعات منطقه…" : profile.city ? `تحلیل زمین ${profile.city} و امتیازدهی همهٔ محصولات` : "تحلیل زمین و امتیازدهی همهٔ محصولات"}
          </button>
        )}
        {assistantStatus && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-mint-300/20 bg-mint-300/[0.05] px-2.5 py-2 text-[8px] leading-4 text-mint-300">
            {assistantStatus.startsWith("استدلال تمام") ? <CircleCheck className="h-3.5 w-3.5 shrink-0" /> : <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />}
            <span>{assistantStatus}</span>
          </div>
        )}
        {analyzed && profile.city && guessClimate(profile.province || profile.city) !== climate && (
          <p className="mt-2 rounded-xl border border-sand-300/25 bg-sand-300/[0.05] px-2.5 py-2 text-[8px] leading-4 text-[#e6dcc0]">
            مشخصات انتخابی با منطقهٔ «{profile.city}» هم‌خوان نیست؛ اقلیم را اصلاح کن تا امتیازها دقیق‌تر شود.
          </p>
        )}
        {productMode === "other" && (
          <div className="mt-2 flex flex-col gap-1.5 rounded-xl border border-sand-300/20 bg-sand-300/[0.04] p-2 sm:flex-row sm:items-center">
            <p className="flex-1 text-[8px] leading-4 text-[#b9ad84]">محصول در فهرست ثابت نیست؛ نامش را داخل کادر بالا بنویس، بعد استدلال را اجرا کن.</p>
            <button type="button" onClick={() => void runResearch()} disabled={researchState === "waiting"} className="rounded-xl bg-sand-300 px-3 py-2 text-[9px] font-semibold text-[#1d2a24] disabled:opacity-60">
              {researchState === "waiting" ? "در حال استدلال…" : "استدلال و ساخت تقویم"}
            </button>
          </div>
        )}
        <div className="mt-2 max-w-[240px]">
          <JalaliDatePicker label="تاریخ کاشت" value={planting} onChange={setPlanting} />
        </div>
      </section>

      {acceptedInsight && (
        <section className="glass rounded-[22px] border border-mint-300/20 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-1.5 text-[11px] font-semibold text-white"><BadgeCheck className="h-3.5 w-3.5 text-mint-300" /> تقویم اختصاصی {acceptedInsight.name}</h2>
              <p className="mt-0.5 text-[8px] text-[#78968a]">نتیجهٔ استدلال برای محصولی که در فهرست ثابت نبود؛ اعتبار: {acceptedInsight.confidence}</p>
            </div>
            <button type="button" onClick={() => setAcceptedInsight(null)} className="rounded-lg border border-white/[0.08] p-1 text-[#78968a] hover:text-white" aria-label="بستن تقویم اختصاصی"><X className="h-3.5 w-3.5" /></button>
          </div>
          <p className="text-[9px] leading-5 text-[#dcebe2]">{acceptedInsight.summary || "برآورد اولیه بر پایهٔ اقلیم و داده‌های موجود."}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/[0.06] p-2.5"><p className="text-[7px] text-[#78968a]">پنجرهٔ کاشت</p><p className="mt-0.5 text-[9px] text-[#dcebe2]">{acceptedInsight.sowing || "بستگی به اقلیم منطقه"}</p></div>
            <div className="rounded-xl border border-white/[0.06] p-2.5"><p className="text-[7px] text-[#78968a]">طول فصل</p><p className="mt-0.5 text-[9px] text-[#dcebe2]">{toPersianDigits(acceptedInsight.harvestDays)} روز</p></div>
            <div className="rounded-xl border border-white/[0.06] p-2.5"><p className="text-[7px] text-[#78968a]">آب مورد نیاز</p><p className="mt-0.5 text-[9px] text-[#dcebe2]">{toPersianDigits(acceptedInsight.waterMm)} میلی‌متر</p></div>
            <div className="rounded-xl border border-white/[0.06] p-2.5"><p className="text-[7px] text-[#78968a]">آبیاری</p><p className="mt-0.5 text-[9px] text-[#dcebe2]">{acceptedInsight.irrigation || "بر پایهٔ رطوبت خاک"}</p></div>
          </div>
          {acceptedInsight.fertilizer && <p className="mt-2 rounded-xl border border-[#c5b97f]/20 bg-[#c5b97f]/[0.05] p-2.5 text-[8px] leading-4 text-[#e3d39a]">کوددهی: {acceptedInsight.fertilizer}</p>}
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            <div className="rounded-xl border border-white/[0.06] p-2.5">
              <p className="mb-1 text-[8px] font-semibold text-white">عملیات پیشنهادی</p>
              {acceptedInsight.tasks.length === 0 ? <p className="text-[8px] text-[#78968a]">عملیات تفصیلی در دسترس نیست؛ با کارشناس محلی مشورت کن.</p> : acceptedInsight.tasks.map((task, index) => (
                <div key={`${task.title}-${index}`} className="border-b border-white/[0.04] py-1.5 last:border-0">
                  <p className="text-[8px] text-[#dcebe2]">روز {toPersianDigits(task.day)} — {task.title}</p>
                  <p className="text-[7px] leading-4 text-[#93ad9f]">{task.detail}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {acceptedInsight.risks.length > 0 && (
                <div className="rounded-xl border border-[#f0a59a]/20 bg-[#f0a59a]/[0.04] p-2.5">
                  <p className="mb-1 text-[8px] font-semibold text-[#f0a59a]">ریسک‌ها</p>
                  {acceptedInsight.risks.map((risk, index) => <p key={index} className="text-[7px] leading-4 text-[#d7b8b2]">• {risk}</p>)}
                </div>
              )}
              {acceptedInsight.weather && (
                <div className="rounded-xl border border-[#60a5fa]/20 bg-[#60a5fa]/[0.04] p-2.5">
                  <p className="mb-1 flex items-center gap-1 text-[8px] font-semibold text-[#9cc4f5]"><CloudRain className="h-3 w-3" /> هوای مزرعه</p>
                  <p className="max-h-24 overflow-y-auto whitespace-pre-line text-[7px] leading-4 text-[#b9cdc2]">{acceptedInsight.weather}</p>
                </div>
              )}
            </div>
          </div>
          <p className="mt-2 text-[7px] leading-4 text-[#6f8c7f]">این تقویم برآورد است؛ برای دوز نهاده و تاریخ قطعی، برچسب محصول و نظر کارشناس منطقه مقدم است.</p>
        </section>
      )}

      <div className={cn("space-y-4", !analyzed && "hidden")}>
      <section className="glass rounded-[22px] border border-mint-300/20 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-[11px] font-semibold text-white"><Sparkles className="h-3.5 w-3.5 text-mint-300" /> تحلیل کشاورزیار برای زمین شما</h2>
          <div className="flex items-center gap-1.5">
            <span className="rounded-lg bg-white/[0.04] px-2 py-1 text-[7px] text-[#93ad9f]">کش ذخیره‌شده تا ۷ روز</span>
            <button type="button" onClick={() => void requestSeasonPlan(true)} disabled={aiPlan.state === "loading"} className="rounded-lg border border-mint-300/20 bg-mint-300/[0.06] px-2 py-1 text-[7px] text-mint-300 disabled:opacity-50">استدلال دوباره</button>
          </div>
        </div>
        {aiPlan.state === "loading" ? (
          <p className="flex items-center gap-2 text-[8px] leading-4 text-mint-300"><Loader2 className="h-3 w-3 animate-spin" /> کشاورزیار دارد تقویم کامل {crop.name} را برای منطقه، خاک، آب و تاریخ کاشت شما استدلال می‌کند…</p>
        ) : aiData ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded bg-mint-300/10 px-1.5 py-0.5 text-[7px] text-mint-300">تقویم استدلال‌شده برای {[profile.city, profile.province].filter(Boolean).join("، ") || "منطقهٔ شما"}</span>
              <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[7px] text-[#93ad9f]">{aiData.engine === "local-fallback" ? "پاسخ پشتیبان منطقه‌ای" : "استدلال زنده با دادهٔ منطقه و تاریخ"}</span>
            </div>
            <p className="whitespace-pre-line text-[9px] leading-5 text-[#dcebe2]">{aiData.summary}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-white/[0.06] p-2"><p className="text-[7px] text-[#78968a]">پنجرهٔ کاشت</p><p className="mt-0.5 text-[8px] leading-4 text-[#dcebe2]">{aiData.sowing || "—"}</p></div>
              <div className="rounded-lg border border-white/[0.06] p-2"><p className="text-[7px] text-[#78968a]">کوددهی</p><p className="mt-0.5 text-[8px] leading-4 text-[#dcebe2]">{aiData.fertilizer || "—"}</p></div>
              <div className="rounded-lg border border-white/[0.06] p-2"><p className="text-[7px] text-[#78968a]">آبیاری</p><p className="mt-0.5 text-[8px] leading-4 text-[#dcebe2]">{aiData.irrigation || "—"}</p></div>
            </div>
            <p className="text-[7px] leading-4 text-[#78968a]">تاریخ‌های خط زمانی، کوددهی و سم‌پاشی پایین از همین استدلال و برای تاریخ کاشت {formatJalali(season.planting, "long")} ساخته شده‌اند.</p>
          </div>
        ) : aiBrief.state === "ready" ? (
          <p className="whitespace-pre-line text-[9px] leading-5 text-[#dcebe2]">{aiBrief.text}</p>
        ) : aiPlan.state === "error" ? (
          <p className="text-[8px] leading-4 text-[#e3d39a]">استدلال آنلاین تقویم انجام نشد ({aiPlan.message || "خطای موقت"})؛ برنامهٔ پایین از محاسبهٔ منطقه‌ای پایه ساخته شده و «استدلال‌شده» نیست.</p>
        ) : aiBrief.state === "error" ? (
          <p className="text-[8px] leading-4 text-[#e3d39a]">{aiBrief.text}</p>
        ) : (
          <p className="text-[8px] leading-4 text-[#93ad9f]">با زدن «تحلیل زمین»، استدلال زندهٔ کشاورزیار برای همین منطقه و ماه اینجا نمایش داده می‌شود.</p>
        )}
      </section>

      <section className="glass rounded-[22px] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-1.5 text-[11px] font-semibold text-white"><Sparkles className="h-3.5 w-3.5 text-mint-300" /> چه بکارم؟ — ۳ پیشنهاد برتر بر پایهٔ منطقه، ماه و زمین</h2>
            <p className="mt-0.5 text-[8px] text-[#78968a]">بر پایهٔ منطقه، ماه {JALALI_MONTHS[Math.max(0, Math.min(11, todayJalali().jm - 1))]}، اقلیم {CLIMATE_LABELS[climate]}، خاک {SOIL_LABELS[soil]}، منبع {WATER_LABELS[waterSource]} و {toPersianDigits(areaHa)} هکتار؛ همه از فهرست کامل {toPersianDigits(catalog.length)} محصول.</p>
          </div>
          <span className="rounded-lg bg-white/[0.04] px-2 py-1 text-[7px] text-[#93ad9f]">کِی بکارم؟ {bestWindow.label}</span>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {catalog.slice(0, 3).map((item, index) => (
            <button
              key={item.name}
              type="button"
              onClick={() => chooseProduct(item.name)}
              className={cn("rounded-xl border p-2.5 text-right transition", productValue === item.name ? "border-mint-300/40 bg-mint-300/[0.07]" : "border-white/[0.06] hover:border-white/15")}
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-semibold text-white">{toPersianDigits(index + 1)}. {item.name}</span>
                <span className={cn("rounded px-1.5 py-0.5 text-[7px]", item.score >= 75 ? "bg-mint-300/10 text-mint-300" : item.score >= 50 ? "bg-sand-300/10 text-sand-300" : "bg-[#f87171]/10 text-[#f0a59a]")}>{toPersianDigits(item.score)}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                <div className={cn("h-full rounded-full", item.score >= 75 ? "bg-mint-400" : item.score >= 50 ? "bg-sand-300" : "bg-[#f0a59a]")} style={{ width: `${Math.max(4, item.score)}%` }} />
              </div>
              <p className="mt-1.5 text-[7px] leading-4 text-[#93ad9f]">کاشت: {item.window}</p>
              <p className="mt-1 text-[7px] leading-4 text-[#78968a]">{item.note}</p>
              <p className="mt-1 text-[7px] text-[#6f8c7f]">{productValue === item.name ? <span className="text-mint-300">همین حالا انتخاب شده</span> : "برای دیدن تحلیل و تقویم، بزن"}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="glass rounded-[22px] p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-1.5 text-[11px] font-semibold text-white"><Leaf className="h-3.5 w-3.5 text-mint-300" /> رتبه‌بندی همهٔ محصولات برای زمین شما</h2>
            <p className="mt-0.5 text-[8px] text-[#78968a]">{toPersianDigits(catalog.length)} محصول از فهرست کامل، با همین اقلیم/خاک/آب امتیاز خورده‌اند؛ روی هر کدام بزن تا تحلیل کاملش را ببینی.</p>
          </div>
          <span className="rounded-lg bg-white/[0.04] px-2 py-1 text-[7px] text-[#93ad9f]">زنده و بدون ذخیرهٔ قبلی</span>
        </div>
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#78968a]" />
          <input value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder="جست‌وجو در همهٔ محصولات…" className="field w-full py-2 pr-8 text-[10px]" />
        </div>
        <div className="max-h-[380px] space-y-1 overflow-y-auto pl-0.5">
          {filteredCatalog.map((item, index) => (
            <button key={item.name} type="button" onClick={() => chooseProduct(item.name)} className={cn("flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-right transition", item.score >= 75 ? "border-mint-300/20 bg-mint-300/[0.045] hover:border-mint-300/40" : item.score >= 50 ? "border-sand-300/15 bg-sand-300/[0.025] hover:border-sand-300/35" : "border-white/[0.05] hover:border-white/15")}>
              <span className={cn("grid h-7 w-9 shrink-0 place-items-center rounded-lg text-[9px] font-bold", item.score >= 75 ? "bg-mint-300/15 text-mint-300" : item.score >= 50 ? "bg-sand-300/10 text-sand-300" : "bg-white/[0.04] text-[#8da79a]")}>{toPersianDigits(item.score)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[9px] font-medium text-[#eef8f2]"><span className="truncate">{toPersianDigits(index + 1)}. {item.name}</span><span className="shrink-0 rounded bg-white/[0.05] px-1 py-0.5 text-[6.5px] font-normal text-[#8da79a]">{item.category}</span></span>
                <span className="mt-0.5 block truncate text-[7px] text-[#93ad9f]">پنجره: {item.window} — {item.note}</span>
              </span>
              <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[6.5px]", item.verdict === "مناسب" ? "bg-mint-300/10 text-mint-300" : item.verdict === "با احتیاط" ? "bg-sand-300/10 text-sand-300" : "bg-[#f0a59a]/10 text-[#f0a59a]")}>{item.verdict}</span>
            </button>
          ))}
          {filteredCatalog.length === 0 && <p className="py-4 text-center text-[9px] text-[#78968a]">محصولی با این نام در فهرست پیدا نشد؛ از کادر «محصول» نام دلخواه را ثبت کن.</p>}
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
              <p className="text-[8px] leading-4 text-[#93ad9f]">آب لازم: <span className="text-[#dcebe2]">{toPersianDigits(displayWaterM3.toLocaleString("en-US"))} متر مکعب</span></p>
            </div>
          </div>
          {season.windowWarning && (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-[#c5b97f]/25 bg-[#c5b97f]/[0.06] px-2 py-1.5 text-[8px] leading-4 text-[#e3d39a]"><ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />{season.windowWarning}</p>
          )}
          <div className="mt-3 space-y-1.5">
            {riskItems.slice(0, 4).map((risk) => <p key={risk} className="text-[8px] leading-4 text-[#a9c1b5]">• {risk}</p>)}
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
              <p className="text-[11px] font-semibold text-white">{toPersianDigits(displayDuration)} روز</p>
              <p className="mt-0.5 text-[7px] text-[#6f8c7f]">برداشت: {formatJalali(displayHarvest, "long")}</p>
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
            <Bar label="آب مورد نیاز فصل (متر مکعب)" value={displayWaterM3} max={Math.max(displayWaterM3, plan.water.availableM3 ?? 0) || 1} tone="bg-[#60a5fa]" />
            {plan.water.availableM3 !== null && <Bar label="آب در دسترس (متر مکعب)" value={plan.water.availableM3} max={Math.max(displayWaterM3, plan.water.availableM3) || 1} tone="bg-mint-400" />}
          </div>
        </section>
      </div>

      <section className="glass rounded-[22px] p-4">
        <h2 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-white"><Sun className="h-3.5 w-3.5 text-mint-300" /> خط زمانی فصل</h2>
        <p className="mb-2 text-[8px] text-[#78968a]">هر نقطه یک عملیات است؛ رنگ = نوع کار.</p>
        <SeasonTimeline start={season.planting} duration={displayDuration} tasks={displayTasks.map((task) => ({ offset: task.offset, kind: task.kind, title: task.title }))} />
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
            {displayFertilizer.length === 0 && aiData && <p className="text-[8px] leading-4 text-[#93ad9f]">در تقویم استدلال‌شدهٔ این محصول برای این منطقه، عملیات کوددهی جداگانه‌ای ذکر نشده؛ جزئیات را از کارشناس محلی بگیر.</p>}
            {displayFertilizer.map((task) => (
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
            {displaySpray.length === 0 && aiData && <p className="text-[8px] leading-4 text-[#93ad9f]">در تقویم استدلال‌شدهٔ این محصول برای این منطقه، سم‌پاشی جداگانه‌ای ذکر نشده؛ پایش مزرعه را جدی بگیر.</p>}
            {displaySpray.map((task) => (
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
              {displayTasks.map((task) => (
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

      {["ready", "notfound", "error"].includes(researchState) && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-[22px] border border-white/10 bg-[#101c17] p-4 shadow-2xl">
            {researchState === "ready" && pendingInsight && (
              <div>
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-mint-300/10 text-mint-300"><BadgeCheck className="h-4 w-4" /></span>
                  <div><h3 className="text-[12px] font-semibold text-white">استدلال تمام شد، نتیجه آماده است</h3><p className="text-[8px] text-[#78968a]">{pendingInsight.name} — اعتبار {pendingInsight.confidence}</p></div>
                </div>
                <p className="mt-2 text-[9px] leading-5 text-[#dcebe2]">{pendingInsight.summary || "تقویم پیشنهادی آماده است."}</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => { setAcceptedInsight(pendingInsight); setPendingInsight(null); setResearchState("idle"); }} className="flex-1 rounded-xl bg-mint-300 px-3 py-2 text-[10px] font-semibold text-[#10201a]">تایید</button>
                  <button type="button" onClick={() => { setPendingInsight(null); setResearchState("idle"); }} className="rounded-xl border border-white/10 px-3 py-2 text-[10px] text-[#a9c1b5]">انصراف</button>
                </div>
              </div>
            )}
            {(researchState === "notfound" || researchState === "error") && (
              <div className="text-center">
                <h3 className="text-[12px] font-semibold text-white">{researchState === "notfound" ? "درخواست شما یافت نشد" : "استدلال انجام نشد"}</h3>
                <p className="mt-1 text-[9px] leading-5 text-[#93ad9f]">{researchMessage}</p>
                <button type="button" onClick={() => setResearchState("idle")} className="mt-3 rounded-xl border border-white/10 px-4 py-2 text-[10px] text-[#a9c1b5]">بستن</button>
              </div>
            )}
          </div>
        </div>
      )}
      <Modal open={noticeOpen} onClose={() => setNoticeOpen(false)} title="کشاورزیار در حال استدلال" size="sm">
        <div className="p-5 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-mint-300/10 text-mint-300"><Loader2 className="h-5 w-5 animate-spin" /></span>
          <h3 className="mt-3 text-[12px] font-semibold text-white">اطلاعات بر اساس موقعیت مکانی شما بررسی می‌شود</h3>
          <p className="mt-1.5 text-[9px] leading-5 text-[#93ad9f]">کشاورزیار مشخصات زمین، اقلیم و محصولات را با منطقهٔ شما تطبیق می‌دهد. بستن این پنجره استدلال را متوقف نمی‌کند و وضعیت پایین همین صفحه نوشته می‌ماند.</p>
          <button type="button" onClick={() => setNoticeOpen(false)} className="mt-3 w-full rounded-xl bg-mint-300 px-3 py-2.5 text-[10px] font-semibold text-[#10201a]">متوجه شدم</button>
        </div>
      </Modal>

      <ProfileLocationDialog
        open={rescueOpen}
        personalIssue={checkProfile(profile).personalIssue}
        onClose={() => setRescueOpen(false)}
        onReject={() => { setRescueOpen(false); setLocationDeclined(true); setAnalyzed(true); announceReasoning(true); }}
        onResolved={(place) => {
          const province = place.province || profile.province;
          const city = place.city || place.village || profile.city;
          saveProfile({ ...profile, province, city, address: profile.address || place.display });
          setLocationDeclined(false);
          setClimate(guessClimate(province || city));
          setRescueOpen(false);
          setAnalyzed(true);
          announceReasoning(true);
        }}
      />
    </div>
  );
}
