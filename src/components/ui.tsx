import type { ReactNode } from "react";
import { formatMoney, formatMoneyWords } from "@/lib/format";

/* --------------------------------- icons --------------------------------- */

const ICON_PATHS: Record<string, ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>,
  land: <><path d="M3 6 9 3l6 3 6-3v15l-6 3-6-3-6 3z" /><path d="M9 3v15M15 6v15" /></>,
  sprout: <><path d="M12 21v-8" /><path d="M12 13C12 8 8 5 4 5c0 5 3 8 8 8Z" /><path d="M12 13c0-4 4-7 8-7 0 4-3 7-8 7Z" /></>,
  receipt: <><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" /><path d="M9 8h6M9 12h6" /></>,
  box: <><path d="M3 7 12 3l9 4-9 4z" /><path d="M3 7v10l9 4 9-4V7" /><path d="M12 11v10" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 5.5a3 3 0 0 1 0 5.5M18 20c0-2.5-.9-4.3-2.5-5.5" /></>,
  tractor: <><path d="M4 16h4l1-6h6l1 6h4" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M15 10V6h4v4" /></>,
  wallet: <><path d="M3 7h15a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H5a2 2 0 0 1-2-2z" /><path d="M3 7V6a2 2 0 0 1 2-2h11v3" /><circle cx="17" cy="13.5" r="1" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  sparkles: <><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M18 15l.9 2.3 2.3.9-2.3.9L18 21.4l-.9-2.3-2.3-.9 2.3-.9z" /></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 1-2-2z" /><path d="M20 5a2 2 0 0 0-2-2h-5v18h5a2 2 0 0 0 2-2z" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 13.7H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  check: <><path d="M20 6 9 17l-5-5" /></>,
  alert: <><path d="M12 3 2 21h20z" /><path d="M12 9v5M12 18h.01" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 11h18" /></>,
  arrow: <><path d="M19 12H5" /><path d="m12 5-7 7 7 7" /></>,
  phone: <path d="M5 3h3l2 5-2 1a12 12 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2Z" />,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  bolt: <path d="M13 2 5 14h6l-1 8 8-12h-6z" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
};

export function Icon({
  name,
  className = "h-5 w-5",
  strokeWidth = 1.7,
}: {
  name: keyof typeof ICON_PATHS | string;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {ICON_PATHS[name] ?? ICON_PATHS.sprout}
    </svg>
  );
}

/* --------------------------------- surfaces -------------------------------- */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon ? (
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-farm-700 text-white shadow-sm">
            <Icon name={icon} className="h-5 w-5" />
          </span>
        ) : null}
        <div>
          <h1 className="text-lg font-extrabold text-farm-900 sm:text-xl">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-xs text-[#66766a] sm:text-sm">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "farm",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "farm" | "clay" | "slate" | "red";
  icon?: string;
}) {
  const tones = {
    farm: "bg-farm-50 text-farm-700 border-farm-100",
    clay: "bg-[#fdf2e7] text-clay-600 border-[#f6e3cf]",
    slate: "bg-sand-100 text-[#5b6a5e] border-sand-200",
    red: "bg-red-50 text-red-700 border-red-100",
  } as const;
  return (
    <div className="card card-pad">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-[#6a7a6d]">{label}</span>
        {icon ? (
          <span className={`grid h-8 w-8 place-items-center rounded-xl border ${tones[tone]}`}>
            <Icon name={icon} className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <div className="num mt-2 text-xl font-extrabold text-farm-900 sm:text-2xl">{value}</div>
      {hint ? <div className="mt-1 text-[11px] leading-5 text-[#7c8a7f]">{hint}</div> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red" | "blue";
}) {
  const tones = {
    neutral: "bg-sand-100 text-[#5b6a5e] border-sand-200",
    green: "bg-farm-50 text-farm-700 border-farm-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-sky-50 text-sky-700 border-sky-200",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#ddd7c7] bg-sand-50 px-4 py-8 text-center">
      <p className="text-sm font-medium text-[#5b6a5e]">{title}</p>
      {hint ? <p className="mt-1 text-xs text-[#84907f]">{hint}</p> : null}
    </div>
  );
}

export function Progress({ value, tone = "farm" }: { value: number; tone?: "farm" | "clay" | "red" }) {
  const tones = { farm: "bg-farm-500", clay: "bg-clay-500", red: "bg-red-500" } as const;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#eee9dc]">
      <div className={`h-full rounded-full ${tones[tone]}`} style={{ width: `${Math.min(100, Math.max(2, value * 100))}%` }} />
    </div>
  );
}

/** نمایش استاندارد مبلغ: عدد ریالی مرتب‌شده + حروفی تومانی */
export function Amount({
  value,
  tone = "plain",
  className = "",
  showWords = true,
}: {
  value: number;
  tone?: "plain" | "income" | "expense" | "muted";
  className?: string;
  showWords?: boolean;
}) {
  const tones = {
    plain: "text-[#2b3a2e]",
    income: "text-farm-700",
    expense: "text-clay-600",
    muted: "text-[#7c8a7f]",
  } as const;
  return (
    <span className={`block ${className}`}>
      <span className={`num block whitespace-nowrap font-bold ${tones[tone]}`}>{formatMoney(value)}</span>
      {showWords ? (
        <span className="mt-0.5 block whitespace-normal text-[10px] font-normal leading-4 text-[#84907f]">
          {formatMoneyWords(value)}
        </span>
      ) : null}
    </span>
  );
}

export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[10px] text-[#84907f]">{hint}</span> : null}
    </label>
  );
}

export function Disclosure({
  title,
  children,
  icon = "plus",
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  icon?: string;
  defaultOpen?: boolean;
}) {
  return (
    <details className="card group" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-farm-800">
        <span className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-farm-50 text-farm-700">
            <Icon name={icon} className="h-4 w-4" />
          </span>
          {title}
        </span>
        <Icon name="chevron" className="h-4 w-4 rotate-90 text-[#84907f] transition group-open:-rotate-90" />
      </summary>
      <div className="border-t border-[#f0ebdd] p-4">{children}</div>
    </details>
  );
}
