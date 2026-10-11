# Medical QBank — Project Context (hand-off for a new chat / another AI)

Last updated: 10 Oct 2026. Owner: Ahmed Alshlib (medical student, Tripoli, Libya; also runs Ghayem First Advertising & Media).

## 1. What this is
A question bank ("QBank") website for ~800 medical students. Started as "Patho QBank", renamed **Medical QBank** because more subjects will be added (Patho 1/2/3 first). Questions come from PDFs supplied by the owner and are imported/entered via the admin area.

- Live: patho-qbank.vercel.app (Vercel auto-deploys from GitHub; owner uploads the project zip to GitHub).
- Database: Supabase project "QbankP" (id `nmfouvkhbhvaziupjksf`), Postgres.
- Stack: Next.js 15 App Router (server components + server actions, `force-dynamic`), React 19, TypeScript 5.9, Tailwind 3 (CSS-variable RGB tokens), Drizzle ORM + postgres-js (`prepare:false`), bcryptjs + jose JWT cookie `qbank_session`, nodemailer.
- Project root when building: `/home/claude/patho-qbank`; deliverable zip: `medical-qbank.zip` (excludes node_modules, .next, .env).

## 2. How the owner wants to work
- Token-efficient, no open-ended questions when a sensible default exists.
- Exact click-by-click steps for Supabase / Vercel / Google actions.
- **Never paste passwords/connection strings/API keys in chat**; they go only in Vercel environment variables. (Owner once shared DB credentials in screenshots: **still outstanding — reset the Supabase DB password and update `DATABASE_URL` in Vercel.**)
- Arabic/English mix is normal for him.

## 3. Product decisions (made by the owner)
- Open sign-up: anyone can register.
- One subscription package **per subject**; access lasts **3 months from approval date**; no free trial.
- Payment: **bank transfer**, student sends receipt photo to a WhatsApp number, **admin approves manually** in the admin panel. Renewals extend from max(now, current expiry) + 3 months.
- **Admin is a completely separate area**: admin login goes straight to `/admin`; the student layout redirects admins to `/admin`; admins see all subjects.
- Question-text highlights are temporary (never saved, cleared on answer); explanation highlights are saved.
- Sessions: study mode / exam mode, choose chapters/topics, count, optional timer.
- Email verification interpretation: new accounts must confirm a 6-digit emailed code; same code flow for password reset.
- After a subscription expires: account, answers, scores, bookmarks, notes, highlights are all kept; that subject is locked until renewal (banner + Renew button).

## 4. What is built and tested
- **Student side** `(app)`: dashboard (create-session card, resume cards, "Study next", "Choose your subjects" banner), subjects page (lock + Subscribe for locked), plans page (subject cards Active/Pending/Locked, price, Subscribe/Renew/Cancel, bank details, WhatsApp wa.me link prefilled with reference code), sessions (study/exam, timer, `?topics=` prefill), results (score ring, by chapter/topic, retry incorrect, question review), history, incorrect/bookmarks/notes, progress (weak topics <75% with ≥3 answered, weekly accuracy trend), expiry banners (≤7 days left / ended within 14 days).
- **Auth** `(auth)`: login (rate-limited by ip + email; unverified → /verify; admin → /admin), register (open, rate-limited, auto-verified if no mail provider), verify, forgot, reset. Codes: sha256-hashed in `email_codes`, 10-min TTL, 5 attempts, 60 s resend cooldown. Rate limits in Postgres (`rate_limits`, atomic upsert).
- **Admin** `(admin)`: tabs via `?tab=`: Requests (approve/reject/revoke), Students (search, grant 3 months, revoke, **set new student password**), Content, Reports (resolve/delete), Settings (prices per subject, WhatsApp, bank name/account name/number, currency default LYD, payment note, email-provider status).
- **Content manager** (`/admin/content`): stats row, search (`?q=`), "New subject" and "Import JSON" popovers, collapsible subjects/chapters with pencil edit popovers (rename/order/delete), topic rows link to `/admin/content/[topicId]` (question list, add/edit/delete question, choices A–F). JSON import is merge-only (skips existing question text, never deletes).
- **Design**: dark default (light via toggle), Inter font, glass cards (`.card`, `.card-solid`, `.glass-float`), `.btn` gradient blue→violet, `.btn-ghost`, `.input`, `.chip`, `.eyebrow`.
- Timezone constant `TZ = process.env.APP_TZ ?? "Africa/Tripoli"`.
- Test accounts earlier added as approved emails: nada@patho.com, mona@patho.com, test@patho.com (the `approved_emails` table is now unused because sign-up is open).

