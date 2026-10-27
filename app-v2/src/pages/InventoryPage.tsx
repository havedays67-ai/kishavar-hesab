import { useState } from "react";
import {
  Boxes,
  Package,
  Plus,
  Target,
  Trash2,
  TrendingDown,
  Truck,
  Warehouse,
} from "lucide-react";
import { cn } from "../utils/cn";
import { formatJalali, toPersianDigits, todayJalali } from "../lib/format";
import {
  EXPENSE_CATEGORIES,
  assetRows,
  budgetRows,
  inventoryValue,
  type Asset,
  type Budget,
  type InventoryItem,
  type InventoryMove,
  type LedgerState,
} from "../lib/ledger";
import { AmountField, SelectField, TextField } from "../components/FormControls";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { Modal, Toast } from "../components/ui";

const fa = (value: number) => toPersianDigits(Math.round(value).toLocaleString("en-US"));
const money = (value: number) => `${fa(value)} تومان`;
type Tab = "stock" | "assets" | "budget";

export function InventoryPage({
  ledger,
  onAddItem,
  onDeleteItem,
  onAddMove,
  onAddAsset,
  onDeleteAsset,
  onAddBudget,
  onDeleteBudget,
}: {
  ledger: LedgerState;
  onAddItem: (item: InventoryItem) => void;
  onDeleteItem: (id: string) => void;
  onAddMove: (move: InventoryMove) => void;
  onAddAsset: (asset: Asset) => void;
  onDeleteAsset: (id: string) => void;
  onAddBudget: (budget: Budget) => void;
  onDeleteBudget: (id: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("stock");
  const [itemOpen, setItemOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [assetOpen, setAssetOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const value = inventoryValue(ledger.items);
  const assets = assetRows(ledger.assets);
  const budgets = budgetRows(ledger.budgets, ledger.entries);
  const totalBook = assets.reduce((sum, asset) => sum + asset.book, 0);

  return (
    <div className="animate-rise">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] text-[#84a294]"><Warehouse className="h-3.5 w-3.5 text-mint-300" />انبار، دارایی و بودجه</div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-white sm:text-[26px]">مدیریت منابع مزرعه</h1>
          <p className="mt-1.5 max-w-2xl text-[11px] font-light leading-6 text-[#89a598]">موجودی نهاده، ورود و خروج انبار، استهلاک دارایی و کنترل بودجه هر سرفصل هزینه.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tab === "stock" && <><button type="button" onClick={() => setItemOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-mint-400 px-3 py-2.5 text-[9px] font-bold text-[#07110d]"><Plus className="h-3.5 w-3.5" /> کالای جدید</button><button type="button" onClick={() => setMoveOpen(true)} className="flex items-center gap-1.5 rounded-xl border border-white/[0.09] px-3 py-2.5 text-[9px] text-[#b9cec3]"><Plus className="h-3.5 w-3.5" /> ورود/خروج</button></>}
          {tab === "assets" && <button type="button" onClick={() => setAssetOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-mint-400 px-3 py-2.5 text-[9px] font-bold text-[#07110d]"><Plus className="h-3.5 w-3.5" /> دارایی جدید</button>}
          {tab === "budget" && <button type="button" onClick={() => setBudgetOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-mint-400 px-3 py-2.5 text-[9px] font-bold text-[#07110d]"><Plus className="h-3.5 w-3.5" /> بودجه جدید</button>}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: "ارزش موجودی انبار", value: money(value.inputs + value.products), icon: Boxes, tone: "mint" },
          { label: "اقلام کمبود", value: `${toPersianDigits(value.low)} قلم`, icon: TrendingDown, tone: value.low > 0 ? "sand" : "mint" },
          { label: "ارزش دفتری دارایی", value: money(totalBook), icon: Truck, tone: "neutral" },
          { label: "بودجه مصرف‌شده", value: money(budgets.reduce((sum, budget) => sum + budget.spent, 0)), icon: Target, tone: "sand" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="glass rounded-2xl p-3.5">
              <div className="flex items-center justify-between"><span className="text-[9px] text-[#91ad9f]">{stat.label}</span><Icon className={cn("h-3.5 w-3.5", stat.tone === "sand" ? "text-sand-300" : "text-mint-300/80")} /></div>
              <div className={cn("mt-1 truncate text-sm font-bold", stat.tone === "sand" ? "text-sand-300" : "text-[#eef8f1]")}>{stat.value}</div>
            </div>
          );
        })}
      </div>

      <div className="mb-4 flex w-full max-w-md items-center rounded-xl border border-white/[0.07] bg-white/[0.025] p-1">
        {([["stock", "انبار نهاده", Package], ["assets", "دارایی و استهلاک", Truck], ["budget", "بودجه", Target]] as [Tab, string, typeof Package][]).map(([valueTab, label, Icon]) => (
          <button key={valueTab} type="button" onClick={() => setTab(valueTab)} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[9px] transition", tab === valueTab ? "bg-[#1d402f] font-medium text-mint-300" : "text-[#819d90]")}><Icon className="h-3.5 w-3.5" />{label}</button>
        ))}
      </div>

      {tab === "stock" && (
        <div className="grid gap-3 md:grid-cols-2">
          {ledger.items.map((item) => {
            const moves = ledger.moves.filter((move) => move.itemId === item.id);
            const low = item.stock <= item.min;
            return (
              <article key={item.id} className="glass rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className={cn("grid h-9 w-9 place-items-center rounded-xl", item.kind === "product" ? "bg-mint-300/10 text-mint-300" : "bg-sand-300/10 text-sand-300")}><Package className="h-4 w-4" /></span>
                    <div><h3 className="text-[11px] font-semibold text-[#e8f3ec]">{item.name}</h3><p className="mt-0.5 text-[8px] text-[#78968a]">{item.kind === "product" ? "محصول" : "نهاده"} · واحد {item.unit} · قیمت واحد {money(item.cost)}</p></div>
                  </div>
                  <button type="button" onClick={() => onDeleteItem(item.id)} className="text-[#78968a] hover:text-[#efad9f]" aria-label="حذف کالا"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[["موجودی", `${fa(item.stock)} ${item.unit}`], ["حد سفارش", `${fa(item.min)} ${item.unit}`], ["ارزش", money(item.stock * item.cost)]].map(([label, text]) => (
                    <div key={label} className="rounded-lg bg-white/[0.02] p-2"><div className="text-[7px] text-[#78968a]">{label}</div><div className="mt-0.5 text-[9px] text-[#d3e4da]">{text}</div></div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className={cn("rounded px-1.5 py-0.5 text-[8px]", low ? "bg-[#a25649]/15 text-[#efad9f]" : "bg-mint-300/10 text-mint-300")}>{low ? "کمبود موجودی" : "موجودی کافی"}</span>
                  <span className="text-[8px] text-[#6f8c7f]">{toPersianDigits(moves.length)} گردش ثبت‌شده</span>
                </div>
                {moves.length > 0 && <div className="mt-2 space-y-1">{moves.slice(-3).map((move) => <div key={move.id} className="flex justify-between text-[8px] text-[#7f9b8e]"><span>{formatJalali(move.date, "short")} · {move.kind === "in" ? "ورود" : "خروج"} {fa(move.qty)}</span><span>{move.note || "—"}</span></div>)}</div>}
              </article>
            );
          })}
        </div>
      )}

      {tab === "assets" && (
        <div className="space-y-3">
          {assets.map((asset) => (
            <article key={asset.id} className="glass rounded-2xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><h3 className="text-[11px] font-semibold text-[#e8f3ec]">{asset.name}</h3><p className="mt-0.5 text-[8px] text-[#78968a]">خرید {formatJalali(asset.purchase, "long")} · عمر {toPersianDigits(asset.lifeMonths)} ماه · {asset.note}</p></div>
                <div className="flex items-center gap-2"><span className="text-[11px] font-bold text-[#dcebe2]">{money(asset.book)}</span><button type="button" onClick={() => onDeleteAsset(asset.id)} className="text-[#78968a] hover:text-[#efad9f]" aria-label="حذف دارایی"><Trash2 className="h-3.5 w-3.5" /></button></div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[["بهای تمام‌شده", money(asset.cost)], ["استهلاک ماهانه", money(asset.monthly)], ["استهلاک انباشته", money(asset.accumulated)], ["ارزش دفتری", money(asset.book)]].map(([label, text]) => (
                  <div key={label} className="rounded-lg bg-white/[0.02] p-2"><div className="text-[7px] text-[#78968a]">{label}</div><div className="mt-0.5 text-[9px] text-[#d3e4da]">{text}</div></div>
                ))}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-gradient-to-l from-sand-300 to-[#e8ddb4]" style={{ width: `${Math.min(100, asset.cost > 0 ? (asset.accumulated / (asset.cost - asset.salvage || 1)) * 100 : 0)}%` }} /></div>
              <p className="mt-1 text-[7px] text-[#6f8c7f]">ماه‌های سپری‌شده: {toPersianDigits(asset.monthsPassed)} — روش استهلاک خط مستقیم</p>
            </article>
          ))}
        </div>
      )}

      {tab === "budget" && (
        <div className="grid gap-3 md:grid-cols-2">
          {budgets.map((budget) => (
            <article key={budget.id} className="glass rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div><h3 className="text-[11px] font-semibold text-[#e8f3ec]">{budget.category}</h3><p className="mt-0.5 text-[8px] text-[#78968a]">سقف بودجه {money(budget.limit)} · مصرف {money(budget.spent)}</p></div>
                <div className="flex items-center gap-2"><span className={cn("rounded px-1.5 py-0.5 text-[8px]", budget.pct > 100 ? "bg-[#a25649]/15 text-[#efad9f]" : budget.pct > 75 ? "bg-sand-300/10 text-sand-300" : "bg-mint-300/10 text-mint-300")}>{toPersianDigits(budget.pct)}٪</span><button type="button" onClick={() => onDeleteBudget(budget.id)} className="text-[#78968a] hover:text-[#efad9f]" aria-label="حذف بودجه"><Trash2 className="h-3.5 w-3.5" /></button></div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className={cn("h-full rounded-full", budget.pct > 100 ? "bg-[#c47a68]" : "bg-gradient-to-l from-mint-400 to-[#c3e3a3]")} style={{ width: `${Math.min(100, budget.pct)}%` }} /></div>
              <div className="mt-2 flex justify-between text-[8px] text-[#7f9b8e]"><span>مانده: {money(Math.max(0, budget.remaining))}</span><span className={budget.remaining < 0 ? "text-[#efad9f]" : ""}>{budget.remaining < 0 ? `اضافه‌برداشت ${money(Math.abs(budget.remaining))}` : "در محدوده"}</span></div>
            </article>
          ))}
        </div>
      )}

      <ItemModal open={itemOpen} onClose={() => setItemOpen(false)} onSubmit={(item) => { onAddItem(item); setItemOpen(false); setToast("کالا ثبت شد"); }} />
      <MoveModal open={moveOpen} items={ledger.items} onClose={() => setMoveOpen(false)} onSubmit={(move) => { onAddMove(move); setMoveOpen(false); setToast("گردش انبار ثبت شد"); }} />
      <AssetModal open={assetOpen} onClose={() => setAssetOpen(false)} onSubmit={(asset) => { onAddAsset(asset); setAssetOpen(false); setToast("دارایی ثبت شد"); }} />
      <BudgetModal open={budgetOpen} onClose={() => setBudgetOpen(false)} onSubmit={(budget) => { onAddBudget(budget); setBudgetOpen(false); setToast("بودجه ثبت شد"); }} />
      <Toast open={Boolean(toast)} message={toast ?? ""} onClose={() => setToast(null)} />
    </div>
  );
}

function ItemModal({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (item: InventoryItem) => void }) {
  const [name, setName] = useState(""); const [unit, setUnit] = useState("کیلوگرم"); const [kind, setKind] = useState<"input" | "product">("input");
  const [stock, setStock] = useState(0); const [min, setMin] = useState(0); const [cost, setCost] = useState(0); const [error, setError] = useState("");
  const submit = () => { if (!name.trim()) return setError("نام کالا را وارد کنید."); onSubmit({ id: `item-${Date.now()}`, name: name.trim(), unit: unit.trim() || "عدد", kind, stock, min, cost }); setName(""); setStock(0); setMin(0); setCost(0); setError(""); };
  return <Modal open={open} onClose={onClose} title="کالای انبار" description="نهاده یا محصول را با موجودی و حد سفارش ثبت کنید." size="md"><div className="space-y-3 p-5"><div className="grid gap-3 sm:grid-cols-2"><TextField label="نام کالا" value={name} onChange={setName} placeholder="کود اوره" /><TextField label="واحد" value={unit} onChange={setUnit} placeholder="کیسه" /><SelectField label="نوع" value={kind} onChange={(value) => setKind(value as "input" | "product")} options={[{ value: "input", label: "نهاده" }, { value: "product", label: "محصول" }]} /><AmountField label="موجودی اولیه" value={stock} onChange={setStock} /><AmountField label="حد سفارش" value={min} onChange={setMin} /><AmountField label="بهای واحد" value={cost} onChange={setCost} /></div>{error && <p className="text-[10px] text-[#f0a59a]">{error}</p>}<button type="button" onClick={submit} className="w-full rounded-xl bg-mint-400 py-2.5 text-[11px] font-bold text-[#07110d]">ثبت کالا</button></div></Modal>;
}

function MoveModal({ open, items, onClose, onSubmit }: { open: boolean; items: InventoryItem[]; onClose: () => void; onSubmit: (move: InventoryMove) => void }) {
  const [itemId, setItemId] = useState(items[0]?.id ?? ""); const [kind, setKind] = useState<"in" | "out">("in"); const [qty, setQty] = useState(0); const [date, setDate] = useState(todayJalali()); const [note, setNote] = useState(""); const [error, setError] = useState("");
  const submit = () => { if (!itemId) return setError("کالا را انتخاب کنید."); if (qty <= 0) return setError("مقدار را وارد کنید."); onSubmit({ id: `mv-${Date.now()}`, itemId, date, kind, qty, note: note.trim() }); setQty(0); setNote(""); setError(""); };
  return <Modal open={open} onClose={onClose} title="ورود / خروج انبار" size="md"><div className="space-y-3 p-5">{items.length === 0 ? <p className="text-[10px] text-[#78968a]">اول یک کالا ثبت کنید.</p> : <><SelectField label="کالا" value={itemId} onChange={setItemId} options={items.map((item) => ({ value: item.id, label: `${item.name} (${item.unit})` }))} /><div className="grid grid-cols-2 gap-2">{[["in", "ورود به انبار"], ["out", "خروج از انبار"]].map(([value, label]) => <button key={value} type="button" onClick={() => setKind(value as "in" | "out")} className={cn("rounded-xl border p-2.5 text-[10px]", kind === value ? "border-mint-300/40 bg-mint-300/[0.08] text-mint-300" : "border-[#2b483a] text-[#a8bfb3]")}>{label}</button>)}</div><AmountField label="مقدار" value={qty} onChange={setQty} required /><JalaliDatePicker label="تاریخ" value={date} onChange={setDate} /><TextField label="توضیح" value={note} onChange={setNote} placeholder="کاشت قطعه شمالی" /><button type="button" onClick={submit} className="w-full rounded-xl bg-mint-400 py-2.5 text-[11px] font-bold text-[#07110d]">ثبت گردش</button></>}{error && <p className="text-[10px] text-[#f0a59a]">{error}</p>}</div></Modal>;
}

function AssetModal({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (asset: Asset) => void }) {
  const [name, setName] = useState(""); const [cost, setCost] = useState(0); const [salvage, setSalvage] = useState(0); const [life, setLife] = useState(120); const [purchase, setPurchase] = useState(todayJalali()); const [note, setNote] = useState("");
  return <Modal open={open} onClose={onClose} title="دارایی و استهلاک" description="روش خط مستقیم؛ استهلاک ماهانه خودکار محاسبه می‌شود." size="md"><div className="space-y-3 p-5"><div className="grid gap-3 sm:grid-cols-2"><TextField label="نام دارایی" value={name} onChange={setName} placeholder="تراکتور" /><AmountField label="بهای خرید" value={cost} onChange={setCost} /><AmountField label="ارزش اسقاط" value={salvage} onChange={setSalvage} /><TextField label="عمر مفید (ماه)" value={String(life)} onChange={(value) => setLife(Number(toPersianDigits(value).replace(/[^\d]/g, "")) || 0)} /><JalaliDatePicker label="تاریخ خرید" value={purchase} onChange={setPurchase} /><TextField label="توضیح" value={note} onChange={setNote} /></div><button type="button" onClick={() => { if (!name.trim() || cost <= 0) return; onSubmit({ id: `ast-${Date.now()}`, name: name.trim(), cost, salvage, lifeMonths: life, purchase, note: note.trim() }); setName(""); setCost(0); }} className="w-full rounded-xl bg-mint-400 py-2.5 text-[11px] font-bold text-[#07110d]">ثبت دارایی</button></div></Modal>;
}

function BudgetModal({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (budget: Budget) => void }) {
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]); const [limit, setLimit] = useState(0);
  return <Modal open={open} onClose={onClose} title="تعیین بودجه" description="مصرف واقعی از اسناد هزینه همان دسته محاسبه می‌شود." size="sm"><div className="space-y-3 p-5"><SelectField label="سرفصل" value={category} onChange={setCategory} options={EXPENSE_CATEGORIES.map((item) => ({ value: item, label: item }))} /><AmountField label="سقف بودجه" value={limit} onChange={setLimit} required /><button type="button" onClick={() => { if (limit <= 0) return; onSubmit({ id: `bud-${Date.now()}`, category, limit }); setLimit(0); }} className="w-full rounded-xl bg-mint-400 py-2.5 text-[11px] font-bold text-[#07110d]">ثبت بودجه</button></div></Modal>;
}
