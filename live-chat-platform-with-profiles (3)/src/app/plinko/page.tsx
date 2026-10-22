import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { toSelfUser } from "@/lib/types";
import { PlinkoShell } from "@/components/Shells";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plinko — Better321" };

export default async function PlinkoPage() {
  const user = await getCurrentUser();
  return <PlinkoShell initialUser={user ? toSelfUser(user) : null} />;
}
