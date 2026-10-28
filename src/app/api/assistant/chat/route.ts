import { db } from "@/db";
import { assistantNotes, chatMessages, chatThreads } from "@/db/schema";
import { respond, type ChatMode, type EngineReply } from "@/lib/ai/engine";
import { logInteraction, looksLikeQuestion, needsLiveData, searchKnowledge } from "@/lib/ai/knowledge-engine";
import { ensureSeeded } from "@/lib/seed";
import { and, asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

type Mode = ChatMode;

const isMode = (value: unknown): value is Mode => value === "support" || value === "assistant";

async function latestThread(mode: Mode) {
  const rows = await db
    .select()
    .from(chatThreads)
    .where(eq(chatThreads.mode, mode))
    .orderBy(desc(chatThreads.updatedAt))
    .limit(1);
  return rows[0] ?? null;
}

async function createThread(mode: Mode) {
  const rows = await db
    .insert(chatThreads)
    .values({ mode, title: mode === "support" ? "پشتیبان" : "دستیار", state: {} })
    .returning();
  return rows[0];
}

async function listMessages(threadId: number) {
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.threadId, threadId))
    .orderBy(asc(chatMessages.id));
}

export async function GET(request: Request) {
  await ensureSeeded();
  const url = new URL(request.url);
  const modeParam = url.searchParams.get("mode");
  const mode: Mode = isMode(modeParam) ? modeParam : "support";
  const thread = (await latestThread(mode)) ?? (await createThread(mode));
  const [messages, notes] = await Promise.all([
    listMessages(thread.id),
    db.select().from(assistantNotes).orderBy(desc(assistantNotes.id)).limit(8),
  ]);
  return Response.json({
    threadId: thread.id,
    mode,
    messages: messages.map((m) => ({ id: m.id, role: m.role, content: m.content, meta: m.meta })),
    notes,
  });
}

export async function POST(request: Request) {
  await ensureSeeded();
  let payload: { mode?: unknown; message?: unknown; threadId?: unknown; action?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return Response.json({ error: "بدنه درخواست معتبر نیست" }, { status: 400 });
  }

  const mode: Mode = isMode(payload.mode) ? payload.mode : "assistant";

  if (payload.action === "new") {
    const thread = await createThread(mode);
    return Response.json({ threadId: thread.id, mode, messages: [], notes: [] });
  }

  const message = String(payload.message ?? "").trim();
  if (!message) return Response.json({ error: "پیام خالی است" }, { status: 400 });
  if (message.length > 2000) return Response.json({ error: "پیام بیش از حد طولانی است" }, { status: 400 });

  let thread = payload.threadId
    ? (
        await db
          .select()
          .from(chatThreads)
          .where(and(eq(chatThreads.id, Number(payload.threadId)), eq(chatThreads.mode, mode)))
          .limit(1)
      )[0]
    : await latestThread(mode);
  if (!thread) thread = await createThread(mode);

  await db.insert(chatMessages).values({ threadId: thread.id, role: "user", content: message });

  let reply: EngineReply;
  let nextState: Record<string, unknown>;
  let refs: { id: number; question: string; category: string; source: string; confidence: number }[] = [];
  let confidence = 0;
  let usedKnowledgeId: number | null = null;
  try {
    // مغز دانش: اول پایگاه دائمی، بعد موتور قطعی. پرسش‌های مالی دربارهٔ
    // همین مزرعه هرگز با پاسخ عمومی جایگزین نمی‌شوند.
    const matches = await searchKnowledge(message, 3).catch(() => []);
    const best = matches[0];
    const grounded =
      Boolean(best) &&
      best.confidence >= 0.3 &&
      !needsLiveData(message) &&
      (looksLikeQuestion(message) || best.score >= 11);
    if (best && grounded) {
      reply = {
        text: `${best.answer}\n\nمنبع: ${best.source}`,
        actions: [{ label: `موضوع: ${best.category}`, href: "/knowledge", kind: "knowledge" }],
        suggestions: matches.slice(1).map((match) => match.question).slice(0, 3),
        kind: "answer",
      };
      nextState = thread.state ?? {};
      confidence = best.confidence;
      usedKnowledgeId = best.id;
      refs = matches.map((match) => ({
        id: match.id,
        question: match.question,
        category: match.category,
        source: match.source,
        confidence: Number(match.confidence.toFixed(2)),
      }));
    } else {
      const result = await respond({ mode, message, state: thread.state ?? {} });
      reply = result.reply;
      nextState = result.state;
    }
  } catch (error) {
    console.error("assistant error", error);
    return Response.json({ error: "پردازش پیام ممکن نشد. دوباره تلاش کنید." }, { status: 500 });
  }

  const interactionId = await logInteraction({
    mode,
    question: message,
    answer: reply.text,
    confidence,
    knowledgeId: usedKnowledgeId,
    source: usedKnowledgeId ? "knowledge" : "engine",
  });

  await db.insert(chatMessages).values({
    threadId: thread.id,
    role: "assistant",
    content: reply.text,
    meta: {
      actions: reply.actions,
      suggestions: reply.suggestions,
      kind: reply.kind,
      refs,
      confidence,
      interactionId,
      grounded: usedKnowledgeId !== null,
    },
  });

  const title =
    thread.title === "پشتیبان" || thread.title === "دستیار"
      ? message.slice(0, 42)
      : thread.title;

  await db
    .update(chatThreads)
    .set({ state: nextState, updatedAt: new Date(), title })
    .where(eq(chatThreads.id, thread.id));

  try {
    revalidatePath("/");
    revalidatePath("/transactions");
    revalidatePath("/finance");
    revalidatePath("/inventory");
    revalidatePath("/labor");
  } catch {
    /* revalidation is best-effort inside route handlers */
  }

  const messages = await listMessages(thread.id);
  return Response.json({
    threadId: thread.id,
    mode,
    messages: messages.map((m) => ({ id: m.id, role: m.role, content: m.content, meta: m.meta })),
  });
}
