import { redirect } from "next/navigation";
import { VerifyForm } from "../CodeForms";

export default async function Page({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  if (!email) redirect("/login");
  return <VerifyForm email={email} />;
}
