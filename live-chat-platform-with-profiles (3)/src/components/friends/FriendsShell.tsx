"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SessionGate } from "@/components/session";
import { TopNav } from "@/components/TopNav";
import { Avatar } from "@/components/ui";
import { RoleBadge } from "@/components/ui";
import { FriendButton } from "@/components/ui";
import { Wall } from "@/components/friends/Wall";
import { apiFetch } from "@/lib/client";
import { timeAgo } from "@/lib/format";
import type { PublicUser, SelfUser } from "@/lib/types";

type Tab = "wall" | "friends" | "requests" | "find";
type FriendData = { friends: PublicUser[]; incoming: PublicUser[]; outgoing: PublicUser[] };

const ONLINE_MS = 45_000;
const isOnline = (u: PublicUser) => Date.now() - new Date(u.lastSeenAt).getTime() < ONLINE_MS;

export function FriendsShell({ initialUser }: { initialUser: SelfUser | null }) {
  return (
    <SessionGate initialUser={initialUser}>
      {(me) => (
        <div className="min-h-screen">
          <TopNav me={me} />
          <main className="mx-auto w-full max-w-4xl px-4 py-6">
            <Link href="/chat" className="text-sm text-zinc-400 hover:text-zinc-200">
              ← Back to chat
            </Link>
            {me.role === "guest" ? (
              <div className="glass mt-6 rounded-3xl p-8 text-center">
                <p className="text-4xl">👥</p>
                <h1 className="mt-3 text-2xl font-black">Friends &amp; Wall are for members</h1>
                <p className="mt-2 text-sm text-zinc-400">
                  Create a free account to add friends, send DMs and post photos &amp; videos to your friends&apos; wall.
                </p>
                <Link href="/profile" className="btn-primary mt-5 inline-block">
                  Create account →
                </Link>
              </div>
            ) : (
              <FriendsHub me={me} />
            )}
          </main>
        </div>
      )}
    </SessionGate>
  );
}

function FriendsHub({ me }: { me: SelfUser }) {
  const [tab, setTab] = useState<Tab>("wall");
  const [data, setData] = useState<FriendData | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/friends");
    if (res.ok) setData((await res.json()) as FriendData);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: string, userId: number) {
    await apiFetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, userId }),
    });
    await load();
  }

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "wall", label: "🧱 Wall" },
    { key: "friends", label: `🤝 Friends${data ? ` (${data.friends.length})` : ""}` },
    { key: "requests", label: "📨 Requests", badge: data?.incoming.length },
    { key: "find", label: "🔍 Find people" },
  ];

  return (
    <div className="mt-4">
      <h1 className="text-3xl font-black tracking-tight">
        Friends <span className="text-orange-400">&amp;</span> Wall
      </h1>
      <p className="mt-1 text-sm text-zinc-400">Posts on the wall are visible to you and your friends.</p>

      <div className="mt-5 flex flex-wrap gap-1 rounded-xl bg-white/5 p-1 text-sm">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative flex-1 rounded-lg px-3 py-2 font-medium transition ${
              tab === t.key ? "bg-orange-500/20 text-orange-100 shadow" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t.label}
            {!!t.badge && (
              <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "wall" && <Wall me={me} friendCount={data?.friends.length ?? 0} onFindFriends={() => setTab("find")} />}

        {tab === "friends" &&
          (!data ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : data.friends.length === 0 ? (
            <Empty text="No friends yet." action={() => setTab("find")} actionLabel="Find people" />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {data.friends.map((u) => (
                <li key={u.id} className="glass flex items-center gap-3 rounded-2xl p-3">
                  <Avatar src={u.avatarUrl} name={u.displayName} accent={u.accentColor} size={48} online={isOnline(u)} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2">
                      <span className="truncate font-semibold" style={{ color: u.accentColor }}>
                        {u.displayName}
                      </span>
                      <RoleBadge role={u.role} rank={u.rank} />
                    </p>
                    <p className="text-xs text-zinc-500">
                      @{u.username} · {isOnline(u) ? "online" : `seen ${timeAgo(u.lastSeenAt)}`}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Link href={`/chat?dm=${u.username}`} className="btn-primary !px-2.5 !py-1 text-xs">
                        💬 Message
                      </Link>
                      <Link href={`/u/${u.username}`} className="btn-ghost !px-2.5 !py-1 text-xs">
                        Profile
                      </Link>
                      <button
                        onClick={() => window.confirm(`Remove ${u.displayName} as a friend?`) && act("remove", u.id)}
                        className="btn-ghost !px-2.5 !py-1 text-xs hover:!text-rose-200"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ))}

        {tab === "requests" &&
          (!data ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : (
            <div className="space-y-6">
              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Incoming — {data.incoming.length}
                </h2>
                {data.incoming.length === 0 ? (
                  <p className="text-sm text-zinc-500">No pending requests.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.incoming.map((u) => (
                      <PersonRow key={u.id} u={u}>
                        <button onClick={() => act("accept", u.id)} className="btn-primary !px-3 !py-1.5 text-xs">
                          ✓ Accept
                        </button>
                        <button onClick={() => act("decline", u.id)} className="btn-ghost !px-3 !py-1.5 text-xs">
                          Decline
                        </button>
                      </PersonRow>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Sent — {data.outgoing.length}
                </h2>
                {data.outgoing.length === 0 ? (
                  <p className="text-sm text-zinc-500">No outgoing requests.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.outgoing.map((u) => (
                      <PersonRow key={u.id} u={u}>
                        <button onClick={() => act("cancel", u.id)} className="btn-ghost !px-3 !py-1.5 text-xs">
                          Cancel request
                        </button>
                      </PersonRow>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ))}

        {tab === "find" && <FindPeople onChange={load} />}
      </div>
    </div>
  );
}

function PersonRow({ u, children }: { u: PublicUser; children: React.ReactNode }) {
  return (
    <li className="glass flex items-center gap-3 rounded-2xl p-3">
      <Link href={`/u/${u.username}`}>
        <Avatar src={u.avatarUrl} name={u.displayName} accent={u.accentColor} size={40} online={isOnline(u)} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/u/${u.username}`} className="block truncate font-semibold hover:underline" style={{ color: u.accentColor }}>
          {u.displayName}
        </Link>
        <p className="text-xs text-zinc-500">@{u.username}</p>
      </div>
      <div className="flex flex-wrap justify-end gap-1.5">{children}</div>
    </li>
  );
}

function FindPeople({ onChange }: { onChange: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PublicUser[] | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults(null);
      return;
    }
    const t = setTimeout(async () => {
      const res = await apiFetch(`/api/users/search?q=${encodeURIComponent(term)}`);
      if (res.ok) setResults(((await res.json()) as { users: PublicUser[] }).users);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <input
        className="input"
        placeholder="Search by username or display name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      <div className="mt-4">
        {results === null ? (
          <p className="text-sm text-zinc-500">Start typing to find people. You can also add friends from anyone&apos;s profile in the chat.</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-zinc-500">No members match “{q}”.</p>
        ) : (
          <ul className="space-y-2">
            {results.map((u) => (
              <PersonRow key={u.id} u={u}>
                <FriendButton userId={u.id} onChange={onChange} />
              </PersonRow>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Empty({ text, action, actionLabel }: { text: string; action: () => void; actionLabel: string }) {
  return (
    <div className="glass rounded-2xl p-8 text-center">
      <p className="text-sm text-zinc-400">{text}</p>
      <button onClick={action} className="btn-primary mt-4">
        {actionLabel}
      </button>
    </div>
  );
}
