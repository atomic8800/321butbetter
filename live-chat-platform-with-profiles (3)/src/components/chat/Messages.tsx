"use client";

import { useEffect, useMemo, useRef } from "react";
import { Avatar, MediaView } from "@/components/ui";
import { MessageText, RankIcon, StyledName } from "@/components/chat/StyledText";
import { buildMentionMatcher, dayLabel, mentionsUser, type MentionUser, timeAgo, timeOf } from "@/lib/format";
import type { ChatMessage, DirectMessage, PublicUser, SelfUser } from "@/lib/types";

// ===================================================================== useAutoScroll

/** Keeps a scroll container pinned to the bottom unless the user scrolled up. */
export function useAutoScroll<T>(dep: T, resetKey?: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    stick.current = true;
  }, [resetKey]);

  useEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [dep, resetKey]);

  // Media loads change height after render; keep pinned while sticking.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onLoad = () => {
      if (stick.current) el.scrollTop = el.scrollHeight;
    };
    el.addEventListener("load", onLoad, true);
    el.addEventListener("loadedmetadata", onLoad, true);
    return () => {
      el.removeEventListener("load", onLoad, true);
      el.removeEventListener("loadedmetadata", onLoad, true);
    };
  }, []);

  const onScroll = () => {
    const el = ref.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  const pin = () => {
    stick.current = true;
  };
  return { ref, onScroll, pin };
}

// ===================================================================== LoungeMessages

type LoungeMessagesProps = {
  messages: ChatMessage[];
  me: SelfUser;
  onlineIds: Set<number>;
  mentionUsers: MentionUser[];
  live: boolean;
  onOpenProfile: (username: string) => void;
  onDelete: (id: number) => void;
  pinSignal: number;
};

