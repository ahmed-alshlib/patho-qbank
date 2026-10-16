import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { parseTags } from "@/lib/tags";
import { db, subjects, chapters, topics, questions, answerChoices, questionGroups } from "@/db";

export type ImportQ = { text: string; choices?: string[]; correct: string; explanation: string; tags?: string | string[] };

/** case = shared scenario · emq = shared option list · tf = shared true/false stem */
export type GroupKind = "case" | "emq" | "tf";

export type ImportGroup = {
  kind: GroupKind;
  /** Short heading: the EMQ theme, or a name for the case. */
  title?: string;
  /** The shared text: the scenario, the EMQ lead-in, or the true/false stem. */
  body?: string;
  /** Written once; copied onto every question of the group. true/false blocks may leave it out. */
  options?: string[];
  /** Used for any question of the group that carries no tags of its own. */
  tags?: string | string[];
  questions: ImportQ[];
};

export type ImportTopic = { name: string; questions?: ImportQ[]; groups?: ImportGroup[] };

export type ImportChapter = {
  subject: string; subjectOrder?: number; chapter: string; chapterOrder?: number; description?: string;
  topics?: ImportTopic[];
  /** Shortcut for chapters without topics: these go into one topic named like the chapter. */
  questions?: ImportQ[];
  groups?: ImportGroup[];
};

/** The labels the admin question form offers. The importer accepts more (EMQ lists run to T and beyond). */
export const LABELS = ["A", "B", "C", "D", "E", "F"];
export const ALL_LABELS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
const MAX_CHOICES = ALL_LABELS.length;
const TF_CHOICES = ["True", "False"];
const KINDS: GroupKind[] = ["case", "emq", "tf"];

const norm = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Identity of a question: its stem, its set of choices, and the group it sits in.
 * Exams reuse a stem from an older paper with different options and a different answer —
 * those are two different questions, so the stem alone must not decide. Choices are sorted
 * so a paper that merely shuffles the options still counts as the same question. The group is
 * part of it because two cases both ask "What is the most likely diagnosis?" from similar lists.
 */
export const questionKey = (text: string, choices: unknown[], groupKey = "") =>
  groupKey + "\u0002" + norm(text) + "\u0000" + choices.map(norm).sort().join("\u001f");

/** Identity of a group inside its topic. */
export const groupKeyOf = (kind: string, title: unknown, body: unknown) =>
  `${norm(kind)}\u0001${norm(title)}\u0001${norm(body)}`;

/** The choices a question really has: its own, else the group's shared list, else True/False. */
export function choicesFor(q: ImportQ, g?: ImportGroup): string[] {
  const own = Array.isArray(q?.choices) ? q.choices.map(String).filter((c) => c.trim()) : [];
  if (own.length) return own;
  const shared = Array.isArray(g?.options) ? g.options.map(String).filter((c) => c.trim()) : [];
  if (shared.length) return shared;
  return g?.kind === "tf" ? [...TF_CHOICES] : [];
}

/**
 * Which choices are correct. Accepts "C", "True"/"False" for two-option questions, and several
 * labels ("G,S") when the paper accepts either answer. Returns null when it cannot be read.
 */
export function correctIndexes(correct: unknown, n: number): number[] | null {
  const s = String(correct ?? "").trim();
  if (!s) return null;
  const low = s.toLowerCase();
  if (n === 2) {
    if (low === "true" || low === "t") return [0];
    if (low === "false" || low === "f") return [1];
  }
  const out = new Set<number>();
  for (const part of s.split(/[,\s/|&]+/)) {
    const p = part.trim().toUpperCase();
    if (!p) continue;
    const i = ALL_LABELS.indexOf(p);
    if (i < 0 || i >= n) return null;
    out.add(i);
  }
  return out.size ? [...out].sort((a, b) => a - b) : null;
}

/** Validates one question; returns an error message or null. */
export function checkQuestion(q: ImportQ, choices?: string[]): string | null {
  if (!q?.text?.trim()) return "a question has no text";
  const label = q.text.slice(0, 40);
  const cs = (choices ?? (Array.isArray(q.choices) ? q.choices.map(String) : [])).filter((c) => String(c).trim());
  if (cs.length < 2) return `"${label}" needs at least 2 choices`;
  if (cs.length > MAX_CHOICES) return `"${label}" has more than ${MAX_CHOICES} choices`;
  if (!correctIndexes(q.correct, cs.length)) return `"${label}" has an invalid correct answer`;
  if (!q.explanation?.trim()) return `"${label}" has no explanation`;
  return null;
}

