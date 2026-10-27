import { formatMoney, formatMoneyWords } from "@/lib/format";

type Tone = "income" | "expense" | "neutral" | "profit";

const TONES: Record<Tone, string> = {
  income: "text-farm-700",
  expense: "text-clay-600",
  profit: "text-farm-800",
  neutral: "text-[#2b3a2e]",
};

/**
 * نمایش یکسان مبالغ در کل برنامه:
 * خط اول: 100,000,000 ریال
 * خط دوم: ده میلیون تومان
 */
export function Money({
  value,
  tone = "neutral",
  size = "sm",
  showWords = true,
  className = "",
}: {
  value: number;
  tone?: Tone;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showWords?: boolean;
  className?: string;
}) {
  const sizes = {
    xs: "text-[11px]",
    sm: "text-xs",
    md: "text-sm",
    lg: "text-lg",
    xl: "text-2xl",
  } as const;
  return (
    <span className={`inline-flex flex-col leading-tight ${className}`}>
      <span className={`num font-extrabold tabular-nums ${sizes[size]} ${TONES[tone]}`}>{formatMoney(value)}</span>
      {showWords ? <span className="num mt-0.5 text-[10px] font-medium text-[#84907f]">{formatMoneyWords(value)}</span> : null}
    </span>
  );
}

/** درون متن: «100,000,000 ریال (ده میلیون تومان)» */
export function MoneyInline({ value, tone = "neutral" }: { value: number; tone?: Tone }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-1">
      <span className={`num font-bold tabular-nums ${TONES[tone]}`}>{formatMoney(value)}</span>
      <span className="num text-[10px] text-[#84907f]">({formatMoneyWords(value)})</span>
    </span>
  );
}
