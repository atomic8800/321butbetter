"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui";
import { ProfileCard } from "@/components/ProfileCard";
import { RoleBadge } from "@/components/ui";
import { ModPanel } from "@/components/moderation";
import { StaffPanel } from "@/components/moderation";
import { FriendButton } from "@/components/ui";
import { GiftButton } from "@/components/economy";
import { Composer } from "@/components/Composer";
import { formatRemaining } from "@/components/session";
import { LoungeMessages } from "@/components/chat/Messages";
import { DmThread } from "@/components/chat/Messages";
import { Sidebar } from "@/components/chat/Lists";
import { UserList } from "@/components/chat/Lists";
import { StyledName } from "@/components/chat/StyledText";
import type { SuggestUser } from "@/components/Composer";
import type { SetMe } from "@/components/session";
import { apiFetch, clearToken, withToken } from "@/lib/client";
import { PERMANENT_DATE, isPermanent } from "@/lib/moderation";
import type { ChatMessage, Conversation, DirectMessage, Presence, PublicUser, SelfUser } from "@/lib/types";

type Status = "connecting" | "live" | "reconnecting";
type View = { type: "lounge" } | { type: "dm"; userId: number };

function sortConversations(list: Conversation[]) {
  return [...list].sort((a, b) => (b.lastMessage?.id ?? 0) - (a.lastMessage?.id ?? 0));
}

