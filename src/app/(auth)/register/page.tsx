import AuthForm from "../AuthForm";
import { googleEnabled } from "@/lib/google";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ g?: string; kicked?: string }> }) {
  const { g, kicked } = await searchParams;
  return <AuthForm mode="register" google={googleEnabled()} gError={g} kicked={kicked === "1"} />;
}
