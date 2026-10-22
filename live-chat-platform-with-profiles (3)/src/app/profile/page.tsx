import { getCurrentUser } from "@/lib/auth";
import { toSelfUser } from "@/lib/types";
import { ProfileShell } from "@/components/Shells";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  return <ProfileShell initialUser={user ? toSelfUser(user) : null} />;
}