export function ChatRoom({ me, setMe }: { me: SelfUser; setMe: SetMe }) {
  const isMember = me.role !== "guest";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [presence, setPresence] = useState<Presence>({ online: [], offline: [] });
  const [status, setStatus] = useState<Status>("connecting");
  const [selected, setSelected] = useState<PublicUser | null>(null);
  const [showUsers, setShowUsers] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showStaff, setShowStaff] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const [view, setView] = useState<View>({ type: "lounge" });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [threads, setThreads] = useState<Record<number, DirectMessage[]>>({});
  const [peers, setPeers] = useState<Record<number, PublicUser>>({});
  const [loungeUnread, setLoungeUnread] = useState(0);
  const [friendRequests, setFriendRequests] = useState(0);
  const [dmError, setDmError] = useState<string | null>(null);
  const [pinSignal, setPinSignal] = useState(0);

  const kickedRef = useRef(false);
  const lastIdRef = useRef(0);
  const lastDmIdRef = useRef(0);
  const viewRef = useRef<View>(view);
  const meIdRef = useRef(me.id);
  const meRef = useRef(me);
  useEffect(() => {
    meRef.current = me;
  }, [me]);
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peersRef = useRef(peers);
  const presenceRef = useRef(presence);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);
  useEffect(() => {
    presenceRef.current = presence;
  }, [presence]);

  const appendMessages = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      if (!fresh.length) return prev;
      const next = [...prev, ...fresh].sort((a, b) => a.id - b.id);
      return next.length > 400 ? next.slice(next.length - 400) : next;
    });
    const maxId = Math.max(...incoming.map((m) => m.id));
    if (maxId > lastIdRef.current) lastIdRef.current = maxId;
  }, []);

  const findUser = useCallback((id: number): PublicUser | undefined => {
    const p = presenceRef.current;
    return peersRef.current[id] ?? p.online.find((u) => u.id === id) ?? p.offline.find((u) => u.id === id);
  }, []);

  const refreshConversations = useCallback(async () => {
    const res = await apiFetch("/api/dms");
    if (res.ok) {
      const data = (await res.json()) as { conversations: Conversation[] };
      setConversations(sortConversations(data.conversations));
    }
  }, []);

  const markRead = useCallback((username: string) => {
    void apiFetch(`/api/dms/${username}/read`, { method: "POST" });
  }, []);

  /** Merge incoming DMs into threads + conversation list. */
  const ingestDms = useCallback(
    (dms: DirectMessage[]) => {
      if (!dms.length) return;
      const meId = meIdRef.current;
      const maxId = Math.max(...dms.map((d) => d.id));
      if (maxId > lastDmIdRef.current) lastDmIdRef.current = maxId;

      setThreads((prev) => {
        const next = { ...prev };
        for (const d of dms) {
          const other = d.senderId === meId ? d.recipientId : d.senderId;
          const cur = next[other];
          if (!cur) continue; // thread not loaded yet; it'll fetch fully when opened
          if (cur.some((m) => m.id === d.id)) continue;
          next[other] = [...cur, d];
        }
        return next;
      });

      const v = viewRef.current;
      let missingUser = false;
      setConversations((prev) => {
        let list = [...prev];
        for (const d of dms) {
          const other = d.senderId === meId ? d.recipientId : d.senderId;
          const viewing = v.type === "dm" && v.userId === other;
          const incoming = d.senderId !== meId;
          const idx = list.findIndex((c) => c.user.id === other);
          if (idx >= 0) {
            const c = list[idx];
            if (c.lastMessage && c.lastMessage.id >= d.id) continue;
            list[idx] = { ...c, lastMessage: d, unread: c.unread + (incoming && !viewing ? 1 : 0) };
          } else {
            const u = findUser(other);
            if (!u) {
              missingUser = true;
              continue;
            }
            list = [...list, { user: u, lastMessage: d, unread: incoming && !viewing ? 1 : 0 }];
          }
        }
        return sortConversations(list);
      });
      if (missingUser) void refreshConversations();

      if (v.type === "dm" && dms.some((d) => d.senderId === v.userId)) {
        const peer = findUser(v.userId);
        if (peer) markRead(peer.username);
      }
    },
    [findUser, markRead, refreshConversations],
  );

  const connect = useCallback(() => {
    esRef.current?.close();
    const es = new EventSource(
      withToken(`/api/stream?after=${lastIdRef.current}&dmAfter=${lastDmIdRef.current}`),
      { withCredentials: true },
    );
    esRef.current = es;

    es.addEventListener("init", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as {
        messages: ChatMessage[];
        presence: Presence;
        conversations: Conversation[] | null;
        dmLastId: number;
        friendRequests: number;
      };
      appendMessages(data.messages);
      setPresence(data.presence);
      if (data.conversations) setConversations(sortConversations(data.conversations));
      if (data.dmLastId > lastDmIdRef.current) lastDmIdRef.current = data.dmLastId;
      setFriendRequests(data.friendRequests ?? 0);
      setStatus("live");
    });
    es.addEventListener("messages", (ev) => {
      const fresh = JSON.parse((ev as MessageEvent).data) as ChatMessage[];
      appendMessages(fresh);
      if (viewRef.current.type !== "lounge") {
        const n = fresh.filter((m) => m.kind === "user" && m.author?.id !== meIdRef.current).length;
        if (n) setLoungeUnread((u) => u + n);
      }
    });
    es.addEventListener("dms", (ev) => ingestDms(JSON.parse((ev as MessageEvent).data) as DirectMessage[]));
    es.addEventListener("presence", (ev) => setPresence(JSON.parse((ev as MessageEvent).data) as Presence));
    es.addEventListener("counts", (ev) => {
      const d = JSON.parse((ev as MessageEvent).data) as { friendRequests: number };
      setFriendRequests(d.friendRequests);
    });
    es.addEventListener("self", (ev) => setMe(JSON.parse((ev as MessageEvent).data) as SelfUser));
    es.addEventListener("deleted", (ev) => {
      const ids = new Set(JSON.parse((ev as MessageEvent).data) as number[]);
      setMessages((prev) => prev.filter((m) => !ids.has(m.id)));
    });
    es.addEventListener("reconnect", () => {
      // Server is recycling the connection (hosting time limit): reconnect right away and catch up.
      es.close();
      if (retryRef.current) clearTimeout(retryRef.current);
      connect();
    });
    es.addEventListener("banned", (ev) => {
      const d = JSON.parse((ev as MessageEvent).data) as { reason: string | null };
      kickedRef.current = true;
      es.close();
      clearToken();
      setMe({ ...meRef.current, kickedUntil: PERMANENT_DATE.toISOString(), kickReason: d.reason });
    });
    es.addEventListener("kicked", (ev) => {
      kickedRef.current = true;
      es.close();
      setMe(JSON.parse((ev as MessageEvent).data) as SelfUser);
    });
    es.onerror = () => {
      es.close();
      if (kickedRef.current) return;
      setStatus("reconnecting");
      if (retryRef.current) clearTimeout(retryRef.current);
      retryRef.current = setTimeout(connect, 2000);
    };
  }, [appendMessages, ingestDms, setMe]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [connect]);

  // Mute countdown ticker.
  const mutedActive = !!me.mutedUntil && new Date(me.mutedUntil).getTime() > now;
  useEffect(() => {
    if (!me.mutedUntil) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [me.mutedUntil]);

  // Escape closes overlays.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelected(null);
        setShowUsers(false);
        setShowSidebar(false);
        setShowStaff(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onlineIds = useMemo(() => new Set(presence.online.map((u) => u.id)), [presence.online]);
  const mentionUsers = useMemo<SuggestUser[]>(() => {
    const map = new Map<number, SuggestUser>();
    for (const u of [...presence.online, ...presence.offline]) {
      map.set(u.id, { id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl, accentColor: u.accentColor });
    }
    return [...map.values()];
  }, [presence]);
  const isStaff = me.rank === "owner" || me.rank === "moderator";

  // ---- navigation ---------------------------------------------------------
  function goLounge() {
    setView({ type: "lounge" });
    setLoungeUnread(0);
    setShowSidebar(false);
    setPinSignal((n) => n + 1);
  }

  const openDm = useCallback(
    async (target: PublicUser | string) => {
      if (!isMember) return;
      setDmError(null);
      setSelected(null);
      setShowSidebar(false);
      const username = typeof target === "string" ? target : target.username;
      if (typeof target !== "string") {
        setPeers((p) => ({ ...p, [target.id]: target }));
        setView({ type: "dm", userId: target.id });
        setConversations((prev) => prev.map((c) => (c.user.id === target.id ? { ...c, unread: 0 } : c)));
      }
      const res = await apiFetch(`/api/dms/${username}`);
      const data = (await res.json().catch(() => ({}))) as { user?: PublicUser; messages?: DirectMessage[]; error?: string };
      if (!res.ok || !data.user) {
        setDmError(data.error ?? "Could not open conversation.");
        if (typeof target === "string") setView({ type: "lounge" });
        return;
      }
      const u = data.user;
      setPeers((p) => ({ ...p, [u.id]: u }));
      setThreads((t) => ({ ...t, [u.id]: data.messages ?? [] }));
      setView({ type: "dm", userId: u.id });
      setConversations((prev) => {
        const exists = prev.some((c) => c.user.id === u.id);
        const list = exists
          ? prev.map((c) => (c.user.id === u.id ? { ...c, user: u, unread: 0 } : c))
          : [...prev, { user: u, lastMessage: data.messages?.at(-1) ?? null, unread: 0 }];
        return sortConversations(list);
      });
    },
    [isMember],
  );

  // Deep link: /chat?dm=username
  useEffect(() => {
    const dm = new URLSearchParams(window.location.search).get("dm");
    if (dm && isMember) {
      void openDm(dm);
      window.history.replaceState(null, "", "/chat");
    }
  }, [isMember, openDm]);

  async function openProfile(username: string) {
    const cached = [...presence.online, ...presence.offline].find((u) => u.username === username);
    if (cached) return setSelected(cached);
    const res = await apiFetch(`/api/users/${username}`);
    if (res.ok) setSelected(((await res.json()) as { user: PublicUser }).user);
  }

  // ---- sending ------------------------------------------------------------
  async function sendLounge(content: string, file: File | null): Promise<string | null> {
    const fd = new FormData();
    fd.set("content", content);
    if (file) fd.set("file", file);
    try {
      const res = await apiFetch("/api/messages", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { message?: ChatMessage; error?: string };
      if (!res.ok) return data.error ?? "Could not send.";
      setPinSignal((n) => n + 1);
      if (data.message) appendMessages([data.message]);
      return null;
    } catch {
      return "Network error.";
    }
  }

  async function sendDm(peer: PublicUser, content: string, file: File | null): Promise<string | null> {
    const fd = new FormData();
    fd.set("content", content);
    if (file) fd.set("file", file);
    try {
      const res = await apiFetch(`/api/dms/${peer.username}`, { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { message?: DirectMessage; error?: string };
      if (!res.ok) return data.error ?? "Could not send.";
      if (data.message) ingestDms([data.message]);
      return null;
    } catch {
      return "Network error.";
    }
  }

  async function deleteMessage(id: number) {
    const res = await apiFetch("/api/mod", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_message", messageId: id }),
    });
    if (res.ok) setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  /** A user was banned & deleted: drop them from every list right away. */
  function handleUserDeleted(id: number) {
    setSelected(null);
    setPresence((p) => ({
      online: p.online.filter((u) => u.id !== id),
      offline: p.offline.filter((u) => u.id !== id),
    }));
    setConversations((c) => c.filter((x) => x.user.id !== id));
    setMessages((m) => m.filter((x) => x.author?.id !== id));
    if (view.type === "dm" && view.userId === id) setView({ type: "lounge" });
  }

  function applyUserUpdate(u: PublicUser) {
    setSelected(u);
    setPresence((p) => ({
      online: p.online.map((x) => (x.id === u.id ? u : x)),
      offline: p.offline.map((x) => (x.id === u.id ? u : x)),
    }));
  }

  const mutedBanner = mutedActive ? (
    <div className="mb-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
      🔇 You are muted{" "}
      {isPermanent(me.mutedUntil) ? "permanently" : `for ${formatRemaining(new Date(me.mutedUntil!).getTime() - now)}`}
      {me.muteReason ? ` — ${me.muteReason}` : ""}
    </div>
  ) : null;

  const peer = view.type === "dm" ? peers[view.userId] ?? findUser(view.userId) : undefined;
  const totalDmUnread = conversations.reduce((n, c) => n + c.unread, 0);

  const sidebarProps = {
    me,
    view,
    conversations,
    onlineIds,
    loungeUnread,
    friendRequests,
    onLounge: goLounge,
    onOpenDm: (c: Conversation) => void openDm(c.user),
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 gap-3 p-3">
      <Sidebar {...sidebarProps} className="hidden lg:flex" />
      {showSidebar && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setShowSidebar(false)}>
          <div className="absolute bottom-3 left-3 top-16 flex" onClick={(e) => e.stopPropagation()}>
            <Sidebar {...sidebarProps} className="flex" onClose={() => setShowSidebar(false)} />
          </div>
        </div>
      )}

      {/* Main column */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#161616]">
        <div className="flex items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              className="btn-ghost relative !px-2.5 !py-1.5 text-xs lg:hidden"
              onClick={() => setShowSidebar(true)}
              aria-label="Open chats"
            >
              💬
              {(totalDmUnread > 0 || loungeUnread > 0 || friendRequests > 0) && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-orange-500" />
              )}
            </button>
            {view.type === "lounge" || !peer ? (
              <div>
                <h1 className="flex items-center gap-2 text-base font-bold">
                  <span className="text-orange-400">#</span> Better321
                </h1>
                <p className="text-xs text-zinc-400">
                  {status === "live" ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="online-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live ·{" "}
                      {presence.online.length} online
                    </span>
                  ) : status === "connecting" ? (
                    "Connecting…"
                  ) : (
                    <span className="text-amber-300">Reconnecting…</span>
                  )}
                </p>
              </div>
            ) : (
              <button onClick={() => setSelected(peer)} className="flex min-w-0 items-center gap-2.5 text-left">
                <Avatar src={peer.avatarUrl} name={peer.displayName} accent={peer.accentColor} size={34} online={onlineIds.has(peer.id)} />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 text-base font-bold">
                      <StyledName user={peer} />
                    </span>
                    <RoleBadge role={peer.role} rank={peer.rank} />
                  </span>
                  <span className="block text-xs text-zinc-400">
                    {onlineIds.has(peer.id) ? "🟢 Online" : "Offline"} · Direct message
                  </span>
                </span>
              </button>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {view.type === "dm" && (
              <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={goLounge}>
                ← Lounge{loungeUnread > 0 ? ` (${loungeUnread})` : ""}
              </button>
            )}
            {isStaff && view.type === "lounge" && (
              <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setShowStaff(true)}>
                {me.rank === "owner" ? "👑 Owner panel" : "🛡️ Mod panel"}
              </button>
            )}
            <button className="btn-ghost !px-3 !py-1.5 text-xs xl:hidden" onClick={() => setShowUsers((v) => !v)}>
              👥 {presence.online.length}
            </button>
          </div>
        </div>

        {dmError && (
          <div className="mx-4 mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {dmError}
          </div>
        )}

        {view.type === "lounge" || !peer ? (
          <>
            <LoungeMessages
              messages={messages}
              me={me}
              onlineIds={onlineIds}
              mentionUsers={mentionUsers}
              live={status === "live"}
              onOpenProfile={openProfile}
              onDelete={deleteMessage}
              pinSignal={pinSignal}
            />
            <Composer
              placeholder={mutedActive ? "You are muted" : `Message #Better321 as ${me.displayName}…`}
              disabled={mutedActive}
              mentionUsers={mentionUsers.filter((u) => u.id !== me.id)}
              banner={mutedBanner}
              onSend={sendLounge}
            />
          </>
        ) : (
          <>
            <DmThread
              me={me}
              peer={peer}
              messages={threads[peer.id]}
              online={onlineIds.has(peer.id)}
              onOpenProfile={(u) => setSelected(u)}
            />
            <Composer
              key={`dm-${peer.id}`}
              placeholder={mutedActive ? "You are muted" : `Message ${peer.displayName}…`}
              disabled={mutedActive}
              banner={mutedBanner}
              onSend={(c, f) => sendDm(peer, c, f)}
            />
          </>
        )}
      </section>

      <UserList me={me} presence={presence} onPick={setSelected} className="hidden xl:flex" />
      {showUsers && (
        <div className="fixed inset-0 z-30 bg-black/50 xl:hidden" onClick={() => setShowUsers(false)}>
          <div className="absolute bottom-3 right-3 top-16 flex" onClick={(e) => e.stopPropagation()}>
            <UserList
              me={me}
              presence={presence}
              onPick={(u) => {
                setSelected(u);
                setShowUsers(false);
              }}
              className="flex"
              onClose={() => setShowUsers(false)}
            />
          </div>
        </div>
      )}

      {/* Profile drawer */}
      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/50 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div
            className="animate-fade-up h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#140d08] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-semibold text-zinc-300">Profile</span>
              <button onClick={() => setSelected(null)} className="btn-ghost !px-2.5 !py-1 text-xs">
                ✕
              </button>
            </div>
            <ProfileCard
              user={selected}
              online={onlineIds.has(selected.id)}
              isMe={selected.id === me.id}
              compactMusic
              actions={
                isMember && selected.role !== "guest" && selected.id !== me.id ? (
                  <>
                    <FriendButton userId={selected.id} />
                    <GiftButton recipient={selected} />
                    <button onClick={() => void openDm(selected)} className="btn-ghost !px-3 !py-1.5 text-xs">
                      💬 Message
                    </button>
                  </>
                ) : null
              }
            />
            <ModPanel me={me} target={selected} onUpdated={applyUserUpdate} onDeleted={handleUserDeleted} />
          </div>
        </div>
      )}

      {showStaff && <StaffPanel me={me} onClose={() => setShowStaff(false)} />}
    </div>
  );
}
