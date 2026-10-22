import { getCurrentUser } from "@/lib/auth";
import { toSelfUser } from "@/lib/types";
import { FriendsShell } from "@/components/friends/FriendsShell";

export const dynamic = "force-dynamic";

export default async function FriendsPage() {
  const user = await getCurrentUser();
  return <FriendsShell initialUser={user ? toSelfUser(user) : null} />;
}
