# Medical QBank

Student-only pathology question bank. Next.js 15 + TypeScript + Postgres (Supabase) + Drizzle + Tailwind. Deploys on Vercel.

## 1. Supabase (database)
1. supabase.com -> New project (save the database password).
2. Project Settings -> Database -> Connection string. Copy:
   - **Transaction pooler** (port 6543) -> `DATABASE_URL`
   - **Session pooler** (port 5432) -> `DIRECT_URL`
3. Put them in `.env` (copy `.env.example`), plus a random `SESSION_SECRET`.

## 2. Create tables + load questions (run once, and again after adding questions)
```bash
npm install
npm run db:setup     # tables + content/*.json + approved emails + locks the public API (RLS)
```

## 3. Run locally (needs Node.js 20+)
```bash
npm run dev          # http://localhost:3000
```

## 4. Deploy on Vercel
1. Push this folder to a GitHub repo.
2. vercel.com -> Add New -> Project -> import the repo.
3. Environment Variables: add `DATABASE_URL` and `SESSION_SECRET` (same values as `.env`). `DIRECT_URL` is not needed on Vercel.
4. Deploy.

## Email setup (verification + password reset)
Add `SMTP_URL` (and `MAIL_FROM`) or `RESEND_API_KEY` in Vercel. See `.env.example`. Admin, Settings shows whether email is active.

## Access and subscriptions
Anyone can create an account. Each subject is a separate package (price set in Admin, Settings). A student requests a subject, pays by bank transfer, sends the receipt on WhatsApp with their reference code, and an admin approves it in Admin, Requests. Access lasts 3 months from approval. Admins (users.is_admin = true) see everything and can grant or revoke subjects.

## Adding questions
One JSON file per chapter in `content/` (see `content/patho1-cell-injury.json`), then `npm run db:seed`.
Warning: re-loading a chapter deletes students' answers for that chapter, so finish the content before launch.

## Built so far
- Phase 1: login/register, dashboard, subjects/chapters, question solving with explanations (graded on the server), progress.
- Phase 2: bookmarks, text highlights, personal notes, incorrect-questions list with retry, report a question, search and subject filter, keyboard shortcuts, light/dark theme.
- Phase 3: Create session (study or exam mode, pick chapters/topics, question pool, difficulty, count, optional timer), results page with per-chapter/topic breakdown, history, retry incorrect. Highlights on the question text are temporary (not saved, cleared when answered); explanation highlights are saved.
- Admin: requests approval, students, reports, prices and bank details. Subscriptions per subject.
- Security: login/register/code rate limiting, email verification (6-digit code), password reset by email.
- Admin: content manager (subjects, chapters, topics, questions, JSON import), renewals, expiry banner.
- Phase 4: weak topics, weekly accuracy, "Study next" suggestion.

