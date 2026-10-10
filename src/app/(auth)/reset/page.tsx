import { redirect } from "next/navigation";
import { ResetForm } from "../CodeForms";

export default async function Page({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  if (!email) redirect("/login");
  return <ResetForm email={email} />;
}
