import nodemailer from "nodemailer";

export type MailProvider = "smtp" | "resend" | "console" | "none";
export function mailProvider(): MailProvider {
  if (process.env.SMTP_URL) return "smtp";
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.MAIL_CONSOLE === "1") return "console";
  return "none";
}

const FROM = () => process.env.MAIL_FROM ?? "Medical QBank <onboarding@resend.dev>";

export async function sendMail(to: string, subject: string, text: string) {
  const p = mailProvider();
  if (p === "console") { console.log(`[mail] to=${to} subject=${subject}\n${text}`); return; }
  if (p === "smtp") {
    await nodemailer.createTransport(process.env.SMTP_URL!).sendMail({ from: FROM(), to, subject, text });
    return;
  }
  if (p === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM(), to, subject, text }),
    });
    if (!res.ok) throw new Error(`Email failed: ${res.status} ${await res.text()}`);
    return;
  }
  throw new Error("Email is not configured");
}
