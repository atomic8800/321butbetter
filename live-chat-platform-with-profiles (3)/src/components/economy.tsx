"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, coinStore, useCoins, useWallet, useWalletPolling, type Wallet } from "@/lib/client";
import { CENTS, DAILY_BONUS, formatCoins, GIFT_MESSAGE_MAX, giftByKey, type GiftKey, GIFTS, INCOME_PER_MINUTE } from "@/lib/economy";
import { Avatar } from "@/components/ui";
import type { PublicUser } from "@/lib/types";
import { timeAgo } from "@/lib/format";

// ===================================================================== CoinIcon

export function CoinIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: "radial-gradient(circle at 35% 30%, #fff3b0 0%, #f5c84c 35%, #d99a1e 70%, #a8700f 100%)",
        boxShadow: "inset 0 -1px 2px rgba(0,0,0,0.35), 0 0 6px rgba(245,200,76,0.35)",
      }}
    />
  );
}

// ===================================================================== CoinPill

function countdown(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${sec}s` : `${sec}s`;
}

export function CoinPill({ initialCoins }: { initialCoins: number }) {
  useWalletPolling(true, initialCoins);
  const coins = useCoins();
  const wallet = useWallet();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [bump, setBump] = useState(false);
  const prev = useRef<number | null>(coins);
  const ref = useRef<HTMLDivElement>(null);

  // Little bounce when the balance goes up.
  useEffect(() => {
    if (coins != null && prev.current != null && coins > prev.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 450);
      prev.current = coins;
      return () => clearTimeout(t);
    }
    prev.current = coins;
  }, [coins]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", onDown);
    return () => {
      clearInterval(t);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const dailyAt = wallet ? new Date(wallet.dailyAvailableAt).getTime() : 0;
  const dailyReady = !!wallet && dailyAt <= now;

  async function claim() {
    setBusy(true);
    setMsg(null);
    const res = await apiFetch("/api/coins/daily", { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { wallet?: Wallet; error?: string };
    setBusy(false);
    if (!res.ok || !data.wallet) return setMsg(data.error ?? "Couldn't claim.");
    coinStore.setWallet(data.wallet, true);
    setMsg(`+${DAILY_BONUS} coins claimed! 🎉`);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-400/10 py-1 pl-1.5 pr-3 text-sm font-bold text-amber-100 transition hover:bg-amber-400/20 ${
          bump ? "scale-110" : ""
        }`}
        title="Your coins"
      >
        <CoinIcon size={20} />
        <span className="tabular-nums">{formatCoins(coins)}</span>
        {dailyReady && <span className="h-2 w-2 rounded-full bg-emerald-400" title="Daily bonus ready" />}
      </button>
      {open && (
        <div className="animate-fade-up absolute right-0 top-11 z-50 w-72 rounded-2xl border border-white/10 bg-[#1a110a] p-4 shadow-2xl">
          <div className="flex items-center gap-2">
            <CoinIcon size={30} />
            <div>
              <p className="text-2xl font-black tabular-nums text-amber-100">{formatCoins(coins)}</p>
              <p className="text-[11px] text-zinc-500">coins</p>
            </div>
          </div>
          <div className="mt-3 space-y-2 text-xs text-zinc-300">
            <p className="rounded-xl bg-white/[0.04] px-3 py-2">
              ⏱️ You earn <b className="text-amber-200">{INCOME_PER_MINUTE} coins every minute</b> while you&apos;re on Better321.
              {wallet && (
                <span className="block text-zinc-500">Next payout in {countdown(new Date(wallet.nextIncomeAt).getTime() + 15_000 - now)}</span>
              )}
            </p>
            <div className="rounded-xl bg-white/[0.04] px-3 py-2">
              <p>
                📅 Daily bonus: <b className="text-amber-200">+{DAILY_BONUS} coins</b>
              </p>
              <button
                disabled={!dailyReady || busy}
                onClick={claim}
                className="btn-primary mt-2 w-full !py-1.5 text-xs disabled:!opacity-40"
              >
                {busy ? "Claiming…" : dailyReady ? "Claim daily bonus" : wallet ? `Ready in ${countdown(dailyAt - now)}` : "…"}
              </button>
            </div>
            {msg && <p className="text-center text-emerald-300">{msg}</p>}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href="/plinko" onClick={() => setOpen(false)} className="btn-ghost !py-1.5 text-center text-xs">
              🎰 Plinko
            </Link>
            <span className="rounded-xl border border-white/10 px-2 py-1.5 text-center text-[11px] leading-tight text-zinc-400">
              🎁 Send gifts from any profile
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================================================================== GiftModal

export const GIFTS_CHANGED = "better321:gifts-changed";

export function GiftModal({ recipient, onClose }: { recipient: PublicUser; onClose: () => void }) {
  const coins = useCoins();
  const [gift, setGift] = useState<GiftKey>("heart");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const def = GIFTS.find((g) => g.key === gift)!;
  const affordable = coins != null && coins >= def.price * CENTS;

  async function send() {
    setBusy(true);
    setError(null);
    const res = await apiFetch("/api/gifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId: recipient.id, gift, message }),
    });
    const data = (await res.json().catch(() => ({}))) as { coins?: number; error?: string };
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Couldn't send gift.");
    if (data.coins != null) coinStore.set(data.coins);
    window.dispatchEvent(new CustomEvent(GIFTS_CHANGED, { detail: recipient.id }));
    setSent(def.key);
    setMessage("");
  }

  return (
    <div className="fixed inset-0 z-[55] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="animate-fade-up w-full max-w-md rounded-3xl border border-orange-500/20 bg-[#140d08] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar src={recipient.avatarUrl} name={recipient.displayName} accent={recipient.accentColor} size={40} />
            <div>
              <p className="text-xs text-zinc-500">Send a gift to</p>
              <p className="font-bold" style={{ color: recipient.accentColor }}>
                {recipient.displayName}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost !px-2.5 !py-1 text-xs">
            ✕
          </button>
        </div>

        {sent ? (
          <div className="py-6 text-center">
            <img
              src={GIFTS.find((g) => g.key === sent)!.image}
              alt=""
              className="mx-auto h-28 w-28 animate-bounce object-contain drop-shadow-[0_10px_25px_rgba(249,115,22,0.35)]"
            />
            <p className="mt-3 text-lg font-black">Gift sent! 🎉</p>
            <p className="text-sm text-zinc-400">It now shows on {recipient.displayName}&apos;s Gifts tab.</p>
            <div className="mt-5 flex justify-center gap-2">
              <button onClick={() => setSent(null)} className="btn-ghost text-sm">
                Send another
              </button>
              <button onClick={onClose} className="btn-primary text-sm">
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-4 gap-2">
              {GIFTS.map((g) => (
                <button
                  key={g.key}
                  onClick={() => setGift(g.key)}
                  className={`flex flex-col items-center rounded-2xl border p-2 transition ${
                    gift === g.key
                      ? "border-orange-400/70 bg-orange-500/15 shadow-[0_0_20px_rgba(249,115,22,0.2)]"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
                  }`}
                >
                  <img src={g.image} alt={g.name} className="h-14 w-14 object-contain" />
                  <span className="mt-1 text-xs font-semibold">{g.name}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-200">
                    <CoinIcon size={11} /> {g.price}
                  </span>
                </button>
              ))}
            </div>
            <input
              className="input mt-4 text-sm"
              placeholder="Add a message (optional)"
              maxLength={GIFT_MESSAGE_MAX}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                Balance: <CoinIcon size={12} /> <b className="text-amber-100">{formatCoins(coins)}</b>
              </span>
              <button onClick={send} disabled={busy || !affordable} className="btn-primary text-sm">
                {busy ? "Sending…" : affordable ? `Send ${def.name} · ${def.price}` : "Not enough coins"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function GiftButton({ recipient }: { recipient: PublicUser }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost !px-3 !py-1.5 text-xs">
        🎁 Gift
      </button>
      {open && <GiftModal recipient={recipient} onClose={() => setOpen(false)} />}
    </>
  );
}

// ===================================================================== GiftsTab

export type GiftData = {
  total: number;
  summary: Record<string, number>;
  recent: {
    id: number;
    gift: string;
    message: string | null;
    createdAt: string;
    sender: { username: string; displayName: string; accentColor: string; avatarUrl: string | null } | null;
  }[];
};

export function useGifts(username: string, userId: number, enabled = true) {
  const [data, setData] = useState<GiftData | null>(null);
  const load = useCallback(async () => {
    if (!enabled) return;
    const res = await apiFetch(`/api/users/${username}/gifts`);
    if (res.ok) setData((await res.json()) as GiftData);
  }, [username, enabled]);
  useEffect(() => {
    void load();
    const onChange = (e: Event) => (e as CustomEvent<number>).detail === userId && void load();
    window.addEventListener(GIFTS_CHANGED, onChange);
    return () => window.removeEventListener(GIFTS_CHANGED, onChange);
  }, [load, userId]);
  return data;
}

export function GiftsTab({ data, isMe }: { data: GiftData | null; isMe: boolean }) {
  if (!data) return <p className="py-6 text-center text-sm text-zinc-500">Loading gifts…</p>;
  return (
    <div className="pb-6">
      <div className="grid grid-cols-4 gap-2">
        {GIFTS.map((g) => {
          const n = data.summary[g.key] ?? 0;
          return (
            <div
              key={g.key}
              className={`flex flex-col items-center rounded-2xl border p-2 ${
                n ? "border-orange-400/25 bg-orange-500/[0.07]" : "border-white/5 bg-white/[0.02] opacity-45"
              }`}
              title={`${n} × ${g.name}`}
            >
              <img src={g.image} alt={g.name} className="h-12 w-12 object-contain" />
              <span className="mt-1 text-sm font-black tabular-nums">×{n}</span>
              <span className="text-[10px] text-zinc-500">{g.name}</span>
            </div>
          );
        })}
      </div>

      <h3 className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        Recent gifts {data.total > 0 && `· ${data.total} total`}
      </h3>
      {data.recent.length === 0 ? (
        <p className="text-sm text-zinc-500">{isMe ? "No gifts yet — they'll show up here." : "No gifts yet. Be the first! 🎁"}</p>
      ) : (
        <ul className="space-y-2">
          {data.recent.map((r) => {
            const def = giftByKey(r.gift);
            return (
              <li key={r.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-2.5">
                {def && <img src={def.image} alt={def.name} className="h-10 w-10 shrink-0 object-contain" />}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate">
                    <b className="text-zinc-100">{def?.name ?? r.gift}</b>
                    <span className="text-zinc-500"> from </span>
                    {r.sender ? (
                      <Link href={`/u/${r.sender.username}`} className="font-semibold hover:underline" style={{ color: r.sender.accentColor }}>
                        {r.sender.displayName}
                      </Link>
                    ) : (
                      <span className="text-zinc-500">a deleted user</span>
                    )}
                  </p>
                  {r.message && <p className="truncate text-xs italic text-zinc-400">“{r.message}”</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {r.sender && <Avatar src={r.sender.avatarUrl} name={r.sender.displayName} accent={r.sender.accentColor} size={22} />}
                  <span className="text-[10px] text-zinc-600">{timeAgo(r.createdAt)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
