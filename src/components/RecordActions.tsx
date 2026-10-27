"use client";

import Link from "next/link";
import { deleteRecord } from "@/app/actions";
import { Icon } from "@/components/ui";

/**
 * دکمه‌های استاندارد ویرایش و حذف برای همه رکوردها.
 * حذف با تأییدیه انجام می‌شود تا ثبت اشتباهی آسان پاک شود.
 */
export function RecordActions({
  entity,
  id,
  redirectTo,
  hideEdit = false,
  label = "این رکورد",
  className = "",
}: {
  entity: string;
  id: number;
  redirectTo?: string;
  hideEdit?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {hideEdit ? null : (
        <Link
          href={`/edit/${entity}/${id}`}
          className="btn btn-sm"
          title="ویرایش"
          aria-label={`ویرایش ${label}`}
        >
          <Icon name="edit" className="h-3.5 w-3.5" />
        </Link>
      )}
      <form
        action={deleteRecord}
        onSubmit={(event) => {
          if (!window.confirm(`«${label}» حذف شود؟ این عمل قابل بازگشت نیست.`)) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="entity" value={entity} />
        <input type="hidden" name="id" value={id} />
        {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
        <button
          type="submit"
          className="btn btn-sm text-red-600 hover:bg-red-50"
          title="حذف"
          aria-label={`حذف ${label}`}
        >
          <Icon name="trash" className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
