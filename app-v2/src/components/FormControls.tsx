import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../utils/cn";
import { formatNumber, numberToPersianWords, toEnglishDigits } from "../lib/format";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = "انتخاب کنید",
  icon,
  error,
  required,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: ReactNode;
  error?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const [highlighted, setHighlighted] = useState(() => Math.max(0, options.findIndex((option) => option.value === value)));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlighted((current) => Math.min(options.length - 1, current + 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlighted((current) => Math.max(0, current - 1));
      }
      if (event.key === "Enter" && open) {
        event.preventDefault();
        const option = options[highlighted];
        if (option) {
          onChange(option.value);
          setOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, options, highlighted, onChange]);

  return (
    <div ref={rootRef} className="relative">
      <div className="label">
        {icon}
        {label}
        {required && <span className="text-[#c9967e]">*</span>}
      </div>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn("field flex items-center justify-between gap-2 text-right", error && "field-error")}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={cn("truncate", selected ? "text-[#eef8f2]" : "text-[#6f8e80]")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-[#6f9584] transition", open && "rotate-180 text-mint-300")} />
      </button>
      {error && <p className="mt-1.5 text-[11px] text-[#ef9c8f]">{error}</p>}

      {open && (
        <div
          className="animate-fade absolute inset-x-0 top-[calc(100%+7px)] z-40 overflow-hidden rounded-xl border border-[#345746] bg-[#10251c] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
          role="listbox"
        >
          {options.map((option, index) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-right text-xs transition",
                  highlighted === index ? "bg-white/[0.07]" : "hover:bg-white/[0.05]",
                  active ? "font-medium text-mint-300" : "text-[#d4e5db]"
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{option.label}</span>
                  {option.hint && <span className="mt-0.5 block text-[9px] font-normal text-[#7d9b8d]">{option.hint}</span>}
                </span>
                {active && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AmountField({
  label,
  value,
  onChange,
  suffix = "تومان",
  placeholder = "۰",
  helper,
  error,
  required,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  placeholder?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  max?: number;
}) {
  return (
    <div>
      <div className="label">
        {label}
        {required && <span className="text-[#c9967e]">*</span>}
        {value > 0 && !error && (
          <span className="mr-auto grid h-4 w-4 place-items-center rounded-full bg-mint-300/10 text-mint-300">
            <Check className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          dir="ltr"
          value={value ? formatNumber(value) : ""}
          onChange={(event) => {
            const raw = toEnglishDigits(event.target.value).replace(/[^\d]/g, "");
            const next = raw ? Number(raw) : 0;
            onChange(typeof max === "number" ? Math.min(max, next) : next);
          }}
          placeholder={placeholder}
          className={cn("field pl-[4.6rem] text-right font-medium tabular-nums tracking-tight", error && "field-error")}
          aria-label={label}
        />
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 border-r border-white/10 pr-2.5 text-[9px] text-[#759486]">
          {suffix}
        </span>
      </div>
      {error ? (
        <p className="mt-1.5 text-[11px] text-[#ef9c8f]">{error}</p>
      ) : (
        <p className="mt-1.5 min-h-[16px] truncate text-[9px] font-light text-[#708d80]">
          {helper ?? (value > 0 ? `${numberToPersianWords(value)} ${suffix}` : "مبلغ را با عدد وارد کنید")}
        </p>
      )}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  error,
  required,
  icon,
  hint,
  textarea,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  icon?: ReactNode;
  hint?: string;
  textarea?: boolean;
  rows?: number;
}) {
  const sharedClass = cn("field text-right", error && "field-error", textarea && "min-h-[98px] resize-y leading-6");
  return (
    <div>
      <div className="label">
        {icon}
        {label}
        {required && <span className="text-[#c9967e]">*</span>}
      </div>
      {textarea ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={sharedClass}
          aria-label={label}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={sharedClass}
          aria-label={label}
        />
      )}
      {error ? (
        <p className="mt-1.5 text-[11px] text-[#ef9c8f]">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[9px] font-light text-[#708d80]">{hint}</p>
      ) : null}
    </div>
  );
}

export function SegmentedOptions<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <div>
      {label && <div className="label">{label}</div>}
      <div className="grid gap-1 rounded-xl border border-white/[0.07] bg-[#071510]/60 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-lg px-2 py-2 text-[11px] transition",
              value === option.value
                ? "bg-[#21483a] font-medium text-mint-300 shadow-sm"
                : "text-[#7f9b8e] hover:bg-white/[0.04] hover:text-[#d3e3da]"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
