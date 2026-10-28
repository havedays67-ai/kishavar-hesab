import Link from "next/link";
import { getKnowledge, getNotes } from "@/lib/data";
import { knowledgeStats, searchKnowledge } from "@/lib/ai/knowledge-engine";
import { normalizeFa } from "@/lib/ai/nlu";
import { formatNumber } from "@/lib/format";
import { Badge, Card, EmptyState, Icon, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ q?: string; topic?: string }> }) {
  const sp = await searchParams;
  const [rows, notes] = await Promise.all([getKnowledge(), getNotes(6)]);
  const brain = await knowledgeStats().catch(() => ({ entries: 0, samples: 0, interactions: 0, categories: [] as { category: string; count: number }[] }));
  const topics = [...new Set(rows.map((r) => r.topic))];
  const q = normalizeFa(sp.q ?? "");
  const filtered = rows.filter((row) => {
    if (sp.topic && row.topic !== sp.topic) return false;
    if (!q) return true;
    return normalizeFa(`${row.title} ${row.topic} ${row.tags} ${row.content}`).includes(q);
  });

  const brainMatches = q ? await searchKnowledge(sp.q ?? "", 4).catch(() => []) : [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="پایگاه دانش کشاورزی"
        subtitle="آموزش تمیز و دسته‌بندی‌شده حسابداری کشاورزی: از بهای تمام‌شده تا استهلاک، انبار، زعفران و مدیریت نقدینگی."
        icon="book"
        actions={
          <Link href="/assistant" className="btn btn-sm">
            <Icon name="sparkles" className="h-3.5 w-3.5" />
            پرسش از پشتیبان
          </Link>
        }
      />

      <Card className="card-pad border-farm-200 bg-farm-50/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon name="sparkles" className="h-4 w-4 text-farm-700" />
            <h2 className="section-title m-0">مغز دائمی کشاورزیار</h2>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[10px]">
            <span className="chip">{formatNumber(brain.entries)} واحد دانش</span>
            <span className="chip">{formatNumber(brain.samples)} نمونهٔ آموزشی</span>
            <span className="chip">{formatNumber(brain.interactions)} گفتگوی ثبت‌شده</span>
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-6 text-[#5b6a5e]">
          این پایگاه در PostgreSQL ذخیره می‌شود و دستیار از همین ردیف‌ها پاسخ می‌دهد؛ هر بازخورد «مفید بود» وزن همان واحد دانش را بالا می‌برد.
          پاسخ‌های مالی همیشه از دادهٔ واقعی مزرعه (با موتور قطعی) ساخته می‌شوند و هرگز با متن عمومی جایگزین نمی‌شوند.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {brain.categories.slice(0, 10).map((category) => (
            <Link key={category.category} href={`/knowledge?topic=${encodeURIComponent(category.category)}`} className="chip">
              {category.category} · {formatNumber(category.count)}
            </Link>
          ))}
        </div>
        {q ? (
          <div className="mt-3 space-y-2">
            <p className="text-[11px] font-bold text-farm-900">پاسخ‌های بازیابی‌شده از مغز دستیار برای «{sp.q}»</p>
            {brainMatches.length === 0 ? (
              <p className="text-[11px] text-[#7c8a7f]">موردی با اطمینان کافی پیدا نشد؛ می‌توانید همین پرسش را در بخش دستیار بپرسید.</p>
            ) : (
              brainMatches.map((match) => (
                <div key={match.id} className="rounded-xl border border-[#efe9d9] bg-white p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <p className="text-[11px] font-bold text-farm-900">{match.question}</p>
                    <span className="chip">{match.category} · اطمینان {Math.round(match.confidence * 100)}٪</span>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-[10.5px] leading-6 text-[#4a5a4c]">{match.answer}</p>
                  <p className="mt-1 text-[9px] text-[#8a978c]">منبع: {match.source}</p>
                </div>
              ))
            )}
          </div>
        ) : null}
      </Card>

      <Card className="card-pad">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <label className="min-w-[180px] flex-1">
            <span className="label">جستجو در پایگاه دانش</span>
            <input name="q" defaultValue={sp.q ?? ""} placeholder="مثلاً بهای تمام‌شده، استهلاک، انبار" className="input" />
          </label>
          <label className="min-w-[140px]">
            <span className="label">موضوع</span>
            <select name="topic" defaultValue={sp.topic ?? ""} className="input">
              <option value="">همه موضوعات</option>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary">
            <Icon name="search" className="h-4 w-4" />
            جستجو
          </button>
          <Link href="/knowledge" className="btn">
            پاک‌کردن
          </Link>
        </form>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {topics.map((t) => (
            <Link
              key={t}
              href={`/knowledge?topic=${encodeURIComponent(t)}`}
              className={`chip ${sp.topic === t ? "border-farm-300 bg-farm-50 text-farm-800" : ""}`}
            >
              {t}
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-2.5">
          {filtered.map((row) => (
            <details key={row.id} className="card group">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-2 p-4">
                <div>
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-farm-900">
                    {row.title}
                    <Badge tone="green">{row.topic}</Badge>
                    <Badge tone="neutral">{row.level}</Badge>
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#7c8a7f]">{row.content.slice(0, 140)}…</p>
                </div>
                <Icon name="chevron" className="mt-1 h-4 w-4 shrink-0 rotate-90 text-[#84907f] transition group-open:-rotate-90" />
              </summary>
              <div className="border-t border-[#f0ebdd] p-4">
                <p className="whitespace-pre-wrap text-[12px] leading-7 text-[#3d4c41]">{row.content}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-[#84907f]">برچسب‌ها: {row.tags}</span>
                  <Link
                    href={`/assistant`}
                    className="chip border-farm-200 bg-farm-50 text-farm-800"
                  >
                    <Icon name="sparkles" className="h-3 w-3" />
                    پرسیدن درباره این موضوع
                  </Link>
                </div>
              </div>
            </details>
          ))}
          {!filtered.length ? <EmptyState title="موردی پیدا نشد" hint="عبارت دیگری جستجو کنید یا موضوع را تغییر دهید." /> : null}
        </div>

        <aside className="space-y-3">
          <Card className="card-pad">
            <h2 className="section-title mb-2 text-sm">یاد گرفته‌های هوش از مزرعه شما</h2>
            <ul className="space-y-2">
              {notes.map((note) => (
                <li key={note.id} className="rounded-xl border border-[#f0ebdd] p-2.5">
                  <p className="text-[11px] font-semibold text-farm-900">{note.title}</p>
                  <p className="mt-1 text-[10px] leading-5 text-[#7c8a7f]">{note.detail}</p>
                </li>
              ))}
              {!notes.length ? <li className="text-[11px] text-[#84907f]">در حال یادگیری…</li> : null}
            </ul>
          </Card>
          <Card className="card-pad bg-sand-50">
            <p className="text-[11px] leading-6 text-[#5b6a5e]">
              این پایگاه دانش به‌صورت دستی و تمیز (بدون متن‌های نامعتبر) نوشته شده است. هوش مصنوعی هنگام پاسخ، فقط از همین محتوا و داده‌های ثبت‌شده شما
              استفاده می‌کند و عددی از خود نمی‌سازد.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
