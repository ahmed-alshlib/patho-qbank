"use client";
import { useActionState } from "react";
import Link from "next/link";
import { BarChart3, BookMarked, Microscope, Sparkles } from "lucide-react";
import { login, register } from "../actions-auth";
import ThemeToggle from "@/components/ThemeToggle";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [state, action, pending] = useActionState(mode === "login" ? login : register, undefined);
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-brand via-brand to-brand2 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-black/10 blur-3xl" />
        <div className="relative flex items-center gap-2.5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/20 backdrop-blur"><Microscope className="h-5 w-5" /></span><span className="font-display text-2xl font-semibold">Medical QBank</span></div>
        <div className="relative max-w-md space-y-8">
          <h1 className="font-display text-5xl font-semibold leading-[1.05]">Master medicine, one question at a time.</h1>
          <ul className="space-y-4 text-white/90">
            {[[BookMarked, "Organized by chapter and topic with clear explanations"], [Sparkles, "Bookmark, highlight and annotate as you study"], [BarChart3, "Track accuracy, streaks and weak areas"]].map(([Icon, text], n) => {
              const I = Icon as typeof Sparkles;
              return <li key={n} className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/15"><I className="h-4 w-4" /></span>{text as string}</li>;
            })}
          </ul>
        </div>
        <p className="relative text-sm text-white/70">Private access for enrolled students.</p>
      </section>

      <section className="relative flex items-center justify-center p-6">
        <div className="absolute right-4 top-4"><ThemeToggle /></div>
        <form action={action} className="animate-rise w-full max-w-sm space-y-5">
          <div className="space-y-2">
            <div className="mb-6 flex items-center gap-2.5 lg:hidden"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand2 text-white"><Microscope className="h-5 w-5" /></span><span className="font-display text-xl font-semibold">Medical QBank</span></div>
            <h2 className="text-3xl font-semibold">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
            <p className="text-sm text-muted">{mode === "login" ? "Log in to continue studying." : "Create your account, then choose the subjects you want."}</p>
          </div>
          {mode === "register" && <input className="input" name="name" placeholder="Full name" defaultValue={state?.name} required />}
          <input className="input" type="email" name="email" placeholder="Email" defaultValue={state?.email} required autoComplete="email" />
          <input className="input" type="password" name="password" placeholder="Password" required autoComplete={mode === "login" ? "current-password" : "new-password"} />
          {state?.error && <p className="animate-shake rounded-xl border border-bad/30 bg-bad/10 p-3 text-sm text-bad">{state.error}</p>}
          <button className="btn w-full !py-3" disabled={pending}>{pending ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</button>
          <p className="text-center text-sm text-muted">
            {mode === "login" ? <>First time? <Link className="font-semibold text-brand" href="/register">Create account</Link></> : <>Already registered? <Link className="font-semibold text-brand" href="/login">Log in</Link></>}
          </p>
        </form>
      </section>
    </main>
  );
}
