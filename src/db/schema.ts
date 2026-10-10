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
  isAdmin: boolean("is_admin").notNull().default(false),
  dailyGoal: integer("daily_goal").notNull().default(20),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// ---------- Prepared content (read-only for students) ----------
export const subjects = pgTable("subjects", {
  id: id(),
  name: text("name").notNull(),
  price: integer("price").notNull().default(0),
  isFree: boolean("is_free").notNull().default(false),
  durationMonths: integer("duration_months").notNull().default(3),
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
  (t) => [index("ua_user_q").on(t.userId, t.questionId), index("ua_user_time").on(t.userId, t.answeredAt), index("ua_question").on(t.questionId), index("ua_time").on(t.answeredAt)]
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
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// ---------- Subscriptions (one package per subject, 3 months from approval) ----------
export const subscriptions = pgTable("subscriptions", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: text("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  /** pending | active | rejected | revoked */
  status: text("status").notNull().default("pending"),
  reference: text("reference").notNull(),
  price: integer("price").notNull().default(0),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index("subscriptions_user_idx").on(t.userId), index("subscriptions_status_idx").on(t.status)]);

// Admin-editable key/value settings (bank details, WhatsApp number...).
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
});

// ---------- Email codes (verification + password reset) and rate limiting ----------
export const emailCodes = pgTable("email_codes", {
  id: id(),
  email: text("email").notNull(),
  /** verify | reset */
  purpose: text("purpose").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index("email_codes_email_idx").on(t.email, t.purpose)]);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Logged-in devices (students may use at most 2 at a time) ----------
export const userSessions = pgTable("user_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  device: text("device").notNull().default(""),
  createdAt: createdAt(),
}, (t) => [index("user_sessions_user_idx").on(t.userId)]);
