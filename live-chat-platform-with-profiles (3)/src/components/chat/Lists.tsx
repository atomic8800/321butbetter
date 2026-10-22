"use client";

import Link from "next/link";
import { RankIcon, StyledName } from "@/components/chat/StyledText";
import { Avatar, ProfileTags } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import type { Conversation, DirectMessage, Presence, PublicUser, SelfUser } from "@/lib/types";

// ===================================================================== Sidebar

type SidebarProps = {
  me: SelfUser;
  view: { type: "lounge" } | { type: "dm"; userId: number };
  conversations: Conversation[];
  onlineIds: Set<number>;
  loungeUnread: number;
  friendRequests: number;
  onLounge: () => void;
  onOpenDm: (c: Conversation) => void;
  className?: string;
  onClose?: () => void;
};

function preview(me: SelfUser, m: DirectMessage | null) {
  if (!m) return "Say hi 👋";
  const prefix = m.senderId === me.id ? "You: " : "";
  if (m.content) return prefix + m.content;
  return prefix + (m.attachment?.type === "video" ? "🎬 Video" : "🖼️ Photo");
}

export function Sidebar({
  me,
  view,
  conversations,
  onlineIds,
  loungeUnread,
  friendRequests,
  onLounge,
  onOpenDm,
  className = "",
  onClose,
}: SidebarProps) {
  const isGuest = me.role === "guest";
  return (
    <aside className={`glass w-64 shrink-0 flex-col overflow-hidden rounded-2xl ${className}`}>
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <h2 className="text-sm font-bold">Chats</h2>
        {onClose && (
          <button className="text-xs text-zinc-400" onClick={onClose}>
            Close
          </button>
        )}
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto p-2">
        <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Channels</p>
        <button
          onClick={onLounge}
          className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
            view.type === "lounge" ? "bg-orange-500/15 text-orange-100" : "text-zinc-300 hover:bg-white/5"
          }`}
        >
          <span className="text-orange-400">#</span>
          <span className="flex-1">Better321</span>
          {loungeUnread > 0 && (
            <span className="rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-black">
              {loungeUnread > 99 ? "99+" : loungeUnread}
            </span>
          )}
        </button>

        {!isGuest && (
          <Link
            href="/friends"
            className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
          >
            <span>👥</span>
            <span className="flex-1">Friends &amp; Wall</span>
            {friendRequests > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white" title="Friend requests">
                {friendRequests}
              </span>
            )}
          </Link>
        )}
        {!isGuest && (
          <Link
            href="/plinko"
            className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
          >
            <span>🎰</span>
            <span className="flex-1">Plinko</span>
            <span className="rounded-full bg-amber-400/15 px-1.5 text-[10px] font-bold text-amber-200">WIN</span>
          </Link>
        )}

        <p className="px-2 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Direct messages</p>
        {isGuest ? (
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.06] p-3 text-xs text-zinc-300">
            Guests can&apos;t send DMs or add friends.{" "}
            <Link href="/profile" className="font-semibold text-orange-300 hover:underline">
              Create a free account
            </Link>{" "}
            to unlock them.
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-3 py-2 text-xs leading-relaxed text-zinc-500">
            No conversations yet. Open someone&apos;s profile and press <b>💬 Message</b> to start one.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {conversations.map((c) => {
              const active = view.type === "dm" && view.userId === c.user.id;
              return (
                <li key={c.user.id}>
                  <button
                    onClick={() => onOpenDm(c)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition ${
                      active ? "bg-orange-500/15" : "hover:bg-white/5"
                    }`}
                  >
                    <Avatar
                      src={c.user.avatarUrl}
                      name={c.user.displayName}
                      accent={c.user.accentColor}
                      size={34}
                      online={onlineIds.has(c.user.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`min-w-0 text-sm ${c.unread ? "font-bold" : "font-medium"}`}>
                          <StyledName user={c.user} />
                        </span>
                        {c.lastMessage && (
                          <span className="shrink-0 text-[10px] text-zinc-600">{timeAgo(c.lastMessage.createdAt)}</span>
                        )}
                      </span>
                      <span className={`block truncate text-xs ${c.unread ? "text-zinc-200" : "text-zinc-500"}`}>
                        {preview(me, c.lastMessage)}
                      </span>
                    </span>
                    {c.unread > 0 && (
                      <span className="rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-black">{c.unread}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

// ===================================================================== UserList

type UserListProps = {
  me: SelfUser;
  presence: Presence;
  onPick: (u: PublicUser) => void;
  className?: string;
  onClose?: () => void;
};

export function UserList({ me, presence, onPick, className = "", onClose }: UserListProps) {
  const { online, offline } = presence;
  const owners = online.filter((u) => u.rank === "owner");
  const mods = online.filter((u) => u.rank === "moderator");
  const members = online.filter((u) => u.rank === "user" && u.role !== "guest");
  const guests = online.filter((u) => u.role === "guest");

  return (
    <aside className={`glass w-72 shrink-0 flex-col overflow-hidden rounded-2xl ${className}`}>
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <h2 className="text-sm font-bold">
          Online <span className="ml-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">{online.length}</span>
        </h2>
        {onClose && (
          <button className="text-xs text-zinc-400" onClick={onClose}>
            Close
          </button>
        )}
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto p-2">
        {owners.length > 0 && <Group title="Owner" list={owners} me={me} onPick={onPick} online />}
        {mods.length > 0 && <Group title="Moderators" list={mods} me={me} onPick={onPick} online />}
        {members.length > 0 && <Group title="Members" list={members} me={me} onPick={onPick} online />}
        {guests.length > 0 && <Group title="Guests" list={guests} me={me} onPick={onPick} online />}
        {online.length === 0 && <p className="p-4 text-center text-xs text-zinc-500">Nobody here yet…</p>}

        {offline.length > 0 && (
          <>
            <div className="mx-2 my-3 h-px bg-white/5" />
            <Group title="Offline" list={offline} me={me} onPick={onPick} online={false} />
          </>
        )}
      </div>
      {me.role === "guest" && (
        <div className="border-t border-white/5 p-3">
          <p className="text-xs text-zinc-400">
            You&apos;re chatting as a guest.{" "}
            <Link href="/profile" className="font-semibold text-orange-300 hover:underline">
              Create an account
            </Link>{" "}
            to customise your profile.
          </p>
        </div>
      )}
    </aside>
  );
}

function Group({
  title,
  list,
  me,
  onPick,
  online,
}: {
  title: string;
  list: PublicUser[];
  me: SelfUser;
  onPick: (u: PublicUser) => void;
  online: boolean;
}) {
  return (
    <div className="mb-3">
      <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {title} — {list.length}
      </p>
      <ul className="space-y-0.5">
        {list.map((u) => (
          <li key={u.id}>
            <button
              onClick={() => onPick(u)}
              className={`flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-white/5 ${
                online ? "" : "opacity-55 hover:opacity-100"
              }`}
            >
              <span className={online ? "" : "grayscale"}>
                <Avatar src={u.avatarUrl} name={u.displayName} accent={u.accentColor} size={34} online={online} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1 text-sm font-semibold">
                  <RankIcon rank={u.rank} user={u} size={12} />
                  <StyledName user={u} />
                  {u.id === me.id && <span className="ml-1 text-xs font-normal text-zinc-500">(you)</span>}
                  {u.mutedUntil && (
                    <span className="ml-1 text-xs" title="Muted">
                      🔇
                    </span>
                  )}
                </span>
                <span className="block truncate text-[11px] text-zinc-500">
                  {online
                    ? `${u.musicUrl ? "🎵 " : ""}${[u.pronouns, u.country].filter(Boolean).join(" · ") || `@${u.username}`}`
                    : `last seen ${timeAgo(u.lastSeenAt)}`}
                </span>
              </span>
              {online && (
                <span className="hidden sm:block">
                  <ProfileTags user={{ ...u, gender: null, sexuality: null, pronouns: null, country: null, relationship: null }} compact />
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
