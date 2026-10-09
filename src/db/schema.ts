import { pgTable, text, integer, boolean, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ---------- Access control ----------
// Students only, no open sign-up: an email must be on this list to register.
export const approvedEmails = pgTable("approved_emails", {
  id: id(),
  email: text("email").notNull().unique(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
});

// ---------- Prepared content (read-only for students) ----------
export const subjects = pgTable("subjects", {
  id: id(),
  name: text("name").notNull(),
  order: integer("order").notNull().default(0),
});

export const chapters = pgTable("chapters", {
  id: id(),
  subjectId: text("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  order: integer("order").notNull().default(0),
});

export const topics = pgTable("topics", {
  id: id(),
  chapterId: text("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  order: integer("order").notNull().default(0),
});

export const questions = pgTable("questions", {
  id: id(),
  topicId: text("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  questionText: text("question_text").notNull(),
  explanation: text("explanation").notNull(),
  difficulty: text("difficulty").notNull().default("medium"), // easy | medium | hard
  tags: text("tags").notNull().default(""), // comma separated
  order: integer("order").notNull().default(0),
});

export const answerChoices = pgTable("answer_choices", {
  id: id(),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  label: text("label").notNull(), // A, B, C, D, E
  text: text("text").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
});

// ---------- Student activity (kept separate from content) ----------
export const userAnswers = pgTable(
  "user_answers",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
    choiceId: text("choice_id").references(() => answerChoices.id),
    isCorrect: boolean("is_correct").notNull(),
    timeSpentSec: integer("time_spent_sec").notNull().default(0),
    testId: text("test_id"),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ua_user_q").on(t.userId, t.questionId), index("ua_user_time").on(t.userId, t.answeredAt)]
);

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("bm_unique").on(t.userId, t.questionId)]
);

export const highlights = pgTable("highlights", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  target: text("target").notNull(), // "question" | "explanation"
  start: integer("start").notNull(),
  end: integer("end").notNull(),
  createdAt: createdAt(),
});

export const notes = pgTable(
  "notes",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("note_unique").on(t.userId, t.questionId)]
);

export const tests = pgTable("tests", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mode: text("mode").notNull().default("exam"), // "study" | "exam"
  timed: boolean("timed").notNull().default(false),
  timeLimitSec: integer("time_limit_sec"),
  randomized: boolean("randomized").notNull().default(true),
  filters: text("filters").notNull().default("{}"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const testQuestions = pgTable("test_questions", {
  id: id(),
  testId: text("test_id").notNull().references(() => tests.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
});

export const reportedQuestions = pgTable("reported_questions", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  createdAt: createdAt(),
});