## 5. Key code map (`src/`)
- `db/schema.ts` — tables: users (+isAdmin, emailVerifiedAt), subjects (+price), chapters, topics, questions, answer_choices, user_answers, bookmarks, highlights, notes, tests (+mode), test_questions, reported_questions (+resolvedAt), subscriptions (status pending|active|rejected|revoked, reference, price, approvedAt, expiresAt), settings (key/value), email_codes, rate_limits, approved_emails (unused). RLS enabled on new tables, no policies (app connects with a server DB role).
- `lib/access.ts` — `accessibleSubjectIds`, `assertQuestionAccess`, `addMonths`, `getExpiryNotices`. Gating applied in submitAnswer, answerInSession, createSession, loadStudyQuestions, getReviewItems, getSessionTree, study page.
- `lib/mail.ts` — provider order: `SMTP_URL` (nodemailer) > `RESEND_API_KEY` > `MAIL_CONSOLE=1` (logs; tests) > none. `lib/codes.ts`, `lib/rate.ts`, `lib/settings.ts`, `lib/import.ts`, `lib/insights.ts`, `lib/sessions.ts`, `lib/auth.ts` (`getUser`).
- Server actions: `actions-auth.ts`, `actions-plans.ts`, `actions-admin.ts`, `actions-content.ts`, `actions-session.ts`.
- Middleware public paths: /login, /register, /verify, /forgot, /reset.
- Components: `Collapsible.tsx` (client), `ConfirmButton.tsx`, `ResultReview.tsx`, `ui.tsx` (Bar, ProgressRing, CountUp, Stat, EmptyState), `NavLinks`, `ThemeToggle`.

## 6. Environment variables (set in Vercel, never in chat)
- `DATABASE_URL`, `DIRECT_URL` (Supabase), `SESSION_SECRET` (long random string)
- Email (optional): `SMTP_URL` (e.g. `smtps://USER%40gmail.com:APP_PASSWORD@smtp.gmail.com:465`), `MAIL_FROM`, or `RESEND_API_KEY` (needs a verified domain)
- Optional: `APP_TZ`

## 7. Current status / state of email
- **Email is NOT enabled yet.** Consequence: new accounts are auto-verified, "Forgot password" does not work; admin can set a student's password manually (Admin → Students → "Set new password"). Existing accounts are verified, so enabling email later locks nobody out.
- Easiest option: Gmail SMTP with an App password (needs 2-Step Verification; ~500/day).

## 7b. Added later (10 Oct)
- Subjects have `is_free` and `duration_months` (migration applied to live Supabase). Admin → Settings: per-subject price, months, Free toggle. Free subjects: student taps "Enroll for free" → instant active subscription for N months (renewable in last 14 days). Approval/grant use the subject's duration.
- Import JSON dialog lets the admin optionally choose subject / chapter / topic (existing or new); anything left on "From the file" uses names in the JSON. Chapters may carry `questions` directly (no topics). Name matching is case-insensitive.
- Popover (portal-based, closes on save/outside click) replaces <details> menus; ConfirmButton is now a styled dialog used for delete, approve, decline, revoke, grant, cancel request, delete report.

## 7c. Added 10 Oct (later)
- **Device limit**: students may be signed in on 2 devices; a 3rd login signs out the oldest (`user_sessions` table, `sid` in the JWT cookie, `MAX_DEVICES` in `lib/auth.ts`; admins exempt). `requireUser()` replaces `(await getUser())!` in pages; an invalid session goes to `/api/auth/logout?k=1` → `/login?kicked=1`. Password reset/set-password signs out all devices; admin can "Sign out all devices".
- **"X% of students got this right"** (`lib/peers.ts`, first attempt per student, shown when ≥10 students) after answering and in results review.
- **Daily goal + goal streak** on the student dashboard (`users.daily_goal`, chips 10/20/30/50; streak = consecutive days the goal was met).
- **Admin Overview tab** (default): cached counts (1 min) and activity/revenue/most-missed (10 min) in `lib/adminStats.ts`; indexes `ua_question`, `ua_time` added.
- **Admin Students tab**: filters (subject, status, sort, search) + pagination (20/page); rows open `/admin/students/[id]` (subscription history, progress by subject, devices, grant, set password).
- Migration applied to live Supabase: users.daily_goal, user_sessions, the two indexes.

