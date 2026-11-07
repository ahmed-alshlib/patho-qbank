"use client";
import Logo from "@/components/Logo";
import { AnalyticsIdentify } from "@/components/Analytics";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";

const AR = { fontFamily: '"IBM Plex Sans Arabic", system-ui, sans-serif' } as const;

function Quote({ small = false }: { small?: boolean }) {
  return (
    <figure dir="rtl" lang="ar" style={AR}
      className={`relative overflow-hidden rounded-[2rem] border border-white/40 bg-slate-950/30 text-center text-white shadow-[inset_0_1px_0_rgba(255,255,255,.55),0_30px_80px_rgba(6,24,80,.35)] backdrop-blur-2xl ${small ? "px-6 py-8" : "px-12 py-16"}`}>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-white/5" />
      <blockquote className={`relative font-semibold leading-[1.5] [text-shadow:0_2px_24px_rgba(0,20,80,.35)] ${small ? "text-2xl" : "text-5xl"}`}>بقدر الكد تكتسب المعالي</blockquote>
      <div className="relative mx-auto my-6 h-px w-16 bg-white/60" />
      <figcaption className={`relative font-medium text-white/90 ${small ? "text-base" : "text-xl"}`}>الإمام الشافعي</figcaption>
    </figure>
  );
}

/** Auth pages are always shown in the dark palette on top of the photo background. */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="dark relative min-h-screen bg-[#052e16] bg-[url('/auth-bg-g.jpg')] bg-cover bg-center text-white">
      <AnalyticsIdentify userId={null} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#031a0c]/20 via-transparent to-[#031a0c]/45" />
      <div className="relative grid min-h-screen lg:grid-cols-2">
        <section className="hidden flex-col justify-between p-12 lg:flex">
          <div className="flex items-center"><Logo className="h-10" tone="white" /></div>
          <div className="mx-auto w-full max-w-xl"><Quote /></div>
          <p className="text-sm text-white/80">Private access for enrolled students.</p>
        </section>

        <section className="flex flex-col items-center justify-center gap-6 p-5 sm:p-8">
          <div className="w-full max-w-md rounded-[2rem] border border-white/35 bg-[#031a0c]/55 p-7 [&_.text-muted]:!text-white/80 [&_.text-brand]:!text-white [&_a.text-brand]:underline [&_a.text-brand]:underline-offset-4 [&_.bg-line]:!bg-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,.4),0_30px_80px_rgba(2,20,8,.5)] backdrop-blur-2xl sm:p-9">
            {children}
          </div>
          <div className="w-full max-w-md lg:hidden"><Quote small /></div>
        </section>
      </div>
    </main>
  );
}
