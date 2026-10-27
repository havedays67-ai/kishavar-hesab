import type { ReactNode } from "react";
import { Icon } from "@/components/ui";
import { SubmitButton } from "@/components/forms";

export type FormAction = (formData: FormData) => void | Promise<void>;

/** فرم حذف با تأیید مرورگر — در همهٔ بخش‌ها قابل استفاده است */
export function DeleteForm({
  action,
  id,
  label = "حذف",
  confirmText = "این رکورد حذف شود؟ این کار قابل بازگشت نیست.",
  className = "",
  variant = "icon",
}: {
  action: FormAction;
  id: number;
  label?: string;
  confirmText?: string;
  className?: string;
  variant?: "icon" | "button" | "link";
}) {
  return (
    <form action={action} className={className}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton
        confirm={confirmText}
        title={`${label} — حذف کامل`}
        className={
          variant === "icon"
            ? "grid h-8 w-8 place-items-center rounded-lg border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100"
            : variant === "link"
              ? "inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700"
              : "btn btn-sm border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
        }
      >
        <Icon name="trash" className="h-3.5 w-3.5" />
        {variant === "icon" ? <span className="sr-only">{label}</span> : label}
      </SubmitButton>
    </form>
  );
}

/** پنل ویرایش بازشو برای هر رکورد */
export function EditPanel({
  children,
  title = "ویرایش",
  defaultOpen = false,
}: {
  children: ReactNode;
  title?: string;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="mt-3 rounded-xl border border-[#e6e0cf] bg-sand-50/70">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-semibold text-farm-800">
        <Icon name="settings" className="h-3.5 w-3.5" />
        {title}
        <Icon name="chevron" className="mr-auto h-3.5 w-3.5 rotate-90 text-[#84907f]" />
      </summary>
      <div className="border-t border-[#eee7d6] p-3">{children}</div>
    </details>
  );
}
