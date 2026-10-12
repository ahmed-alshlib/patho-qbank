/** Tables in dependency order (parents first). Temporary tables (sessions, codes, rate limits) are never backed up. */
export const BACKUP_TABLES = [
  "subjects", "chapters", "summaries", "announcements", "topics", "questions", "answer_choices",
  "users", "subscriptions", "settings",
  "tests", "test_questions", "user_answers", "bookmarks", "notes", "highlights", "reported_questions",
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export const BACKUP_GROUPS: { id: string; label: string; help: string; tables: BackupTable[]; defaultOn: boolean }[] = [
  { id: "content", label: "Questions and subjects", help: "Subjects, chapters, summaries, topics, questions and answer choices.", tables: ["subjects", "chapters", "summaries", "announcements", "topics", "questions", "answer_choices"], defaultOn: true },
  { id: "accounts", label: "Students, subscriptions and settings", help: "Student accounts (with password hashes), subscriptions, prices and payment settings.", tables: ["users", "subscriptions", "settings"], defaultOn: true },
  { id: "activity", label: "Student activity", help: "Answers, sessions, bookmarks, notes, highlights and reports. Can be large once many students are active.", tables: ["tests", "test_questions", "user_answers", "bookmarks", "notes", "highlights", "reported_questions"], defaultOn: false },
];

export const BACKUP_FORMAT = "medical-qbank-backup";
