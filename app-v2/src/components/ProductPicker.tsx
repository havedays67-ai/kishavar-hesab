/**
 * انتخاب محصول: فهرست کامل و گروه‌بندی‌شده + جستجوی مقاوم به غلط املایی +
 * امکان نوشتن نام دلخواه توسط کاربر.
 *
 * دسترس‌پذیری: نقش listbox/option، کنترل با کیبورد (بالا/پایین/Enter/Escape)،
 * و بستن با کلیک بیرون.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { cn } from "../utils/cn";
import { normalizeProductQuery, productsByCategory, searchProducts, type ProductCategory, type ProductItem } from "../lib/products";

export function ProductPicker({
  value,
  onChange,
  label = "محصول",
  required,
  error,
  categories,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
  categories?: ProductCategory[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const allowed = useMemo(() => (categories ? new Set(categories) : null), [categories]);
  const grouped = useMemo(
    () => productsByCategory().map((group) => ({ ...group, items: group.items.filter((item) => !allowed || allowed.has(item.category)) })).filter((group) => group.items.length > 0),
    [allowed]
  );
  const results = useMemo(() => (query.trim() ? searchProducts(query, 60).filter((item) => !allowed || allowed.has(item.category)) : []), [query, allowed]);
  const flat = useMemo(() => (query.trim() ? results : grouped.flatMap((group) => group.items)), [query, results, grouped]);
  const canCreate = Boolean(query.trim()) && !flat.some((item) => normalizeProductQuery(item.name) === normalizeProductQuery(query));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      const max = flat.length - 1 + (canCreate ? 1 : 0);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlighted((current) => Math.min(max, current + 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlighted((current) => Math.max(0, current - 1));
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (canCreate && highlighted === flat.length) {
          onChange(query.trim());
          setOpen(false);
          setQuery("");
          return;
        }
        const item = flat[Math.min(highlighted, Math.max(0, flat.length - 1))];
        if (item) {
          onChange(item.name);
          setOpen(false);
          setQuery("");
        }
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, flat, canCreate, highlighted, onChange, query]);

  useEffect(() => {
    if (open) window.setTimeout(() => searchRef.current?.focus(), 60);
  }, [open]);

  const choose = (item: ProductItem) => {
    onChange(item.name);
    setOpen(false);
    setQuery("");
    setHighlighted(0);
  };

  const create = () => {
    const name = query.trim().slice(0, 40);
    if (!name) return;
    onChange(name);
    setOpen(false);
    setQuery("");
    setHighlighted(0);
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="label">
        {label}
        {required && <span className="text-[#c9967e]">*</span>}
      </div>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className={cn("field flex items-center justify-between gap-2 text-right", error && "field-error")}
      >
        <span className={cn("truncate", value ? "text-[#eef8f2]" : "text-[#6f8e80]")}>{value || "جستجو یا انتخاب محصول"}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-[#6f9584] transition", open && "rotate-180 text-mint-300")} />
      </button>
      {error && <p className="mt-1.5 text-[11px] text-[#ef9c8f]">{error}</p>}

      {open && (
        <div className="animate-fade absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-[#3b6652] bg-[#0b1f17]/[0.98] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.65)] ring-1 ring-black/30 backdrop-blur-xl" role="listbox" aria-label={`${label} — فهرست محصولات`}>
          <div className="sticky top-0 z-10 mb-1 rounded-lg bg-[#10251c] p-1">
            <label className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
              <Search className="h-3.5 w-3.5 text-[#7d9b8d]" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => { setQuery(event.target.value); setHighlighted(0); }}
                placeholder="جستجوی محصول… (مثلاً آفتابگردان)"
                className="w-full bg-transparent text-[11px] text-[#eef8f2] outline-none placeholder:text-[#6f8e80]"
                aria-label="جستجوی محصول"
              />
            </label>
            <p className="mt-1 px-1 text-[8px] text-[#78968a]">{flat.length} محصول{query.trim() ? " پیدا شد" : " در فهرست"}</p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {query.trim() ? (
              results.length === 0 ? (
                <p className="px-2 py-3 text-center text-[10px] text-[#78968a]">محصولی با این نام پیدا نشد؛ می‌توانید آن را خودتان ثبت کنید.</p>
              ) : (
                results.map((item, index) => (
                  <button
                    key={`${item.category}-${item.name}`}
                    type="button"
                    role="option"
                    aria-selected={item.name === value}
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => choose(item)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-right text-[11px] transition",
                      highlighted === index ? "bg-white/[0.07]" : "hover:bg-white/[0.05]",
                      item.name === value ? "font-medium text-mint-300" : "text-[#d4e5db]",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.name}</span>
                      <span className="mt-0.5 block text-[8px] font-normal text-[#7d9b8d]">{item.category}</span>
                    </span>
                    {item.name === value && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                ))
              )
            ) : (
              grouped.map((group) => (
                <div key={group.category} className="mb-1">
                  <p className="px-2 py-1 text-[8px] font-medium text-[#7fa294]">{group.category}</p>
                  {group.items.map((item) => {
                    const index = flat.findIndex((entry) => entry.name === item.name);
                    return (
                      <button
                        key={item.name}
                        type="button"
                        role="option"
                        aria-selected={item.name === value}
                        onMouseEnter={() => setHighlighted(index)}
                        onClick={() => choose(item)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-right text-[11px] transition",
                          highlighted === index ? "bg-white/[0.07]" : "hover:bg-white/[0.05]",
                          item.name === value ? "font-medium text-mint-300" : "text-[#d4e5db]",
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{item.name}</span>
                        {item.name === value && <Check className="h-3.5 w-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
            {(canCreate || query.trim()) && (
              <button
                type="button"
                role="option"
                aria-selected={false}
                onMouseEnter={() => setHighlighted(flat.length)}
                onClick={create}
                className={cn(
                  "mt-1 flex w-full items-center gap-2 rounded-lg border-t border-white/[0.08] px-2.5 py-2 text-right text-[11px] text-mint-300 transition",
                  highlighted === flat.length ? "bg-mint-300/10" : "hover:bg-mint-300/[0.07]",
                )}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="min-w-0 flex-1 truncate">ثبت محصول دلخواه: «{query.trim()}»</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
