"use client";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 max-w-md space-y-4 text-center" role="alert">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted">The page could not be loaded. Your account and progress are safe.</p>
      <div className="flex justify-center gap-2">
        <button className="btn" onClick={() => reset()}>Try again</button>
        <a className="btn-ghost" href="/">Go to dashboard</a>
        <a className="btn-ghost" href="/api/auth/logout?k=1">Log out</a>
      </div>
    </div>
  );
}
