import { unstable_cache } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { TZ } from "@/lib/stats";

/** Start of the current month in the app's timezone, as a timestamptz. */
const monthStart = sql`(date_trunc('month', now() at time zone ${TZ}::text) at time zone ${TZ}::text)`;
const rows = <T,>(r: unknown) => Array.from(r as ArrayLike<T>);

/** Cheap counts over small tables, cached for 1 minute. */
export const getOverviewLight = unstable_cache(async () => {
  const [c] = rows<{ students: number; new7: number; subscribed: number; pending: number; reports: number; revenue_month: number; revenue_last: number }>(await db.execute(sql`
    select
      (select count(*) from users where not is_admin)::int as students,
      (select count(*) from users where not is_admin and created_at > now() - interval '7 days')::int as new7,
      (select count(distinct user_id) from subscriptions where status = 'active' and expires_at > now())::int as subscribed,
      (select count(*) from subscriptions where status = 'pending')::int as pending,
      (select count(*) from reported_questions where resolved_at is null)::int as reports,
      (select coalesce(sum(price), 0) from subscriptions where status = 'active' and price > 0 and approved_at >= ${monthStart})::int as revenue_month,
      (select coalesce(sum(price), 0) from subscriptions where status = 'active' and price > 0
         and approved_at >= ${monthStart} - interval '1 month' and approved_at < ${monthStart})::int as revenue_last`));
  const perSubject = rows<{ name: string; is_free: boolean; active: number; pending: number }>(await db.execute(sql`
    select sb.name, sb.is_free,
      (count(*) filter (where s.status = 'active' and s.expires_at > now()))::int as active,
      (count(*) filter (where s.status = 'pending'))::int as pending
    from subjects sb left join subscriptions s on s.subject_id = sb.id
    group by sb.id order by sb."order", sb.name`));
  const expiring = rows<{ user_id: string; name: string; email: string; subject: string; expires_at: string }>(await db.execute(sql`
    select u.id as user_id, u.name, u.email, sb.name as subject, s.expires_at::text as expires_at
    from subscriptions s join users u on u.id = s.user_id join subjects sb on sb.id = s.subject_id
    where s.status = 'active' and s.expires_at > now() and s.expires_at < now() + interval '7 days'
      and not exists (select 1 from subscriptions p where p.user_id = s.user_id and p.subject_id = s.subject_id and p.status = 'pending')
    order by s.expires_at limit 8`));
  return { ...c, perSubject, expiring, at: Date.now() };
}, ["admin-overview-light"], { revalidate: 60 });

/** Reads recent answers, so it is cached for 10 minutes. Uses the answered_at / question_id indexes. */
export const getOverviewActivity = unstable_cache(async () => {
  const daily = rows<{ d: string; answers: number; students: number }>(await db.execute(sql`
    select to_char(answered_at at time zone ${TZ}::text, 'YYYY-MM-DD') as d, count(*)::int as answers, count(distinct user_id)::int as students
    from user_answers where answered_at > now() - interval '14 days' group by 1 order by 1`));
  const [act] = rows<{ today: number; week: number }>(await db.execute(sql`
    select (count(distinct user_id) filter (where answered_at > now() - interval '1 day'))::int as today,
           count(distinct user_id)::int as week
    from user_answers where answered_at > now() - interval '7 days'`));
  const missed = rows<{ id: string; topic_id: string; text: string; n: number; pct: number }>(await db.execute(sql`
    select q.id, q.topic_id, left(q.question_text, 110) as text, count(*)::int as n,
      round(100.0 * avg(case when ua.is_correct then 1 else 0 end))::int as pct
    from user_answers ua join questions q on q.id = ua.question_id
    where ua.answered_at > now() - interval '14 days'
    group by q.id having count(*) >= 15 order by pct asc, n desc limit 5`));
  const months = rows<{ m: string; total: number; n: number }>(await db.execute(sql`
    select to_char(approved_at at time zone ${TZ}::text, 'YYYY-MM') as m, sum(price)::int as total, count(*)::int as n
    from subscriptions where status = 'active' and price > 0 and approved_at > now() - interval '6 months' group by 1 order by 1`));
  return { daily, activeToday: act?.today ?? 0, activeWeek: act?.week ?? 0, missed, months, at: Date.now() };
}, ["admin-overview-activity"], { revalidate: 600 });
