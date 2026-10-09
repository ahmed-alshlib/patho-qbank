import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Patho QBank", description: "Pathology question bank for medical students" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