## 7d. Added 11 Oct (launch day)
- **Admin → Backup tab** (`/admin/backup`): download a JSON backup (scopes: content, accounts, activity; streamed, keyset-paginated; `src/app/api/admin/backup/route.ts`, `lib/backup.ts`) and **Restore** (`RestoreForm.tsx` + `actions-backup.ts`): browser sends chunks, server inserts with `jsonb_populate_recordset ... ON CONFLICT DO NOTHING` (additive only, never overwrites/deletes). Tested: download valid, no-op restore, restore after wipe. File contains password hashes: keep private. Supabase free plan has no automatic backups.
- Launch-day: IP rate limits raised; `DB_POOL_MAX` default 3 (set `DB_POOL_MAX=3`, use pooler URL port 6543).
- Domain plan: Libyan Spider .ly domain -> Vercel Settings > Domains, add A `@` 76.76.21.21 + CNAME `www` cname.vercel-dns.com in their DNS panel; update Google redirect URI/APP_URL if Google login is used.

## 7e. Added 11 Oct (evening)
- **Renamed to Rakeez** (domain rakeezedu.com bought at Libyan Spider; DNS: A @ 216.198.79.1, CNAME www cname.vercel-dns.com; nameservers ns1-ns6.ns.ly). Backup file format id stays `medical-qbank-backup`.
- **Exam tags replace difficulty**: `questions.tags` (comma-separated, e.g. "Final 10/2022, Mid 03/2025"); shown as chips on questions; session builder has an "Exams and years" filter (none picked = all; "No tag" option). Import JSON uses `"tags": "Final 01/2026"` (string or array); `difficulty` is ignored (DB column kept). `lib/tags.ts`.
- **Summaries**: table `summaries` (chapter_id, title, body, order; RLS on; migration applied to live Supabase). Admin → Summaries tab: pick subject, then chapter, add/edit/delete. Student `/summaries` and `/summaries/[id]` (titles visible to all, text only for subscribed subjects). Body uses a safe mini-format (`#`, `-`, `1.`, `>`, `**bold**`, `==highlight==`) rendered by `components/RichText.tsx`. Included in Backup (content group).

## 8. Open items / next steps
1. Upload latest zip to GitHub (Vercel redeploys); set prices, bank details, WhatsApp in Admin → Settings.
2. **Reset Supabase DB password**, update `DATABASE_URL` in Vercel.
3. Owner to send question PDFs for import/entry.
4. Decide whether to enable email (SMTP_URL + MAIL_FROM in Vercel).
5. **BUILT (needs Google credentials to go live):** "Continue with Google" sign-in (`/api/auth/google`, `/api/auth/google/callback`, `lib/google.ts`; env `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, optional `APP_URL`). Original design: as an extra option next to email/password (Google-verified emails count as verified; link to existing account by same email; admin login stays password-only; button hidden unless `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set; redirect URI `https://patho-qbank.vercel.app/api/auth/google/callback`). Different Google account = new empty account (no merge tool yet).
6. Suggested, not yet requested: terms/privacy page; JSON export backup button (Supabase free plan has no automatic backups); optional receipt upload on plans page; admin announcements banner; admin analytics (active users, most-missed questions); load test for ~800 students.

## 9. Local testing notes (for whoever continues)
- Playwright at `/opt/npm-tools/node_modules/playwright`, Chromium at `/opt/pw-browsers/chromium`.
- Local Postgres via PGlite socket server (single connection only, in-memory); tests use env `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54329/postgres DB_POOL_MAX=1 SESSION_SECRET=<long> MAIL_CONSOLE=1`, then `drizzle-kit push --force`, `npx tsx scripts/seed.ts`, create test admin admin.test@gmail.com / password123. App: `npx next start -p 3113`.
- Supabase schema changes go through migrations (apply_migration); new tables get RLS enabled.
- Last e2e suites (e2e4, e2e5, e2e6b, e2e7, e2e8) all passed; the "set student password" action type-checks but was not browser-tested.
