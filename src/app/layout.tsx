import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: "Patho QBank", description: "Pathology question bank for medical students" };
export const viewport: Viewport = { themeColor: "#4f46e5" };

// Runs before first paint so there is no light/dark flash.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
