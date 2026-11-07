"use server";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, answerChoices, bookmarks, chapters, questions, testQuestions, tests, topics, userAnswers } from "@/db";
import { getUser } from "@/lib/auth";
import { latestForQuestions, type Reveal } from "@/lib/questions";
import { peerStats } from "@/lib/peers";
import { accessibleSubjectIds, assertQuestionAccess } from "@/lib/access";
import { normalizeTag, parseTags } from "@/lib/tags";
import { track } from "@/lib/analytics";

async function me() {
  const user = await getUser();
  if (!user) throw new Error("Not signed in");
  return user;
}

export type SessionInput = {
  mode: "study" | "exam";
  topicIds: string[];
  count: number;
  pool: "all" | "unanswered" | "incorrect" | "bookmarked" | "answered";
  tags: string[];
  randomize: boolean;
  timed: boolean;
  minutes: number;
  /** Mock exam: how many questions to take from each chapter (chapterId → count). */
  perChapter?: Record<string, number>;
};

const MAX_QUESTIONS = 200;

function shuffle<T>(a: T[]) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

async function insertSession(userId: string, mode: "study" | "exam", questionIds: string[], opts: { timed: boolean; minutes: number; randomize: boolean; filters: object }) {
  const [t] = await db.insert(tests).values({
    userId, mode, timed: mode === "exam" && opts.timed, timeLimitSec: mode === "exam" && opts.timed ? Math.round(opts.minutes * 60) : null,
    randomized: opts.randomize, filters: JSON.stringify(opts.filters),
  }).returning({ id: tests.id });
  await db.insert(testQuestions).values(questionIds.map((questionId, position) => ({ testId: t.id, questionId, position })));
  return t.id;
}

