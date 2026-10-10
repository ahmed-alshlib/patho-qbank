"use client";
import { useActionState } from "react";
import Link from "next/link";
import { forgotPassword, resendCode, resetPassword, verifyEmail } from "../actions-auth";
import AuthShell from "./AuthShell";

function Err({ s }: { s?: { error?: string; info?: string } }) {
  return <>
    {s?.error && <p className="animate-shake rounded-xl border border-bad/30 bg-bad/10 p-3 text-sm text-bad">{s.error}</p>}
    {s?.info && <p className="rounded-xl border border-good/30 bg-good/10 p-3 text-sm text-good">{s.info}</p>}
  </>;
}

function Resend({ email, purpose }: { email: string; purpose: "verify" | "reset" }) {
  const [s, action, pending] = useActionState(resendCode, undefined);
  return (
    <form action={action} className="space-y-2 text-center">
      <input type="hidden" name="email" value={email} /><input type="hidden" name="purpose" value={purpose} />
      <button className="text-sm font-semibold text-brand" disabled={pending}>{pending ? "Sending…" : "Send a new code"}</button>
      {s?.info && <p className="text-xs text-muted">{s.info}</p>}
    </form>
  );
}

const codeInput = "input text-center font-display text-2xl tracking-[.5em]";

export function VerifyForm({ email }: { email: string }) {
  const [s, action, pending] = useActionState(verifyEmail, undefined);
  return (
    <AuthShell>
      <div className="animate-rise w-full max-w-sm space-y-5">
        <div className="space-y-2"><h2 className="text-3xl font-semibold">Check your email</h2>
          <p className="text-sm text-muted">We sent a 6-digit code to <b className="text-ink">{email}</b>. Enter it to finish creating your account.</p></div>
        <form action={action} className="space-y-4">
          <input type="hidden" name="email" value={email} />
          <input className={codeInput} name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="······" required autoFocus />
          <Err s={s} />
          <button className="btn w-full !py-3" disabled={pending}>{pending ? "Checking…" : "Verify and continue"}</button>
        </form>
        <Resend email={email} purpose="verify" />
        <p className="text-center text-sm text-muted"><Link className="font-semibold text-brand" href="/login">Back to log in</Link></p>
      </div>
    </AuthShell>
  );
}

export function ForgotForm() {
  const [s, action, pending] = useActionState(forgotPassword, undefined);
  return (
    <AuthShell>
      <form action={action} className="animate-rise w-full max-w-sm space-y-5">
        <div className="space-y-2"><h2 className="text-3xl font-semibold">Reset your password</h2>
          <p className="text-sm text-muted">Enter your email and we'll send you a 6-digit code.</p></div>
        <input className="input" type="email" name="email" placeholder="Email" defaultValue={s?.email} required autoComplete="email" />
        <Err s={s} />
        <button className="btn w-full !py-3" disabled={pending}>{pending ? "Please wait…" : "Send code"}</button>
        <p className="text-center text-sm text-muted"><Link className="font-semibold text-brand" href="/login">Back to log in</Link></p>
      </form>
    </AuthShell>
  );
}

export function ResetForm({ email }: { email: string }) {
  const [s, action, pending] = useActionState(resetPassword, undefined);
  return (
    <AuthShell>
      <div className="animate-rise w-full max-w-sm space-y-5">
        <div className="space-y-2"><h2 className="text-3xl font-semibold">Choose a new password</h2>
          <p className="text-sm text-muted">Enter the code we emailed to <b className="text-ink">{email}</b> and pick a new password.</p></div>
        <form action={action} className="space-y-4">
          <input type="hidden" name="email" value={email} />
          <input className={codeInput} name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="······" required autoFocus />
          <input className="input" type="password" name="password" placeholder="New password (8+ characters)" required autoComplete="new-password" />
          <Err s={s} />
          <button className="btn w-full !py-3" disabled={pending}>{pending ? "Saving…" : "Save password and log in"}</button>
        </form>
        <Resend email={email} purpose="reset" />
      </div>
    </AuthShell>
  );
}
