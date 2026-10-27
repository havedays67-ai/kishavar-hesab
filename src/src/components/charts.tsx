export function MonthlyBars({
  data,
  height = 150,
}: {
  data: { label: string; income: number; expense: number }[];
  height?: number;
}) {
  if (!data.length) {
    return <div className="grid h-36 place-items-center text-xs text-[#84907f]">داده‌ای برای نمایش نیست</div>;
  }
  const max = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1);
  return (
    <div>
      <div className="flex items-end justify-between gap-2" style={{ height }}>
        {data.map((d) => (
          <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div className="flex h-full w-full items-end justify-center gap-1">
              <div
                className="w-2.5 rounded-t-md bg-farm-500 sm:w-3.5"
                style={{ height: `${Math.max(3, (d.income / max) * 100)}%` }}
                title={`درآمد ${d.income}`}
              />
              <div
                className="w-2.5 rounded-t-md bg-clay-500/80 sm:w-3.5"
                style={{ height: `${Math.max(3, (d.expense / max) * 100)}%` }}
                title={`هزینه ${d.expense}`}
              />
            </div>
            <span className="truncate text-[9px] text-[#84907f] sm:text-[10px]">{d.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-[#6a7a6d]">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-farm-500" /> درآمد
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-clay-500" /> هزینه
        </span>
      </div>
    </div>
  );
}

const DONUT_COLORS = ["#256e2e", "#58a75c", "#c1743b", "#d8a24a", "#8aa9b8", "#9b7bb5", "#b56b6b", "#7d8f6a"];

export function Donut({
  data,
  size = 132,
  centerLabel,
  centerValue,
}: {
  data: { name: string; amount: number; share: number }[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const top = data.slice(0, 6);
  const total = top.reduce((a, d) => a + d.amount, 0) || 1;
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const segments = top.map((d, index) => {
    const portion = d.amount / total;
    const dash = portion * circumference;
    const start = top.slice(0, index).reduce((acc, item) => acc + (item.amount / total) * circumference, 0);
    return { name: d.name, dash, start, color: DONUT_COLORS[index % DONUT_COLORS.length] };
  });
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#eee9dc" strokeWidth={14} />
          {segments.map((segment) => (
            <circle
              key={segment.name}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={14}
              strokeDasharray={`${segment.dash} ${circumference - segment.dash}`}
              strokeDashoffset={-segment.start}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] text-[#84907f]">{centerLabel ?? "جمع"}</span>
          <span className="num text-xs font-bold text-farm-900">{centerValue ?? ""}</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {top.map((d, index) => (
          <li key={d.name} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: DONUT_COLORS[index % DONUT_COLORS.length] }}
              />
              <span className="truncate text-[#4a5a4c]">{d.name}</span>
            </span>
            <span className="num shrink-0 font-medium text-[#1d2a21]">{Math.round(d.share * 100)}٪</span>
          </li>
        ))}
        {!top.length ? <li className="text-xs text-[#84907f]">داده‌ای ثبت نشده است</li> : null}
      </ul>
    </div>
  );
}

export function AreaChart({
  points,
  height = 120,
  tone = "#256e2e",
}: {
  points: { label: string; value: number }[];
  height?: number;
  tone?: string;
}) {
  if (points.length < 2) {
    return <div className="grid h-28 place-items-center text-xs text-[#84907f]">برای نمودار حداقل دو دوره لازم است</div>;
  }
  const width = 320;
  const values = points.map((p) => p.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - ((p.value - min) / range) * (height - 16) - 8;
    return `${x},${y}`;
  });
  const line = `M${coords.join(" L")}`;
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tone} stopOpacity="0.28" />
            <stop offset="100%" stopColor={tone} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#areaFill)" />
        <path d={line} fill="none" stroke={tone} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="mt-1 flex justify-between text-[9px] text-[#84907f]">
        {points.map((p) => (
          <span key={p.label}>{p.label}</span>
        ))}
      </div>
    </div>
  );
}

export function HBar({
  rows,
}: {
  rows: { label: string; value: number; hint?: string }[];
}) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
            <span className="truncate text-[#4a5a4c]">{r.label}</span>
            <span className="num shrink-0 font-semibold text-farm-900">{r.hint}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#f1ede1]">
            <div
              className={`h-full rounded-full ${r.value >= 0 ? "bg-farm-500" : "bg-red-400"}`}
              style={{ width: `${(Math.abs(r.value) / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
      {!rows.length ? <li className="text-xs text-[#84907f]">داده‌ای نیست</li> : null}
    </ul>
  );
}