export async function createSession(input: SessionInput): Promise<{ id?: string; error?: string }> {
  const user = await me();
  if (!["study", "exam"].includes(input.mode)) return { error: "Choose study or exam mode." };
  if (!input.topicIds?.length) return { error: "Choose at least one topic." };
  // Tags arrive as "subjectId::tag": each subject is filtered only by the exams picked inside it, and a
  // subject with nothing picked keeps all its questions. A bare tag (older clients) applies to every subject.
  const scoped = new Map<string, Set<string>>(), wantAll = new Set<string>();
  const norm = (t: string) => (t === "__none" ? t : normalizeTag(t));
  for (const raw of (input.tags ?? []).slice(0, 200)) {
    const s = String(raw), i = s.indexOf("::");
    const t = norm((i > 0 ? s.slice(i + 2) : s).trim());
    if (!t) continue;
    if (i > 0) { const sid = s.slice(0, i); const set = scoped.get(sid) ?? new Set<string>(); set.add(t); scoped.set(sid, set); }
    else wantAll.add(t);
  }
  const count = Math.max(1, Math.min(MAX_QUESTIONS, Math.floor(input.count) || 0));
  const minutes = Math.max(1, Math.min(360, Math.floor(input.minutes) || 0));

  const allowed = [...(await accessibleSubjectIds(user.id))];
  if (!allowed.length) return { error: "Subscribe to a subject first to create a session." };
  let cands = await db.select({ id: questions.id, tags: questions.tags, subjectId: chapters.subjectId, chapterId: chapters.id, groupId: questions.groupId, groupOrder: questions.groupOrder })
    .from(questions).innerJoin(topics, eq(questions.topicId, topics.id)).innerJoin(chapters, eq(topics.chapterId, chapters.id))
    .where(and(inArray(questions.topicId, input.topicIds.slice(0, 500)), inArray(chapters.subjectId, allowed)))
    .orderBy(asc(chapters.order), asc(chapters.name), asc(topics.order), asc(topics.name), asc(questions.order));
  // Empty tag choice = no filter. "__none" matches questions that have no tag.
  const pass = (want: Set<string>, tags: string) => { const t = parseTags(tags); return t.length ? t.some((x) => want.has(x)) : want.has("__none"); };
  if (scoped.size || wantAll.size) cands = cands.filter((c) => { const want = scoped.get(c.subjectId) ?? (wantAll.size ? wantAll : null); return want ? pass(want, c.tags) : true; });
  let ids = cands.map((c) => c.id);

  if (input.pool !== "all" && ids.length) {
    const latest = await latestForQuestions(user.id, ids);
    if (input.pool === "bookmarked") {
      const bm = new Set((await db.select({ id: bookmarks.questionId }).from(bookmarks).where(and(eq(bookmarks.userId, user.id), inArray(bookmarks.questionId, ids)))).map((b) => b.id));
      ids = ids.filter((id) => bm.has(id));
    } else if (input.pool === "unanswered") ids = ids.filter((id) => !latest.has(id));
    else if (input.pool === "answered") ids = ids.filter((id) => latest.has(id));
    else if (input.pool === "incorrect") ids = ids.filter((id) => latest.get(id)?.isCorrect === false);
  }
  if (!ids.length) return { error: "No questions match these choices. Try a different pool or more topics." };

  // Cases, EMQs and true/false blocks are kept whole: the blocks are shuffled, never the questions
  // inside one, and a block is taken entire even when that overshoots the number asked for —
  // better a couple of extra questions than half a case. A pool like "incorrect only" has already
  // narrowed the list, so a block then holds just the questions that survived it.
  const keep = new Set(ids), units: string[][] = [], seenGroup = new Set<string>();
  for (const c of cands) {
    if (!keep.has(c.id)) continue;
    if (!c.groupId) { units.push([c.id]); continue; }
    if (seenGroup.has(c.groupId)) continue;
    seenGroup.add(c.groupId);
    units.push(cands.filter((x) => x.groupId === c.groupId && keep.has(x.id)).sort((a, b) => a.groupOrder - b.groupOrder).map((x) => x.id));
  }
  const picked: string[] = [];
  let mock: Record<string, number> | null = null;
  if (input.mode === "exam" && input.perChapter && Object.keys(input.perChapter).length) {
    // Mock exam: fill each chapter's quota from its own questions, then mix the chapters together.
    mock = {};
    for (const [cid, n] of Object.entries(input.perChapter).slice(0, 200)) { const k = Math.max(0, Math.min(MAX_QUESTIONS, Math.floor(Number(n)) || 0)); if (k) mock[cid] = k; }
    const chapterOf = new Map(cands.map((c) => [c.id, c.chapterId]));
    const chosen: string[][] = [];
    for (const [cid, want] of Object.entries(mock)) {
      const mine = shuffle(units.filter((u) => chapterOf.get(u[0]) === cid));
      // Take whatever fits the quota first (single questions, small blocks), then one more block only
      // if the chapter would otherwise come up short — so a case of 4 never turns 2 questions into 6.
      let got = 0;
      const rest: string[][] = [];
      for (const u of mine) { if (got + u.length <= want) { chosen.push(u); got += u.length; } else rest.push(u); }
      if (got < want && rest.length) chosen.push(rest.sort((a, b) => a.length - b.length)[0]);
    }
    shuffle(chosen);
    for (const u of chosen) { if (picked.length >= MAX_QUESTIONS) break; picked.push(...u); }
    if (!picked.length) return { error: "No questions match these choices. Try a different pool or other exams." };
  } else {
    if (input.randomize) shuffle(units);
    for (const u of units) { if (picked.length >= count) break; picked.push(...u); }
  }
  ids = picked;
  const timed = mock ? true : input.timed;
  const id = await insertSession(user.id, input.mode, ids, { timed, minutes, randomize: mock ? true : input.randomize, filters: { topicIds: input.topicIds, pool: input.pool, tags: (input.tags ?? []).slice(0, 200), ...(mock ? { mock: true, perChapter: mock } : {}) } });
  await track(user.id, "session_started", { mode: mock ? "mock_exam" : input.mode, questions: ids.length, minutes: timed ? minutes : null, pool: input.pool, exam_tags: (input.tags ?? []).length });
  return { id };
}