export function LoungeMessages({ messages, me, onlineIds, mentionUsers, live, onOpenProfile, onDelete, pinSignal }: LoungeMessagesProps) {
  const { ref, onScroll } = useAutoScroll(messages, pinSignal);

  // Everyone we know about: users in the list + anyone who has spoken.
  const signature = useMemo(() => {
    const map = new Map<number, MentionUser>();
    for (const u of mentionUsers) map.set(u.id, u);
    for (const m of messages) if (m.author) map.set(m.author.id, m.author);
    map.set(me.id, me);
    return JSON.stringify([...map.values()].map((u) => [u.id, u.username, u.displayName]));
  }, [mentionUsers, messages, me]);
  const matcher = useMemo(() => {
    const list = (JSON.parse(signature) as [number, string, string][]).map(([id, username, displayName]) => ({
      id,
      username,
      displayName,
    }));
    return buildMentionMatcher(list);
  }, [signature]);

  let lastDay = "";

  return (
    <div ref={ref} onScroll={onScroll} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto bg-[#161616] py-2">
      {messages.length === 0 && live && (
        <div className="grid h-full place-items-center text-center text-zinc-500">
          <div>
            <p className="text-3xl">👋</p>
            <p className="mt-2 text-sm">It&apos;s quiet in here. Say hi!</p>
          </div>
        </div>
      )}
      {messages.map((m) => {
        const day = new Date(m.createdAt).toDateString();
        const showDay = day !== lastDay;
        lastDay = day;
        const separator = showDay ? (
          <div className="my-3 flex items-center gap-3 px-5 text-[11px] uppercase tracking-wider text-zinc-600">
            <span className="h-px flex-1 bg-white/[0.06]" />
            {dayLabel(m.createdAt)}
            <span className="h-px flex-1 bg-white/[0.06]" />
          </div>
        ) : null;

        if (m.kind === "system") {
          return (
            <div key={m.id}>
              {separator}
              <div className="my-1.5 px-5 text-center text-[13px] text-zinc-500">
                <span className="rounded-full bg-white/[0.04] px-3 py-1">{m.content}</span>
              </div>
            </div>
          );
        }

        const a = m.author;
        const mentionsMe = !!m.content && a?.id !== me.id && mentionsUser(m.content, matcher, me.id);

        return (
          <div key={m.id}>
            {separator}
            <div
              className={`animate-fade-up group relative flex gap-3 border-l-[3px] px-4 py-2 transition-colors sm:px-5 ${
                mentionsMe ? "border-orange-500 bg-orange-500/[0.07]" : "border-transparent hover:bg-white/[0.025]"
              }`}
            >
              <button
                onClick={() => a && onOpenProfile(a.username)}
                className="shrink-0 self-start rounded-full bg-zinc-300/80 p-[2px]"
                title={a ? `View ${a.displayName}` : undefined}
              >
                <Avatar
                  src={a?.avatarUrl ?? null}
                  name={a?.displayName ?? "?"}
                  accent={a?.accentColor ?? "#71717a"}
                  size={42}
                  online={a ? onlineIds.has(a.id) : false}
                />
              </button>

              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  {a && <RankIcon rank={a.rank} user={a} size={13} />}
                  <button
                    onClick={() => a && onOpenProfile(a.username)}
                    className="min-w-0 text-[14px] font-bold leading-tight hover:underline"
                  >
                    {a ? <StyledName user={a} /> : <span className="text-zinc-500">Deleted user</span>}
                  </button>
                  <span className="shrink-0 text-[11px] text-zinc-600 opacity-0 transition group-hover:opacity-100">
                    {timeOf(m.createdAt)}
                  </span>
                </div>

                {m.content && (
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                    <MessageText content={m.content} style={a ?? {}} matcher={matcher} meId={me.id} onMention={onOpenProfile} />
                  </p>
                )}
                {m.attachment && (
                  <div className="mt-2 max-w-md">
                    <MediaView media={m.attachment} />
                  </div>
                )}
              </div>

              {me.rank === "owner" && (
                <button
                  onClick={() => onDelete(m.id)}
                  className="absolute right-3 top-2 rounded-lg px-2 py-1 text-xs text-zinc-500 opacity-0 transition hover:bg-rose-500/15 hover:text-rose-300 group-hover:opacity-100"
                  title="Delete message (owner)"
                >
                  🗑️
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ===================================================================== DmThread

type DmThreadProps = {
  me: SelfUser;
  peer: PublicUser;
  messages: DirectMessage[] | undefined;
  online: boolean;
  onOpenProfile: (u: PublicUser) => void;
};

export function DmThread({ me, peer, messages, online, onOpenProfile }: DmThreadProps) {
  const { ref, onScroll } = useAutoScroll(messages, peer.id);
  const list = messages ?? [];
  const lastMine = [...list].reverse().find((m) => m.senderId === me.id);

  let lastDay = "";
  return (
    <div ref={ref} onScroll={onScroll} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <div className="mb-6 flex flex-col items-center text-center">
        <button onClick={() => onOpenProfile(peer)}>
          <Avatar src={peer.avatarUrl} name={peer.displayName} accent={peer.accentColor} size={72} online={online} />
        </button>
        <p className="mt-2 text-lg font-black" style={{ color: peer.accentColor }}>
          {peer.displayName}
        </p>
        <p className="text-xs text-zinc-500">
          @{peer.username} · {online ? "online now" : `last seen ${timeAgo(peer.lastSeenAt)}`}
        </p>
        <p className="mt-2 text-xs text-zinc-500">This is the start of your private conversation. 🔒</p>
      </div>

      {!messages && <p className="text-center text-sm text-zinc-500">Loading messages…</p>}

      {list.map((m) => {
        const mine = m.senderId === me.id;
        const day = new Date(m.createdAt).toDateString();
        const showDay = day !== lastDay;
        lastDay = day;
        return (
          <div key={m.id}>
            {showDay && (
              <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wider text-zinc-500">
                <span className="h-px flex-1 bg-white/5" />
                {dayLabel(m.createdAt)}
                <span className="h-px flex-1 bg-white/5" />
              </div>
            )}
            <div className={`animate-fade-up mb-2 flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                {m.attachment && (
                  <div className="max-w-xs">
                    <MediaView media={m.attachment} />
                  </div>
                )}
                {m.content && (
                  <p
                    className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed ${
                      mine
                        ? "rounded-br-md bg-gradient-to-br from-orange-500 to-orange-600 text-white"
                        : "rounded-bl-md border border-white/10 bg-white/[0.06] text-zinc-100"
                    }`}
                  >
                    {m.content}
                  </p>
                )}
                <span className="px-1 text-[10px] text-zinc-500">
                  {timeOf(m.createdAt)}
                  {mine && lastMine?.id === m.id && (m.readAt ? " · Seen" : " · Sent")}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
