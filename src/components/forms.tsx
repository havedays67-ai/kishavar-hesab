"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { formatAmountNumber } from "@/lib/format";
import { tomanWords } from "@/lib/money-words";

/** دکمهٔ ثبت با حالت انتظار و تأیید اختیاری */
export function SubmitButton({
  children,
  className = "btn btn-primary",
  confirm,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      title={title}
      disabled={pending}
      className={`${className} ${pending ? "opacity-60" : ""}`}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {pending ? "در حال ذخیره…" : children}
    </button>
  );
}

/** ورودی مبلغ به ریال، با نمایش زندهٔ حروفی به تومان */
export function AmountInput({
  name = "amount",
  defaultValue,
  required = false,
  placeholder = "100,000,000",
  className = "input num",
}: {
  name?: string;
  defaultValue?: number;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [raw, setRaw] = useState<string>(
    defaultValue === undefined ? "" : formatAmountNumber(Math.round(Number(defaultValue) * 10)),
  );
  const digits = Number(raw.replace(/[^\d]/g, ""));
  const rial = Number.isFinite(digits) ? digits : 0;
  const toman = Math.round(rial / 10);

  return (
    <div className="space-y-1">
      <input
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        required={required}
        placeholder={placeholder}
        value={raw}
        onChange={(event) => {
          const onlyDigits = event.target.value.replace(/[^\d]/g, "");
          setRaw(onlyDigits ? formatAmountNumber(Number(onlyDigits)) : "");
        }}
        className={className}
      />
      <p className={`rounded-lg px-2 py-1 text-[10px] leading-5 ${rial > 0 ? "bg-farm-50 text-farm-700" : "bg-sand-50 text-[#84907f]"}`}>
        {rial > 0 ? (
          <span className="num">
            {formatAmountNumber(rial)} ریال · {tomanWords(toman)}
          </span>
        ) : (
          "مبلغ را به ریال وارد کنید؛ حروفی و تومان آن نمایش داده می‌شود."
        )}
      </p>
    </div>
  );
}