/** Study sessions return the correct answer straight away; exam sessions only record the choice. */
export async function answerInSession(testId: string, questionId: string, choiceId: string, timeSpentSec: number): Promise<Reveal | null> {
  const user = await me();
  const [t] = await db.select().from(tests).where(and(eq(tests.id, testId), eq(tests.userId, user.id))).limit(1);
  if (!t || t.finishedAt) throw new Error("This session is finished.");
  if (t.timed && t.timeLimitSec && Date.now() > t.startedAt.getTime() + (t.timeLimitSec + 15) * 1000) throw new Error("Time is up.");
  const [tq] = await db.select({ id: testQuestions.id }).from(testQuestions).where(and(eq(testQuestions.testId, testId), eq(testQuestions.questionId, questionId))).limit(1);
  if (!tq) throw new Error("Question is not part of this session.");

  await assertQuestionAccess(user.id, questionId);
  const choices = await db.select().from(answerChoices).where(eq(answerChoices.questionId, questionId));
  const picked = choices.find((c) => c.id === choiceId), correct = choices.filter((c) => c.isCorrect);
  if (!picked || !correct.length) throw new Error("Invalid choice");

  // In an exam the student may change an answer until they finish, so keep only the latest choice.
  if (t.mode === "exam") await db.delete(userAnswers).where(and(eq(userAnswers.userId, user.id), eq(userAnswers.questionId, questionId), eq(userAnswers.testId, testId)));
  await db.insert(userAnswers).values({ userId: user.id, questionId, choiceId, isCorrect: picked.isCorrect, testId, timeSpentSec: Math.max(0, Math.min(3600, Math.round(timeSpentSec))) });

  if (t.mode === "exam") return null;
  const [q] = await db.select({ explanation: questions.explanation }).from(questions).where(eq(questions.id, questionId)).limit(1);
  const peers = (await peerStats([questionId])).get(questionId) ?? null;
  return { choiceId, isCorrect: picked.isCorrect, correctChoiceIds: correct.map((c) => c.id), explanation: q.explanation, peers };
}

export async function finishSession(testId: string) {
  const user = await me();
  const done = await db.update(tests).set({ finishedAt: new Date() }).where(and(eq(tests.id, testId), eq(tests.userId, user.id), isNull(tests.finishedAt))).returning({ mode: tests.mode, filters: tests.filters });
  if (done[0]) {
    const r = Array.from((await db.execute(sql`
      select (select count(*) from test_questions where test_id = ${testId})::int as total,
             (select count(*) from (select distinct on (question_id) is_correct from user_answers where test_id = ${testId} and user_id = ${user.id} order by question_id, answered_at desc) y where y.is_correct)::int as correct`)) as unknown as ArrayLike<{ total: number; correct: number }>)[0];
    const mock = (done[0].filters ?? "").includes('"mock":true');
    const score = r?.total ? Math.round((r.correct / r.total) * 100) : 0;
    await track(user.id, "session_finished", { mode: mock ? "mock_exam" : done[0].mode, questions: r?.total ?? 0, score, passed: mock ? score >= 60 : null });
  }
}

/** Starts a new study session containing only the questions missed in a finished session. */
export async function retryIncorrect(formData: FormData) {
  const user = await me();
  const testId = String(formData.get("testId"));
  const [t] = await db.select({ id: tests.id }).from(tests).where(and(eq(tests.id, testId), eq(tests.userId, user.id))).limit(1);
  if (!t) throw new Error("Session not found");
  const tqs = await db.select({ id: testQuestions.questionId, position: testQuestions.position }).from(testQuestions).where(eq(testQuestions.testId, testId)).orderBy(asc(testQuestions.position));
  const latest = await latestForQuestions(user.id, tqs.map((x) => x.id), testId);
  const wrong = tqs.filter((x) => latest.get(x.id)?.isCorrect === false).map((x) => x.id);
  if (!wrong.length) redirect(`/results/${testId}`);
  const id = await insertSession(user.id, "study", wrong, { timed: false, minutes: 0, randomize: false, filters: { retryOf: testId } });
  redirect(`/session/${id}`);
}
