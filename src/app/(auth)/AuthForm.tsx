"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Microscope } from "lucide-react";
import { login, register } from "../actions-auth";
import AuthShell from "./AuthShell";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [state, action, pending] = useActionState(mode === "login" ? login : register, undefined);
  return (
    <AuthShell>
        <form action={action} className="animate-rise w-full max-w-sm space-y-5">
          <div className="space-y-2">
            <div className="mb-6 flex items-center gap-2.5 lg:hidden"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand2 text-white"><Microscope className="h-5 w-5" /></span><span className="font-display text-xl font-semibold">Medical QBank</span></div>
            <h2 className="text-3xl font-semibold">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
            <p className="text-sm text-muted">{mode === "login" ? "Log in to continue studying." : "Create your account, then choose the subjects you want."}</p>
          </div>
          {mode === "register" && <input className="input" name="name" placeholder="Full name" defaultValue={state?.name} required />}
          <input className="input" type="email" name="email" placeholder="Email" defaultValue={state?.email} required autoComplete="email" />
          <input className="input" type="password" name="password" placeholder="Password" required autoComplete={mode === "login" ? "current-password" : "new-password"} />
          {mode === "login" && <div className="text-right"><Link href="/forgot" className="text-xs font-medium text-brand">Forgot password?</Link></div>}
          {state?.error && <p className="animate-shake rounded-xl border border-bad/30 bg-bad/10 p-3 text-sm text-bad">{state.error}</p>}
          <button className="btn w-full !py-3" disabled={pending}>{pending ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</button>
          <p className="text-center text-sm text-muted">
            {mode === "login" ? <>First time? <Link className="font-semibold text-brand" href="/register">Create account</Link></> : <>Already registered? <Link className="font-semibold text-brand" href="/login">Log in</Link></>}
          </p>
        </form>
    </AuthShell>
  );
}
