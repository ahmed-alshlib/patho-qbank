import "@fontsource-variable/inter";
import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Rakeez", description: "Rakeez – question bank for medical students",
  applicationName: "Rakeez",
  // iPhone: open full-screen from the home screen with the right name and status bar.
  appleWebApp: { capable: true, title: "Rakeez", statusBarStyle: "black" },
};
export const viewport: Viewport = { themeColor: "#04160A" };

// Runs before first paint so there is no light/dark flash.
const themeScript = `try{var t=localStorage.getItem("theme");if(t!=="light")document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