const tagsOf = (q: ImportQ, g?: ImportGroup) => {
  const raw = q.tags ?? g?.tags ?? "";
  return parseTags(Array.isArray(raw) ? raw.join(",") : String(raw));
};

/** Adds content without deleting anything: matching subject/chapter/topic/group are reused and questions
 *  already present (same stem, same choices, same group) are skipped, so student progress is kept. */
export async function importChapters(
  input: ImportChapter[],
  opts: { subject?: string; chapter?: string; topic?: string } = {}
): Promise<{ added: number; skipped: number; merged: number; groups: number }> {
  const list = input.map((c0) => {
    const c: ImportChapter = { ...c0 };
    if (opts.subject) c.subject = opts.subject;
    if (opts.chapter) c.chapter = opts.chapter;
    let tps: ImportTopic[] | undefined = Array.isArray(c.topics) ? c.topics : undefined;
    const loose = (Array.isArray(c.questions) && c.questions.length) || (Array.isArray(c.groups) && c.groups.length);
    if (!tps && loose && c.chapter?.trim()) tps = [{ name: c.chapter.trim(), questions: c.questions, groups: c.groups }];
    if (opts.topic && Array.isArray(tps))
      tps = [{
        name: opts.topic,
        questions: tps.flatMap((t) => (Array.isArray(t.questions) ? t.questions : [])),
        groups: tps.flatMap((t) => (Array.isArray(t.groups) ? t.groups : [])),
      }];
    return { ...c, topics: tps };
  });

  for (const c of list) {
    if (!c.subject?.trim() || !c.chapter?.trim() || !Array.isArray(c.topics)) throw new Error("Each item needs subject, chapter and either topics, questions or groups.");
    for (const t of c.topics) {
      if (!t?.name?.trim()) throw new Error(`Topic "${t?.name ?? ""}" is invalid.`);
      const qs = Array.isArray(t.questions) ? t.questions : [];
      const gs = Array.isArray(t.groups) ? t.groups : [];
      if (!qs.length && !gs.length) throw new Error(`Topic "${t.name}" has no questions and no groups.`);
      for (const q of qs) { const e = checkQuestion(q); if (e) throw new Error(e); }
      for (const g of gs) {
        if (!KINDS.includes(g?.kind)) throw new Error(`A group in "${t.name}" needs kind "case", "emq" or "tf".`);
        if (!Array.isArray(g.questions) || !g.questions.length) throw new Error(`The ${g.kind} group "${(g.title || g.body || "").slice(0, 40)}" has no questions.`);
        if (g.kind === "case" && !g.body?.trim()) throw new Error("A case group needs a body: the scenario the questions share.");
        if (g.kind === "emq" && !(Array.isArray(g.options) && g.options.filter((o) => String(o).trim()).length >= 2))
          throw new Error(`The EMQ group "${(g.title || g.body || "").slice(0, 40)}" needs an options list.`);
        for (const q of g.questions) { const e = checkQuestion(q, choicesFor(q, g)); if (e) throw new Error(e); }
      }
    }
  }

  let added = 0, skipped = 0, merged = 0, groupsAdded = 0;

  for (const c of list) {
    let [subj] = await db.select().from(subjects).where(sql`lower(${subjects.name}) = ${c.subject.trim().toLowerCase()}`).limit(1);
    if (!subj) [subj] = await db.insert(subjects).values({ name: c.subject.trim(), order: c.subjectOrder ?? 0 }).returning();
    let [ch] = await db.select().from(chapters).where(and(sql`lower(${chapters.name}) = ${c.chapter.trim().toLowerCase()}`, eq(chapters.subjectId, subj.id))).limit(1);
    if (!ch) [ch] = await db.insert(chapters).values({ subjectId: subj.id, name: c.chapter.trim(), description: c.description ?? "", order: c.chapterOrder ?? 0 }).returning();

    for (const [ti, t] of c.topics!.entries()) {
      let [tp] = await db.select().from(topics).where(and(sql`lower(${topics.name}) = ${t.name.trim().toLowerCase()}`, eq(topics.chapterId, ch.id))).limit(1);
      if (!tp) [tp] = await db.insert(topics).values({ chapterId: ch.id, name: t.name.trim(), order: ti }).returning();

      const have = await db
        .select({ id: questions.id, text: questions.questionText, tags: questions.tags, order: questions.order, groupId: questions.groupId, groupOrder: questions.groupOrder })
        .from(questions).where(eq(questions.topicId, tp.id)).orderBy(asc(questions.order));
      // The key spans both tables, so the existing questions' choices are loaded with them.
      const prior = have.length
        ? await db.select({ questionId: answerChoices.questionId, text: answerChoices.text }).from(answerChoices).where(inArray(answerChoices.questionId, have.map((h) => h.id)))
        : [];
      const choicesOf = new Map<string, string[]>();
      for (const r of prior) { const got = choicesOf.get(r.questionId); if (got) got.push(r.text); else choicesOf.set(r.questionId, [r.text]); }

      const grps = await db.select().from(questionGroups).where(eq(questionGroups.topicId, tp.id)).orderBy(asc(questionGroups.order));
      const gkeyById = new Map(grps.map((g) => [g.id, groupKeyOf(g.kind, g.title, g.body)]));
      const seen = new Map(have.map((h) => [
        questionKey(h.text, choicesOf.get(h.id) ?? [], h.groupId ? gkeyById.get(h.groupId) ?? "" : ""),
        { id: h.id, tags: parseTags(h.tags) },
      ]));
      let order = have.length ? have[have.length - 1].order + 1 : 0;

      const addOne = async (q: ImportQ, cs: string[], g?: ImportGroup, groupId?: string, groupOrder?: number) => {
        const gk = g ? groupKeyOf(g.kind, g.title ?? "", g.body ?? "") : "";
        const key = questionKey(q.text, cs, gk);
        const dup = seen.get(key);
        if (dup) {
          // Same question already there: keep it, but add any exam tags it did not have yet.
          const add = tagsOf(q, g).filter((x) => !dup.tags.some((y) => y.toLowerCase() === x.toLowerCase()));
          if (add.length) { dup.tags = [...dup.tags, ...add]; await db.update(questions).set({ tags: dup.tags.join(", ") }).where(eq(questions.id, dup.id)); merged++; }
          else skipped++;
          return;
        }
        const [qr] = await db.insert(questions).values({
          topicId: tp.id, questionText: q.text.trim(), explanation: q.explanation.trim(),
          tags: tagsOf(q, g).join(", "), order: order++,
          groupId: groupId ?? null, groupOrder: groupOrder ?? 0,
        }).returning();
        const correct = correctIndexes(q.correct, cs.length) ?? [];
        await db.insert(answerChoices).values(cs.map((text, i) => ({ questionId: qr.id, label: ALL_LABELS[i], text: String(text).trim(), isCorrect: correct.includes(i) })));
        seen.set(key, { id: qr.id, tags: parseTags(qr.tags) });
        added++;
      };

      for (const q of t.questions ?? []) await addOne(q, choicesFor(q));

      let gOrder = grps.length ? Math.max(...grps.map((g) => g.order)) + 1 : 0;
      for (const g of t.groups ?? []) {
        const gk = groupKeyOf(g.kind, g.title ?? "", g.body ?? "");
        let row = grps.find((x) => groupKeyOf(x.kind, x.title, x.body) === gk);
        if (!row) {
          [row] = await db.insert(questionGroups).values({
            topicId: tp.id, kind: g.kind, title: (g.title ?? "").trim(), body: (g.body ?? "").trim(), order: gOrder++,
          }).returning();
          grps.push(row); gkeyById.set(row.id, gk); groupsAdded++;
        }
        const inGroup = have.filter((h) => h.groupId === row!.id);
        let go = inGroup.length ? Math.max(...inGroup.map((h) => h.groupOrder)) + 1 : 0;
        for (const q of g.questions) await addOne(q, choicesFor(q, g), g, row.id, go++);
      }
    }
  }
  return { added, skipped, merged, groups: groupsAdded };
}
