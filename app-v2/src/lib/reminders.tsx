import { useEffect, useState } from "react";
import { BellRing, CalendarClock, Bell, Plus, Trash2, Repeat } from "lucide-react";
import { cn } from "../utils/cn";
import { formatJalali, jalaliToDate, toPersianDigits, todayJalali, type JDate } from "../lib/format";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { SelectField, TextField } from "../components/FormControls";
import { Modal, Toast } from "../components/ui";
import { useProfile } from "./profile";
import { Capacitor } from "@capacitor/core";

export interface Reminder {
  id: string;
  title: string;
  note: string;
  date: JDate;
  hour: number;
  minute: number;
  repeat: "once" | "daily" | "weekly";
  enabled: boolean;
  createdAt: string;
}

const KEY = "kishavar.reminders.v1";

function load(): Reminder[] {
  try { const raw = localStorage.getItem(KEY); const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

function save(list: Reminder[]) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ } }

function toDate(reminder: Reminder): Date {
  const date = jalaliToDate(reminder.date);
  date.setHours(reminder.hour, reminder.minute, 0, 0);
  return date;
}

async function ensurePermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("LocalNotifications")) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const status = await LocalNotifications.checkPermissions();
      if (status.display === "granted") return true;
      const requested = await LocalNotifications.requestPermissions();
      return requested.display === "granted";
    } catch { return false; }
  }
  if (typeof Notification !== "undefined") {
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    return (await Notification.requestPermission()) === "granted";
  }
  return false;
}

export async function scheduleReminder(reminder: Reminder): Promise<{ ok: boolean; message: string }> {
  const when = toDate(reminder);
  if (when.getTime() <= Date.now()) return { ok: false, message: "زمان یادآوری باید در آینده باشد." };
  const allowed = await ensurePermission();
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("LocalNotifications")) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.createChannel({ id: "kishavar-alarm", name: "یادآوری کسب‌وکار من", importance: 5, sound: "default", vibration: true, lights: true, visibility: 1 });
      await LocalNotifications.schedule({
        notifications: [{
          id: Number(reminder.id.replace(/\D/g, "").slice(-9)) || Math.floor(Math.random() * 1e9),
          title: reminder.title,
          body: reminder.note || "یادآوری کسب‌وکار من",
          channelId: "kishavar-alarm",
          sound: "default",
          schedule: reminder.repeat === "daily" ? { on: { hour: reminder.hour, minute: reminder.minute }, repeats: true } : reminder.repeat === "weekly" ? { on: { weekday: when.getDay() + 1, hour: reminder.hour, minute: reminder.minute }, repeats: true } : { at: when, allowWhileIdle: true },
          smallIcon: undefined,
        }],
      });
      return { ok: true, message: "یادآوری در گوشی زمان‌بندی شد؛ حتی اگر برنامه بسته باشد، سیستم اعلان را نمایش می‌دهد." };
    } catch (error) {
      return { ok: false, message: "زمان‌بندی اعلان ممکن نشد؛ مجوز اعلان و آلارم دقیق را در تنظیمات گوشی بررسی کنید." };
    }
  }
  if (!allowed) return { ok: false, message: "اجازه اعلان داده نشده؛ یادآوری فقط داخل برنامه فعال است." };
  return { ok: true, message: "یادآوری ثبت شد. در مرورگر، اعلان تا وقتی برنامه باز باشد نمایش داده می‌شود؛ برای هشدار در پس‌زمینه از نسخه اندروید استفاده کنید." };
}

export async function cancelReminder(id: string): Promise<void> {
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("LocalNotifications")) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.cancel({ notifications: [{ id: Number(id.replace(/\D/g, "").slice(-9)) }] });
    } catch { /* ignore */ }
  }
}

