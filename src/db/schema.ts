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

// Written study notes for a chapter (simple formatted text). Students see them for subjects they can access.
export const summaries = pgTable("summaries", {
  id: id(),
  chapterId: text("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  /** Optional Google Drive (or other https) link. When set, students get an Open button instead of text. */
  url: text("url").notNull().default(""),
  order: integer("order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("summaries_chapter_idx").on(t.chapterId)]);

export const topics = pgTable("topics", {
  id: id(),
  chapterId: text("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  order: integer("order").notNull().default(0),
});

// A block of questions that share one piece of text above them: a clinical case, an EMQ option
// list, or a true/false stem. Questions outside a group behave exactly as before.
export const questionGroups = pgTable("question_groups", {
  id: id(),
  topicId: text("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  /** case | emq | tf */
  kind: text("kind").notNull(),
  /** Short heading: the EMQ theme, or a name for the case. */
  title: text("title").notNull().default(""),
  /** The shared text: the scenario for a case, the lead-in for an EMQ, the stem for true/false. */
  body: text("body").notNull().default(""),
  order: integer("order").notNull().default(0),
}, (t) => [index("qg_topic_idx").on(t.topicId)]);

export const questions = pgTable("questions", {
  id: id(),
  topicId: text("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  questionText: text("question_text").notNull(),
  explanation: text("explanation").notNull(),
  difficulty: text("difficulty").notNull().default("medium"), // easy | medium | hard
  tags: text("tags").notNull().default(""), // comma separated
  order: integer("order").notNull().default(0),
  /** null = an ordinary standalone question. */
  groupId: text("group_id").references(() => questionGroups.id, { onDelete: "cascade" }),
  /** Position inside its group; the order is fixed and never shuffled. */
  groupOrder: integer("group_order").notNull().default(0),
}, (t) => [index("questions_group_idx").on(t.groupId)]);

export const answerChoices = pgTable("answer_choices", {
  id: id(),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  label: text("label").notNull(), // A, B, C, D, E
  text: text("text").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
  /** Optional one-line reason shown after answering ("why not this one"). Empty = nothing shown. */
  note: text("note").notNull().default(""),
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
  /** Coupon code used for this request (price above is already discounted). */
  coupon: text("coupon").notNull().default(""),
  /** Price before any coupon (0 = unknown, use the subject price). */
  listPrice: integer("list_price").notNull().default(0),
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

// ---------- Announcements shown to every student (exam dates, new chapters, downtime...) ----------
export const announcements = pgTable("announcements", {
  id: id(),
  message: text("message").notNull(),
  /** info | warning | urgent */
  level: text("level").notNull().default("info"),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// ---------- Logged-in devices (students may use at most 2 at a time) ----------
export const userSessions = pgTable("user_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  device: text("device").notNull().default(""),
  createdAt: createdAt(),
}, (t) => [index("user_sessions_user_idx").on(t.userId)]);

// ---------- Coupons (percentage discounts on a subject's price) ----------
export const coupons = pgTable("coupons", {
  id: id(),
  code: text("code").notNull(),
  percentOff: integer("percent_off").notNull(),
  /** null = valid for every subject */
  subjectId: text("subject_id").references(() => subjects.id, { onDelete: "cascade" }),
  /** 0 = unlimited */
  maxUses: integer("max_uses").notNull().default(0),
  used: integer("used").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("coupons_code_unique").on(t.code)]);

// ---------- Love reactions on summaries ----------
export const summaryLikes = pgTable("summary_likes", {
  id: id(),
  summaryId: text("summary_id").notNull().references(() => summaries.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("sl_unique").on(t.userId, t.summaryId), index("sl_summary_idx").on(t.summaryId)]);

// ---------- Manual income and costs (cash payments, hosting, ads...) for the revenue page ----------
export const financeEntries = pgTable("finance_entries", {
  id: id(),
  /** income | cost */
  kind: text("kind").notNull(),
  amount: integer("amount").notNull(),
  note: text("note").notNull().default(""),
  entryAt: timestamp("entry_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}, (t) => [index("finance_entries_at_idx").on(t.entryAt)]);
