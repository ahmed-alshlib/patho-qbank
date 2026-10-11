"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Microscope } from "lucide-react";
import { login, register } from "../actions-auth";
import AuthShell from "./AuthShell";

const G_ERRORS: Record<string, string> = {
  cancelled: "Google sign-in was cancelled.",
  admin: "Admin accounts must log in with email and password.",
  unverified: "Your Google email isn't verified. Use email and password instead.",
  busy: "Too many attempts. Please wait a few minutes.",
};

export default function AuthForm({ mode, google, gError, kicked }: { mode: "login" | "register"; google?: boolean; gError?: string; kicked?: boolean }) {
  const [state, action, pending] = useActionState(mode === "login" ? login : register, undefined);
  return (
    <AuthShell>
        <form action={action} className="animate-rise w-full max-w-sm space-y-5">
          <div className="space-y-2">
            <div className="mb-6 flex items-center gap-2.5 lg:hidden"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand2 text-white"><Microscope className="h-5 w-5" /></span><span className="font-display text-xl font-semibold">Rakeez</span></div>
            <h2 className="text-3xl font-semibold">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
            <p className="text-sm text-muted">{mode === "login" ? "Log in to continue studying." : "Create your account, then choose the subjects you want."}</p>
          </div>
          {mode === "register" && <input className="input" name="name" placeholder="Full name" defaultValue={state?.name} required />}
          <input className="input" type="email" name="email" placeholder="Email" defaultValue={state?.email} required autoComplete="email" />
          <input className="input" type="password" name="password" placeholder="Password" required autoComplete={mode === "login" ? "current-password" : "new-password"} />
          {mode === "login" && <div className="text-right"><Link href="/forgot" className="text-xs font-medium text-brand">Forgot password?</Link></div>}
          {kicked && <p className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm text-warn">You were signed out. An account can be used on 2 devices at a time, so signing in on another device signs out the oldest one.</p>}
          {gError && !state?.error && <p className="rounded-xl border border-bad/30 bg-bad/10 p-3 text-sm text-bad">{G_ERRORS[gError] ?? "Google sign-in failed. Please try again."}</p>}
          {state?.error && <p className="animate-shake rounded-xl border border-bad/30 bg-bad/10 p-3 text-sm text-bad">{state.error}</p>}
          <button className="btn w-full !py-3" disabled={pending}>{pending ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</button>
          {google && (
            <>
              <div className="flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
              <a href="/api/auth/google" className="btn-ghost w-full !py-3">
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden><path fill="#4285F4" d="M23 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.4z"/><path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.6 14.7a7.2 7.2 0 0 1 0-4.6v-3H1.8a12 12 0 0 0 0 10.6l3.8-3z"/><path fill="#EA4335" d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3A12 12 0 0 0 1.8 7.1l3.8 3C6.5 6.8 9 4.8 12 4.8z"/></svg>
                Continue with Google
              </a>
            </>
          )}
          <p className="text-center text-sm text-muted">
            {mode === "login" ? <>First time? <Link className="font-semibold text-brand" href="/register">Create account</Link></> : <>Already registered? <Link className="font-semibold text-brand" href="/login">Log in</Link></>}
          </p>
        </form>
    </AuthShell>
  );
}
