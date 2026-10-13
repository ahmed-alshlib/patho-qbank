/* eslint-disable @next/next/no-img-element */
/** The Rakeez wordmark. tone="auto" follows light/dark mode; "bright" is for dark photo backgrounds; "deep" for light ones. */
export default function Logo({ className = "h-7", tone = "auto" }: { className?: string; tone?: "auto" | "bright" | "deep" | "white" }) {
  if (tone === "white") return <img src="/logo-bright.png" alt="Rakeez" className={`${className} w-auto brightness-0 invert`} />;
  if (tone === "bright") return <img src="/logo-bright.png" alt="Rakeez" className={`${className} w-auto`} />;
  if (tone === "deep") return <img src="/logo-deep.png" alt="Rakeez" className={`${className} w-auto`} />;
  return (
    <>
      <img src="/logo-deep.png" alt="Rakeez" className={`${className} w-auto dark:hidden`} />
      <img src="/logo-bright.png" alt="" aria-hidden className={`${className} hidden w-auto dark:block`} />
    </>
  );
}
