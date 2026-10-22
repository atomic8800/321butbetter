"use client";

import { KickedScreen, SessionGate, useSession } from "@/components/session";
import { TopNav } from "@/components/TopNav";
import { ChatRoom } from "@/components/ChatRoom";
import type { PublicUser, SelfUser } from "@/lib/types";
import Link from "next/link";
import { AuthPanel } from "@/components/AuthPanel";
import { ProfileEditor } from "@/components/ProfileEditor";
import { ProfileCard } from "@/components/ProfileCard";
import { FriendButton } from "@/components/ui";
import { GiftButton } from "@/components/economy";
import { PlinkoGame } from "@/components/plinko/PlinkoGame";

// ===================================================================== ChatShell

export function ChatShell({ initialUser }: { initialUser: SelfUser | null }) {
  return (
    <SessionGate initialUser={initialUser}>
      {(me, setMe) =>
        me.kickedUntil && new Date(me.kickedUntil).getTime() > Date.now() ? (
          <KickedScreen me={me} />
        ) : (
          <div className="flex h-screen flex-col">
            <TopNav me={me} />
            <ChatRoom me={me} setMe={setMe} />
          </div>
        )
      }
    </SessionGate>
  );
}

// ===================================================================== ProfileShell

export function ProfileShell({ initialUser }: { initialUser: SelfUser | null }) {
  return (
    <SessionGate initialUser={initialUser}>
      {(me, setMe) => (
        <div className="min-h-screen">
          <TopNav me={me} />
          <main className="mx-auto w-full max-w-5xl px-4 py-6">
            <Link href="/chat" className="text-sm text-zinc-400 hover:text-zinc-200">
              ← Back to chat
            </Link>
            {me.role === "guest" ? (
              <div className="mt-6 grid gap-8 lg:grid-cols-2">
                <div>
                  <h1 className="text-3xl font-black tracking-tight">You&apos;re a guest, {me.displayName}</h1>
                  <p className="mt-3 text-zinc-400">
                    Guests can chat and browse profiles, but profile customisation is for members. Create a free
                    account right here — your guest chat history comes with you.
                  </p>
                  <ul className="mt-6 space-y-2 text-sm text-zinc-300">
                    <li>🖼️ Upload a profile picture and banner</li>
                    <li>🎵 Add profile music that plays on your page</li>
                    <li>🏷️ Tag your age, gender, pronouns, country and sexuality</li>
                    <li>🎨 Pick an accent colour for your name</li>
                  </ul>
                </div>
                <AuthPanel upgrade />
              </div>
            ) : (
              <ProfileEditor key={me.id} initial={me} onSaved={setMe} />
            )}
          </main>
        </div>
      )}
    </SessionGate>
  );
}

// ===================================================================== PublicProfileShell

export function PublicProfileShell({
  initialViewer,
  user,
  online,
}: {
  initialViewer: SelfUser | null;
  user: PublicUser;
  online: boolean;
}) {
  const [session] = useSession(initialViewer);
  const me = session.status === "ready" ? session.me : null;

  return (
    <div className="min-h-screen">
      {me ? (
        <TopNav me={me} />
      ) : (
        <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0d0906]/80 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 text-lg font-black tracking-tight">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Better321 logo" className="h-9 w-9 object-contain" />
              <span>
                Better<span className="text-orange-400">321</span>
              </span>
            </Link>
            <Link href="/" className="btn-primary !px-3 !py-1.5 text-sm">
              Join the chat
            </Link>
          </div>
        </header>
      )}
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <Link href="/chat" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Back to chat
        </Link>
        <div className="glass mt-4 overflow-hidden rounded-3xl bg-[#140d08]">
          <ProfileCard
            user={user}
            online={online}
            isMe={me?.id === user.id}
            autoPlayMusic
            large
            actions={
              me && me.role !== "guest" && user.role !== "guest" && me.id !== user.id ? (
                <>
                  <FriendButton userId={user.id} />
                  <GiftButton recipient={user} />
                  <Link href={`/chat?dm=${user.username}`} className="btn-ghost !px-3 !py-1.5 text-xs">
                    💬 Message
                  </Link>
                </>
              ) : null
            }
          />
        </div>
      </main>
    </div>
  );
}

// ===================================================================== PlinkoShell

export function PlinkoShell({ initialUser }: { initialUser: SelfUser | null }) {
  return (
    <SessionGate initialUser={initialUser}>
      {(me) =>
        me.kickedUntil && new Date(me.kickedUntil).getTime() > Date.now() ? (
          <KickedScreen me={me} />
        ) : (
          <div className="min-h-screen">
            <TopNav me={me} />
            <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4">
              {me.role === "guest" ? (
                <div className="glass mx-auto mt-10 max-w-md rounded-3xl p-8 text-center">
                  <p className="text-4xl">🎰</p>
                  <h1 className="mt-3 text-2xl font-black">Plinko is for members</h1>
                  <p className="mt-2 text-sm text-zinc-400">
                    Create a free account to get 500 coins, earn more every minute you&apos;re online, play Plinko and send gifts.
                  </p>
                  <Link href="/profile" className="btn-primary mt-5 inline-block">
                    Create account →
                  </Link>
                </div>
              ) : (
                <PlinkoGame />
              )}
            </main>
          </div>
        )
      }
    </SessionGate>
  );
}
