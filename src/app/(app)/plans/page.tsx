import { Check, Clock, Lock, MessageCircle, Landmark, X } from "lucide-react";
import { asc, desc, eq } from "drizzle-orm";
import { db, subjects, subscriptions } from "@/db";
import { getUser, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { TZ } from "@/lib/stats";
import ConfirmButton from "@/components/ConfirmButton";
import { requestSubscription, cancelRequest, enrollFree } from "../../actions-plans";

export const dynamic = "force-dynamic";

export default async function Plans({ searchParams }: { searchParams: Promise<{ welcome?: string; need?: string }> }) {
  const sp = await searchParams;
  const user = (await requireUser());
  const [subs, mine, cfg] = await Promise.all([
    db.select().from(subjects).orderBy(asc(subjects.order)),
    db.select().from(subscriptions).where(eq(subscriptions.userId, user.id)).orderBy(desc(subscriptions.createdAt)),
    getSettings(),
  ]);
  const now = Date.now();
  const fmt = (d: Date | null) => (d ? d.toLocaleDateString("en", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }) : "");
  const stateOf = (id: string) => {
    const active = mine.find((m) => m.subjectId === id && m.status === "active" && m.expiresAt && m.expiresAt.getTime() > now);
    if (active) return { kind: "active" as const, s: active };
    const pending = mine.find((m) => m.subjectId === id && m.status === "pending");
    if (pending) return { kind: "pending" as const, s: pending };
    const last = mine.find((m) => m.subjectId === id);
    return { kind: last?.status === "active" ? ("expired" as const) : last?.status === "rejected" ? ("rejected" as const) : ("none" as const), s: last };
  };
  const pend = (id: string) => mine.find((m) => m.subjectId === id && m.status === "pending");
  const pendings = subs.filter((s) => pend(s.id)).map((s) => ({ s, st: { s: pend(s.id)! } }));
  const wa = cfg.whatsapp.replace(/\D/g, "");
  const msg = (name: string, price: number, r: string) => encodeURIComponent(`Hello, I'm ${user.name} (${user.email}). I paid ${price} ${cfg.currency} for ${name}. Reference: ${r}`);
  const hasBank = cfg.bank_name || cfg.account_number;

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">{sp.welcome ? "Welcome to Rakeez" : "Subscriptions"}</p>
        <h1 className="mt-1 text-4xl font-semibold">Choose your subjects</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">Each subject is a separate package. Paid subjects unlock when your payment is approved; free subjects unlock instantly. Access lasts for the number of months shown on each card.</p>
      </div>

      {sp.need && <div className="card !border-warn/40 flex items-center gap-3 text-sm"><Lock className="h-4 w-4 text-warn" />Subscribe to that subject to open its questions.</div>}

      <div className="stagger grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {subs.map((s) => {
          const { kind, s: sub } = stateOf(s.id);
          return (
            <div key={s.id} className="card flex flex-col gap-4" data-testid={`plan-${s.name}`}>
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-xl font-semibold">{s.name}</h2>
                {kind === "active" && <span className="chip !bg-good/15 !text-good"><Check className="h-3 w-3" />Active</span>}
                {kind === "pending" && <span className="chip !bg-warn/15 !text-warn"><Clock className="h-3 w-3" />Pending</span>}
                {(kind === "none" || kind === "expired" || kind === "rejected") && <span className="chip"><Lock className="h-3 w-3" />{kind === "expired" ? "Expired" : kind === "rejected" ? "Declined" : "Locked"}</span>}
              </div>
              <div>
                <div className="font-display text-3xl font-semibold">{s.isFree ? "Free" : s.price > 0 ? `${s.price} ${cfg.currency}` : "—"}</div>
                <div className="text-xs text-muted">{s.durationMonths} {s.durationMonths === 1 ? "month" : "months"} of access</div>
              </div>
              {kind === "active" && (
                <div className="mt-auto space-y-2">
                  <p className="text-sm text-muted">Active until <b className="text-ink">{fmt(sub!.expiresAt)}</b></p>
                  {pend(s.id) ? <p className="text-xs text-warn">Renewal pending · ref <b className="tracking-widest">{pend(s.id)!.reference}</b></p> : sub!.expiresAt!.getTime() - now <= 14 * 86400000 && (
                    <form action={s.isFree ? enrollFree : requestSubscription}><input type="hidden" name="subjectId" value={s.id} /><button className="btn w-full" disabled={!s.isFree && s.price <= 0}>Renew for {s.durationMonths} more {s.durationMonths === 1 ? "month" : "months"}</button></form>
                  )}
                </div>
              )}
              {kind === "pending" && (
                <form action={cancelRequest} className="mt-auto"><input type="hidden" name="id" value={sub!.id} />
                  <p className="mb-2 text-sm text-muted">Reference <b className="tracking-widest text-ink">{sub!.reference}</b>. Waiting for payment approval.</p>
                  <ConfirmButton title="Cancel this request?" confirmLabel="Cancel request" message="Your pending request will be removed. You can request again any time." className="btn-ghost w-full !py-2 text-xs"><X className="h-3.5 w-3.5" />Cancel request</ConfirmButton></form>
              )}
              {(kind === "none" || kind === "expired" || kind === "rejected") && (
                <form action={s.isFree ? enrollFree : requestSubscription} className="mt-auto"><input type="hidden" name="subjectId" value={s.id} />
                  <button className="btn w-full" disabled={!s.isFree && s.price <= 0}>{s.isFree ? (kind === "expired" ? "Enroll again (free)" : "Enroll for free") : kind === "expired" ? "Renew" : "Subscribe"}</button>
                  {!s.isFree && s.price <= 0 && <p className="mt-2 text-center text-xs text-muted">Price not set yet.</p>}</form>
              )}
            </div>
          );
        })}
      </div>

      {pendings.length > 0 && (
        <section className="card card-solid space-y-5 !border-brand/30" data-testid="payment-box">
          <div><p className="eyebrow">How to pay</p><h2 className="mt-1 text-2xl font-semibold">Bank transfer, then send the receipt on WhatsApp</h2></div>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand">1</span>
              <div>Transfer the amount ({pendings.map((p) => `${p.s.name}: ${p.s.price} ${cfg.currency}`).join(" · ")}).
                {hasBank ? (
                  <div className="mt-2 flex items-start gap-3 rounded-xl bg-raised p-3"><Landmark className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    <div className="space-y-0.5">{cfg.bank_name && <div><span className="text-muted">Bank:</span> {cfg.bank_name}</div>}
                      {cfg.account_name && <div><span className="text-muted">Account name:</span> {cfg.account_name}</div>}
                      {cfg.account_number && <div><span className="text-muted">Account / IBAN:</span> <b className="select-all">{cfg.account_number}</b></div>}</div></div>
                ) : <div className="mt-2 text-warn">Bank details have not been added yet. Please check back soon.</div>}
              </div></li>
            <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand">2</span>
              <div>Send a photo of the receipt on WhatsApp and include your reference code.
                {cfg.payment_note && <div className="mt-1 text-muted">{cfg.payment_note}</div>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {pendings.map((p) => wa
                    ? <a key={p.s.id} className="btn !bg-[#25D366] !bg-none" target="_blank" rel="noreferrer" href={`https://wa.me/${wa}?text=${msg(p.s.name, p.s.price, p.st.s!.reference)}`}><MessageCircle className="h-4 w-4" />WhatsApp: {p.s.name} ({p.st.s!.reference})</a>
                    : <span key={p.s.id} className="chip">{p.s.name}: {p.st.s!.reference}</span>)}
                  {!wa && <span className="text-warn">WhatsApp number has not been added yet.</span>}
                </div></div></li>
            <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand">3</span>
              <div>We confirm the payment and unlock the subject. Access starts on the approval date and lasts for the months shown on the subject card.</div></li>
          </ol>
        </section>
      )}
    </div>
  );
}
