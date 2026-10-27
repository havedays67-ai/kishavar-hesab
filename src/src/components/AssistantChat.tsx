"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";

type Msg = {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  meta?: {
    suggestions?: string[];
    actions?: { label: string; href?: string; kind: string }[];
    kind?: string;
  };
};

type Note = { id: number; title: string; detail: string; confidence: number; kind: string };

type Mode = "support" | "assistant";

const MODE_META: Record<Mode, { title: string; short: string; description: string; icon: string }> = {
  support: {
    title: "پشتیبان",
    short: "آموزش و گزارش",
    description: "راهنمای هر بخش نرم‌افزار و آموزش حسابداری کشاورزی + تهیه گزارش. بدون تغییر داده.",
    icon: "book",
  },
  assistant: {
    title: "دستیار",
    short: "ثبت با گفتگو",
    description: "با حرف زدن هزینه، درآمد، چک، بدهی، دستمزد و انبار را ثبت می‌کند؛ ناقص بود سؤال می‌پرسد و قبل از ثبت تأیید می‌گیرد.",
    icon: "sparkles",
  },
};

const STARTERS: Record<Mode, string[]> = {
  support: ["گزارش سود و زیان بده", "بهای تمام‌شده هر کیلو چطور حساب می‌شود؟", "استهلاک تراکتور را توضیح بده", "هشدارهای نقدینگی چیست؟"],
  assistant: ["۲۵ میلیون کود اوره برای زمین شمالی خریدم", "برای فروشگاه نهاده ۴۴ میلیون چک ۱۰ روز بعد بنویس", "دستمزد حسن ۳ روز کار برداشت را ثبت کن", "۱۰ میلیون از صنایع تبدیلی طلب دارم"],
};

