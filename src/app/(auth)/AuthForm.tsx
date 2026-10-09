"use client";
import { useActionState } from "react";
import Link from "next/link";
import { login, register } from "../actions-auth";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [state, action, pending] = useActionState(mode === "login" ? login : register, undefined);
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={action} className="card w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Patho QBank</h1>
          <p className="text-sm text-slate-500">{mode === "login" ? "Log in to continue studying." : "Create your student account."}</p>
        </div>
        {mode === "register" && <input className="input" name="name" placeholder="Full name" defaultValue={state?.name} required />}
        <input className="input" type="email" name="email" placeholder="Email" defaultValue={state?.email} required autoComplete="email" />
        <input className="input" type="password" name="password" placeholder="Password" required
          autoComplete={mode === "login" ? "current-password" : "new-password"} />
        {state?.error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
        <button className="btn w-full" disabled={pending}>{pending ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}</button>
        <p className="text-center text-sm text-slate-500">
          {mode === "login" ? <>First time? <Link className="text-brand-600" href="/register">Create account</Link></>
            : <>Already registered? <Link className="text-brand-600" href="/login">Log in</Link></>}
        </p>
      </form>
    </main>
  );
}
