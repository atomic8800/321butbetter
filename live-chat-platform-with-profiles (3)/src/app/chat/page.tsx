import { getCurrentUser } from "@/lib/auth";
import { toSelfUser } from "@/lib/types";
import { ChatShell } from "@/components/Shells";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await getCurrentUser();
  return <ChatShell initialUser={user ? toSelfUser(user) : null} />;
}