export function ReminderBanner({ onOpen }: { onOpen: () => void }) {
  const [next, setNext] = useState<Reminder | null>(null);
  useEffect(() => {
    const list = load().filter((r) => r.enabled);
    const withMs = list.map((r) => ({ r, ms: toDate(r).getTime() })).filter((x) => x.ms > Date.now()).sort((a, b) => a.ms - b.ms);
    setNext(withMs[0]?.r ?? null);
  }, []);
  if (!next) return null;
  return (
    <button type="button" onClick={onOpen} className="flex items-center gap-2 rounded-xl border border-mint-300/20 bg-mint-300/[0.07] px-3 py-1.5 text-[9px] text-mint-300">
      <BellRing className="h-3 w-3" /> یادآوری بعدی: {toPersianDigits(next.hour)}:{toPersianDigits(String(next.minute).padStart(2, "0"))} — {formatJalali(next.date, "short")}
    </button>
  );
}

export function RemindersPage() {
  const { profile } = useProfile();
  const [items, setItems] = useState<Reminder[]>(load);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState<JDate>(todayJalali());
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [repeat, setRepeat] = useState<Reminder["repeat"]>("once");
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [permission, setPermission] = useState<string>("در حال بررسی…");

  useEffect(() => { void ensurePermission().then((ok) => setPermission(ok ? "اعلان مجاز است" : "اعلان غیرفعال است")); }, []);
  useEffect(() => { save(items); }, [items]);

  const submit = async () => {
    if (title.trim().length < 3) return setError("عنوان یادآوری را بنویسید.");
    const reminder: Reminder = { id: `rem-${Date.now()}`, title: title.trim(), note: note.trim(), date, hour, minute, repeat, enabled: true, createdAt: new Date().toISOString() };
    const result = await scheduleReminder(reminder);
    setItems((current) => [reminder, ...current]);
    setOpen(false); setTitle(""); setNote(""); setError("");
    setToast(result.ok ? result.message : result.message);
  };

  return (
    <div className="animate-rise">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] text-[#84a294]"><BellRing className="h-3.5 w-3.5 text-mint-300" />یادآوری و هشدار</div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-white sm:text-[26px]">یادآوری‌های هوشمند</h1>
          <p className="mt-1.5 max-w-2xl text-[11px] font-light leading-6 text-[#89a598]">برای هر کار، تاریخ و ساعت مشخص کنید تا اعلان سیستمی با صدا در همان زمان فعال شود. در نسخه اندروید، اعلان حتی با بسته بودن برنامه توسط سیستم‌عامل نمایش داده می‌شود.</p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl bg-mint-400 px-4 py-2.5 text-[10px] font-bold text-[#07110d]"><Plus className="h-3.5 w-3.5" /> یادآوری جدید</button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-mint-300/15 bg-mint-300/[0.04] px-3.5 py-2.5 text-[9px] text-[#a9c4b8]">
        <Bell className="h-3.5 w-3.5 text-mint-300" /> {permission} · {toPersianDigits(items.length)} یادآوری ثبت‌شده
        <span className="mr-auto text-[8px] text-[#78968a]">صدا: زنگ پیش‌فرض سیستم · کانال پراهمیت</span>
      </div>

      <div className="space-y-2.5">
        {items.map((item) => {
          const when = toDate(item);
          const past = when.getTime() < Date.now() && item.repeat === "once";
          return (
            <article key={item.id} className="glass flex flex-wrap items-start justify-between gap-3 rounded-2xl p-3.5">
              <div className="flex items-start gap-2.5">
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", past ? "bg-[#a25649]/15 text-[#efad9f]" : "bg-mint-300/10 text-mint-300")}><CalendarClock className="h-4 w-4" /></span>
                <div>
                  <h3 className="text-[11px] font-semibold text-[#e8f3ec]">{item.title}</h3>
                  <p className="mt-0.5 text-[8px] text-[#78968a]">{formatJalali(item.date, "long")} · ساعت {toPersianDigits(item.hour)}:{toPersianDigits(String(item.minute).padStart(2, "0"))} · {item.repeat === "once" ? "یک‌بار" : item.repeat === "daily" ? "هر روز" : "هر هفته"}</p>
                  {item.note && <p className="mt-1 text-[8px] text-[#7f9b8e]">{item.note}</p>}
                  <p className="mt-1 flex items-center gap-1 text-[8px] text-[#6f8c7f]"><Repeat className="h-2.5 w-2.5" /> {item.repeat === "once" ? "اعلان سیستمی در زمان تعیین‌شده" : "اعلان تکرارشونده"}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => { setItems((current) => current.map((row) => row.id === item.id ? { ...row, enabled: !row.enabled } : row)); }} className={cn("rounded-lg px-2 py-1 text-[8px]", item.enabled ? "bg-mint-300/10 text-mint-300" : "bg-white/[0.05] text-[#9fb6aa]")}>{item.enabled ? "فعال" : "غیرفعال"}</button>
                <button type="button" onClick={() => { void cancelReminder(item.id); setItems((current) => current.filter((row) => row.id !== item.id)); }} className="text-[#8a6b63] hover:text-[#efad9f]" aria-label="حذف یادآوری"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </article>
          );
        })}
        {items.length === 0 && <div className="rounded-2xl border border-dashed border-[#355344] bg-white/[0.015] px-5 py-12 text-center"><BellRing className="mx-auto mb-2 h-6 w-6 text-[#6f8e80]" /><p className="text-xs text-[#c2d6cb]">هنوز یادآوری نساخته‌اید.</p><p className="mt-1 text-[9px] text-[#78968a]">مثلاً «پرداخت چک»، «پیگیری طلب» یا «تمدید قرارداد» با ساعت مشخص.</p></div>}
      </div>

      <div className="mt-4 rounded-xl border border-[#c5b97f]/20 bg-[#c5b97f]/[0.05] px-3.5 py-2.5 text-[8px] leading-5 text-[#d7cba1]">
        <b>محدودیت مهم:</b> برای بسته‌بودن برنامه از «اعلان محلی سیستم» استفاده می‌شود که اندروید در همان زمان نمایش می‌دهد؛ صدای زنگ به تنظیمات اعلان گوشی و حالت «پراهمیت» بستگی دارد. اگر گوشی اعلان‌ها را محدود یا بهینه‌سازی باتری را فعال کند، ممکن است دیرتر برسد. در مرورگر، اعلان فقط تا وقتی برنامه باز است نمایش داده می‌شود.
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="یادآوری جدید" description="تاریخ شمسی، ساعت دقیق و تکرار را مشخص کنید." size="sm">
        <div className="space-y-3 p-5">
          <TextField label="عنوان یادآوری" value={title} onChange={(value) => { setTitle(value); setError(""); }} placeholder="مثلاً پیگیری طلب از کارخانه" required />
          <div className="grid grid-cols-2 gap-2">
            <TextField label="ساعت (۰ تا ۲۳)" value={String(hour)} onChange={(value) => setHour(Math.min(23, Number(value.replace(/\D/g, "")) || 0))} numeric placeholder="۹" />
            <TextField label="دقیقه (۰ تا ۵۹)" value={String(minute)} onChange={(value) => setMinute(Math.min(59, Number(value.replace(/\D/g, "")) || 0))} numeric placeholder="۰" />
          </div>
          <JalaliDatePicker label="تاریخ یادآوری" value={date} onChange={(value) => setDate(value)} />
          <SelectField label="تکرار" value={repeat} onChange={(value) => setRepeat(value as Reminder["repeat"])} options={[{ value: "once", label: "یک‌بار" }, { value: "daily", label: "هر روز" }, { value: "weekly", label: "هر هفته" }]} />
          <TextField label="توضیح (اختیاری)" value={note} onChange={setNote} textarea rows={2} placeholder={`یادآوری برای ${profile.fullName || "کسب‌وکار"}`} />
          <button type="button" onClick={submit} className="w-full rounded-xl bg-mint-400 py-2.5 text-[11px] font-bold text-[#07110d]">ثبت و زمان‌بندی اعلان</button>
          {error && <p className="text-[9px] text-[#f0a59a]">{error}</p>}
        </div>
      </Modal>
      <Toast open={Boolean(toast)} message={toast ?? ""} onClose={() => setToast(null)} />
    </div>
  );
}
