import AuthForm from "../AuthForm";
import { googleEnabled } from "@/lib/google";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ g?: string }> }) {
  const { g } = await searchParams;
  return <AuthForm mode="login" google={googleEnabled()} gError={g} />;
}
