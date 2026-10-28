import {
  addKnowledge,
  ensureKnowledgeBase,
  knowledgeStats,
  recordFeedback,
  searchKnowledge,
} from "@/lib/ai/knowledge-engine";

export const dynamic = "force-dynamic";

/**
 * GET  /api/knowledge?q=...   → جستجوی مغز دستیار + آمار دانش
 * POST /api/knowledge         → افزودن دانش جدید (پرسش/پاسخ/موضوع)
 * PATCH /api/knowledge        → بازخورد «مفید بود / نبود» برای یادگیری وزن دانش
 */
export async function GET(request: Request) {
  await ensureKnowledgeBase();
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 500);
  const limitRaw = Number(url.searchParams.get("limit") ?? 5);
  const limit = Number.isFinite(limitRaw) ? Math.min(12, Math.max(1, limitRaw)) : 5;
  const [stats, matches] = await Promise.all([knowledgeStats(), query ? searchKnowledge(query, limit) : Promise.resolve([])]);
  return Response.json({
    stats,
    query,
    matches: matches.map((match) => ({
      id: match.id,
      slug: match.slug,
      category: match.category,
      question: match.question,
      answer: match.answer,
      source: match.source,
      confidence: Number(match.confidence.toFixed(3)),
      score: Number(match.score.toFixed(2)),
    })),
  });
}

export async function POST(request: Request) {
  let payload: { question?: unknown; answer?: unknown; category?: unknown; keywords?: unknown; source?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return Response.json({ error: "بدنهٔ درخواست معتبر نیست" }, { status: 400 });
  }
  const question = String(payload.question ?? "").trim();
  const answer = String(payload.answer ?? "").trim();
  if (question.length < 5 || answer.length < 10) {
    return Response.json({ error: "پرسش (حداقل ۵) و پاسخ (حداقل ۱۰ نویسه) لازم است." }, { status: 400 });
  }
  if (question.length > 500 || answer.length > 6000) {
    return Response.json({ error: "طول پرسش یا پاسخ بیش از حد مجاز است." }, { status: 413 });
  }
  const row = await addKnowledge({
    question,
    answer,
    category: typeof payload.category === "string" ? payload.category : undefined,
    keywords: typeof payload.keywords === "string" ? payload.keywords : undefined,
    source: typeof payload.source === "string" ? payload.source : undefined,
  });
  return Response.json({ ok: true, ...row }, { status: 201 });
}

export async function PATCH(request: Request) {
  let payload: { interactionId?: unknown; helpful?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return Response.json({ error: "بدنهٔ درخواست معتبر نیست" }, { status: 400 });
  }
  const interactionId = Number(payload.interactionId);
  if (!Number.isFinite(interactionId) || interactionId <= 0 || typeof payload.helpful !== "boolean") {
    return Response.json({ error: "شناسهٔ گفتگو و مقدار helpful لازم است." }, { status: 400 });
  }
  await recordFeedback(interactionId, payload.helpful);
  return Response.json({ ok: true, learned: payload.helpful });
}
