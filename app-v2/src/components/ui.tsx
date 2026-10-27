import { useEffect, type ReactNode } from "react";
import { Check, Wheat, X } from "lucide-react";
import { cn } from "../utils/cn";
import type { ContractStatus, Role } from "../lib/data";

export function BrandMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dimensions = {
    sm: "h-9 w-9 rounded-xl [&_svg]:h-5 [&_svg]:w-5",
    md: "h-11 w-11 rounded-[14px] [&_svg]:h-6 [&_svg]:w-6",
    lg: "h-16 w-16 rounded-[22px] [&_svg]:h-9 [&_svg]:w-9",
  }[size];

  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden border border-mint-300/20 bg-gradient-to-br from-[#2b7457] via-[#17543d] to-[#0d3929] text-mint-300 shadow-[0_8px_24px_rgba(0,0,0,0.25)]",
        dimensions
      )}
      aria-hidden="true"
    >
      <div className="absolute -right-3 -top-4 h-8 w-8 rounded-full bg-mint-300/10" />
      <div className="absolute -bottom-4 -left-2 h-8 w-8 rounded-full bg-sand-300/10" />
      <Wheat className="relative" strokeWidth={1.6} />
    </div>
  );
}

const avatarStyles = {
  mint: "from-[#3a8e6e] to-[#1b5944] text-[#d5f8e8]",
  sand: "from-[#8d7547] to-[#66512c] text-[#fff1ce]",
  blue: "from-[#3a6575] to-[#274652] text-[#d9f2fa]",
  rose: "from-[#7c5053] to-[#58373a] text-[#ffe1e2]",
};

export function Avatar({
  name,
  color = "mint",
  size = "md",
}: {
  name: string;
  color?: keyof typeof avatarStyles;
  size?: "sm" | "md" | "lg";
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("");

  const dimensions = {
    sm: "h-8 w-8 text-[11px]",
    md: "h-10 w-10 text-xs",
    lg: "h-12 w-12 text-sm",
  }[size];

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full border border-white/10 bg-gradient-to-br font-bold",
        avatarStyles[color],
        dimensions
      )}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

export function RoleBadge({ role, small = false }: { role: Role; small?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        role === "landlord"
          ? "border-sand-300/20 bg-sand-300/10 text-sand-300"
          : "border-mint-300/20 bg-mint-400/10 text-mint-300",
        small ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", role === "landlord" ? "bg-sand-300" : "bg-mint-400")} />
      {role === "landlord" ? "موجر / مالک زمین" : "مستاجر / بهره‌بردار"}
    </span>
  );
}

const statusStyles: Record<ContractStatus, { label: string; className: string }> = {
  active: { label: "جاری", className: "border-mint-400/20 bg-mint-400/10 text-mint-300" },
  pending: { label: "در انتظار امضا", className: "border-sand-300/20 bg-sand-300/10 text-sand-300" },
  expired: { label: "پایان‌یافته", className: "border-white/10 bg-white/5 text-[#8fa69b]" },
};

export function StatusPill({ status }: { status: ContractStatus }) {
  const style = statusStyles[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium", style.className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {style.label}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  children,
  title,
  description,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const width = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
  }[size];

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[#020806]/80 backdrop-blur-sm animate-fade"
        aria-label="بستن پنجره"
      />
      <div
        className={cn(
          "animate-rise relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[26px] border border-[#29483b] bg-[#0d1d16] shadow-[0_30px_100px_rgba(0,0,0,0.55)] sm:rounded-[24px]",
          width
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4 sm:px-6">
            <div>
              {title && <h2 className="text-base font-semibold text-white sm:text-lg">{title}</h2>}
              {description && <p className="mt-1 text-xs leading-6 text-[#8eaa9d]">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-[#a8beb3] transition hover:bg-white/[0.08] hover:text-white"
              aria-label="بستن"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function Toast({
  open,
  message,
  detail,
  onClose,
}: {
  open: boolean;
  message: string;
  detail?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(onClose, 4300);
    return () => window.clearTimeout(timer);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="animate-toast fixed bottom-24 right-1/2 z-[90] w-[calc(100%-2rem)] max-w-sm translate-x-1/2 sm:bottom-7 sm:right-7 sm:translate-x-0">
      <div className="flex items-center gap-3 rounded-2xl border border-mint-300/25 bg-[#163629] px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mint-400 text-[#092016]">
          <Check className="h-5 w-5" strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{message}</p>
          {detail && <p className="mt-0.5 truncate text-[11px] text-[#a8c7b9]">{detail}</p>}
        </div>
        <button type="button" onClick={onClose} className="text-[#8eaa9d] transition hover:text-white" aria-label="بستن پیام">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-[11px] text-[#ef9c8f]">{message}</p>;
}