export function AssistantChat({ initialNotes }: { initialNotes: Note[] }) {
  const [mode, setMode] = useState<Mode>("support");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [threadId, setThreadId] = useState<number | null>(null);
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const loadThread = useCallback(async (nextMode: Mode) => {
    setBooting(true);
    setError(null);
    try {
      const res = await fetch(`/api/assistant/chat?mode=${nextMode}`, { cache: "no-store" });
      if (!res.ok) throw new Error("خطا در بارگذاری گفتگو");
      const data = (await res.json()) as { threadId: number; messages: Msg[]; notes?: Note[] };
      setThreadId(data.threadId);
      setMessages(data.messages ?? []);
      if (data.notes) setNotes(data.notes);
    } catch {
      setError("ارتباط با دستیار برقرار نشد. اتصال را بررسی کنید.");
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    void loadThread(mode);
  }, [mode, loadThread]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || loading) return;
    setInput("");
    setError(null);
    setLoading(true);
    const localId = `local-${Date.now()}`;
    setMessages((prev) => [...prev, { id: localId, role: "user", content: message }]);
    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, message, threadId }),
      });
      const data = (await res.json()) as { messages?: Msg[]; threadId?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "خطا در پردازش پیام");
      setMessages(data.messages ?? []);
      if (data.threadId) setThreadId(data.threadId);
      const notesRes = await fetch(`/api/assistant/chat?mode=${mode}`, { cache: "no-store" });
      if (notesRes.ok) {
        const refreshed = (await notesRes.json()) as { notes?: Note[] };
        if (refreshed.notes) setNotes(refreshed.notes);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای نامشخص");
      setMessages((prev) => prev.filter((m) => m.id !== localId));
    } finally {
      setLoading(false);
    }
  }

  async function newChat() {
    setLoading(true);
    try {
      await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, action: "new" }),
      });
      await loadThread(mode);
    } finally {
      setLoading(false);
    }
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const suggestions = lastAssistant?.meta?.suggestions?.length ? lastAssistant.meta.suggestions : STARTERS[mode];

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="card flex min-h-[70vh] flex-col overflow-hidden lg:min-h-[75vh]">
        <div className="border-b border-[#eee9dc] bg-white/80 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-farm-600 to-farm-800 text-white">
                <Icon name="sparkles" className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-farm-900">هوش کشاورزحساب</p>
                <p className="text-[10px] text-[#7c8a7f]">فقط درباره همین نرم‌افزار و حسابداری کشاورزی</p>
              </div>
            </div>
            <button type="button" onClick={newChat} className="btn btn-sm" disabled={loading}>
              <Icon name="plus" className="h-3.5 w-3.5" />
              گفتگوی جدید
            </button>
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2">
            {(Object.keys(MODE_META) as Mode[]).map((key) => {
              const meta = MODE_META[key];
              const active = mode === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMode(key)}
                  className={`rounded-xl border p-2 text-right transition ${
                    active ? "border-farm-500 bg-farm-50" : "border-[#eee9dc] bg-white hover:bg-sand-50"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-xs font-bold text-farm-900">
                    <Icon name={meta.icon} className="h-4 w-4" />
                    {meta.title}
                    <span className={`mr-auto rounded-full px-1.5 py-0.5 text-[9px] ${active ? "bg-farm-600 text-white" : "bg-sand-100 text-[#6a7a6d]"}`}>
                      {active ? "فعال" : meta.short}
                    </span>
                  </span>
                  <span className="mt-1 block text-[10px] leading-4 text-[#7c8a7f]">{meta.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="chat-scroll flex-1 space-y-3 overflow-y-auto bg-[#faf8f2]/60 p-3">
          {booting ? (
            <p className="py-8 text-center text-xs text-[#84907f]">در حال آماده‌سازی دستیار…</p>
          ) : null}

          {!booting && !messages.length ? (
            <div className="mx-auto max-w-md rounded-2xl border border-[#eee9dc] bg-white p-4 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-farm-50 text-farm-700">
                <Icon name="sparkles" className="h-6 w-6" />
              </span>
              <p className="mt-2 text-sm font-bold text-farm-900">سلام! من {MODE_META[mode].title} کشاورزحساب هستم</p>
              <p className="mt-1 text-[11px] leading-5 text-[#7c8a7f]">{MODE_META[mode].description}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {STARTERS[mode].slice(0, 3).map((s) => (
                  <button key={s} type="button" onClick={() => void send(s)} className="chip text-right hover:bg-farm-50">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[92%] rounded-2xl px-3 py-2.5 text-[12px] leading-6 shadow-sm sm:max-w-[85%] ${
                  m.role === "user"
                    ? "rounded-br-md border border-farm-200 bg-white text-[#1d2a21]"
                    : "rounded-bl-md border border-farm-700/20 bg-gradient-to-br from-farm-800 to-farm-900 text-farm-50"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                {m.meta?.actions?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.meta.actions.map((a, i) =>
                      a.href ? (
                        <Link
                          key={`${a.label}-${i}`}
                          href={a.href}
                          className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2 py-1 text-[10px] font-medium text-white hover:bg-white/25"
                        >
                          <Icon name="arrow" className="h-3 w-3" />
                          {a.label}
                        </Link>
                      ) : null,
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          ))}

          {loading ? (
            <div className="flex justify-end">
              <div className="rounded-2xl bg-farm-900 px-3 py-2 text-[11px] text-farm-100">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-farm-200" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-farm-200 [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-farm-200 [animation-delay:240ms]" />
                  در حال بررسی داده‌های مزرعه…
                </span>
              </div>
            </div>
          ) : null}

          {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-[11px] text-red-700">{error}</p> : null}
          <div ref={endRef} />
        </div>

        <div className="border-t border-[#eee9dc] bg-white p-2.5">
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
            {suggestions.slice(0, 4).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                className="shrink-0 rounded-full border border-[#e2dccb] bg-sand-50 px-2.5 py-1 text-[10px] font-medium text-[#4a5a4c] hover:border-farm-300 hover:bg-farm-50"
              >
                {s}
              </button>
            ))}
          </div>
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              placeholder={mode === "support" ? "سوال آموزشی یا گزارش بخواهید…" : "مثلاً: ۵ میلیون گازوئیل برای زمین شمالی خریدم"}
              className="input max-h-28 min-h-[42px] flex-1 resize-none py-2.5 text-xs"
            />
            <button type="submit" className="btn btn-primary h-[42px] px-3" disabled={loading || !input.trim()}>
              <Icon name="arrow" className="h-4 w-4 rotate-180" />
            </button>
          </form>
          <p className="mt-1.5 text-center text-[9px] text-[#9aa69c]">
            {mode === "support"
              ? "حالت پشتیبان: فقط آموزش و گزارش، بدون اجازه تغییر داده."
              : "حالت دستیار: قبل از هر ثبت، خلاصه را نشان می‌دهد و تأیید می‌گیرد."}
          </p>
        </div>
      </div>

      <aside className="space-y-3">
        <div className="card card-pad">
          <div className="section-title mb-2 text-sm">
            <span className="flex items-center gap-1.5">
              <Icon name="bolt" className="h-4 w-4 text-clay-500" />
              چیزهایی که یاد گرفته‌ام
            </span>
          </div>
          <ul className="space-y-2">
            {notes.slice(0, 6).map((note) => (
              <li key={note.id} className="rounded-xl border border-[#f0ebdd] p-2.5">
                <p className="text-[11px] font-semibold text-farm-900">{note.title}</p>
                <p className="mt-1 line-clamp-3 text-[10px] leading-5 text-[#7c8a7f]">{note.detail}</p>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#eee9dc]">
                  <div className="h-full rounded-full bg-farm-500" style={{ width: `${Math.round(note.confidence * 100)}%` }} />
                </div>
              </li>
            ))}
            {!notes.length ? <li className="text-[11px] text-[#84907f]">در حال یادگیری از داده‌های مزرعه…</li> : null}
          </ul>
        </div>

        <div className="card card-pad bg-farm-50">
          <p className="text-[11px] leading-6 text-farm-900">
            🔒 محدوده دسترسی: هوش فقط به داده‌های همین نرم‌افزار (زمین، کشت، هزینه، درآمد، انبار، کارگر، بدهی و چک) دسترسی دارد و درباره موضوعات بیربط پاسخ
            نمی‌دهد.
          </p>
        </div>
      </aside>
    </div>
  );
}
