import { useEffect, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight } from "lucide-react";
import {
  JALALI_MONTHS,
  JALALI_WEEKDAYS,
  datesEqual,
  formatJalali,
  jalaliToDate,
  jalaliWeekdayIndex,
  monthLength,
  todayJalali,
  toPersianDigits,
  type JDate,
} from "../lib/format";
import { Modal } from "./ui";
import { cn } from "../utils/cn";

export function JalaliDatePicker({
  value,
  onChange,
  label,
  minDate,
  error,
  disabled,
  quickToday = true,
}: {
  value: JDate | null;
  onChange: (date: JDate) => void;
  label: string;
  minDate?: JDate | null;
  error?: string;
  disabled?: boolean;
  quickToday?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const today = todayJalali();
  const [view, setView] = useState({ jy: value?.jy ?? today.jy, jm: value?.jm ?? today.jm });

  useEffect(() => {
    if (open) {
      setView({ jy: value?.jy ?? today.jy, jm: value?.jm ?? today.jm });
    }
    // Only reset the visible month when the picker is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const changeMonth = (delta: number) => {
    setView((current) => {
      const total = current.jy * 12 + (current.jm - 1) + delta;
      return { jy: Math.floor(total / 12), jm: (total % 12) + 1 };
    });
  };

  const daysInMonth = monthLength(view.jy, view.jm);
  const leading = jalaliWeekdayIndex({ jy: view.jy, jm: view.jm, jd: 1 });
  const minTime = minDate ? jalaliToDate(minDate).getTime() : 0;

  return (
    <div>
      <div className="label">
        <CalendarDays className="h-3.5 w-3.5 text-[#7fa294]" />
        {label}
        <span className="mr-auto flex items-center gap-1">
          {quickToday && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(todayJalali())}
              className="rounded-md border border-mint-300/20 bg-mint-300/[0.07] px-1.5 py-0.5 text-[9px] font-medium text-mint-300 transition hover:bg-mint-300/[0.14] disabled:opacity-50"
            >
              امروز
            </button>
          )}
          <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-light text-[#7f9c8e]">شمسی</span>
        </span>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "field flex items-center justify-between text-right transition",
          error && "field-error",
          disabled && "cursor-not-allowed opacity-60"
        )}
        aria-haspopup="dialog"
        aria-label={`${label}${value ? `: ${formatJalali(value, "long")}` : ""}`}
      >
        <span className={cn("font-medium", !value && "font-normal text-[#6f8e80]")}>
          {value ? formatJalali(value, "long") : "انتخاب تاریخ شمسی"}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-[#6f9584]" />
      </button>
      {error && <p className="mt-1.5 text-[11px] text-[#ef9c8f]">{error}</p>}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`انتخاب ${label}`}
        description="تقویم هجری شمسی — تاریخ انتخابی بلافاصله جایگزین می‌شود."
        size="sm"
      >
        <div className="p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between rounded-xl border border-white/[0.07] bg-[#071510] p-1.5">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="grid h-9 w-9 place-items-center rounded-lg text-[#9eb9ad] transition hover:bg-white/[0.06] hover:text-white"
              aria-label="ماه قبل"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="text-center">
              <div className="text-sm font-semibold text-[#edf7f1]">
                {JALALI_MONTHS[view.jm - 1]} {toPersianDigits(view.jy)}
              </div>
              <div className="mt-0.5 text-[9px] text-[#78968a]">تقویم شمسی</div>
            </div>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="grid h-9 w-9 place-items-center rounded-lg text-[#9eb9ad] transition hover:bg-white/[0.06] hover:text-white"
              aria-label="ماه بعد"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 text-center">
            {JALALI_WEEKDAYS.map((weekday) => (
              <div key={weekday} className="py-1 text-[10px] font-medium text-[#6f8e80]">
                {weekday.slice(0, 1)}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: leading }).map((_, index) => (
              <div key={`blank-${index}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
              const date = { jy: view.jy, jm: view.jm, jd: day };
              const selected = datesEqual(date, value);
              const isToday = datesEqual(date, today);
              const unavailable = jalaliToDate(date).getTime() < minTime;
              return (
                <button
                  key={day}
                  type="button"
                  disabled={unavailable}
                  onClick={() => {
                    onChange(date);
                    setOpen(false);
                  }}
                  className={cn(
                    "relative grid h-9 place-items-center rounded-lg text-xs transition sm:h-10",
                    selected
                      ? "bg-mint-400 font-bold text-[#07110d]"
                      : isToday
                        ? "border border-mint-300/30 bg-mint-300/[0.08] font-semibold text-mint-300"
                        : "text-[#c7d8cf] hover:bg-white/[0.06]",
                    unavailable && "cursor-not-allowed text-[#3f574d] line-through hover:bg-transparent"
                  )}
                >
                  {toPersianDigits(day)}
                  {selected && <Check className="absolute -bottom-1 h-2.5 w-2.5" />}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
            <button
              type="button"
              onClick={() => {
                onChange(today);
                setOpen(false);
              }}
              className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-[11px] text-[#c5d9cf] transition hover:bg-white/[0.07]"
            >
              امروز، {formatJalali(today, "long")}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-2 py-2 text-[11px] text-[#8aa79a] transition hover:text-white"
            >
              انصراف
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
