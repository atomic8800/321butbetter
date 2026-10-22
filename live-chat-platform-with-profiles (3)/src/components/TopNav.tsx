"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiFetch, clearToken, hardNavigate } from "@/lib/client";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui";
import { RoleBadge } from "@/components/ui";
import { CoinPill } from "@/components/economy";
import type { PublicUser, SelfUser } from "@/lib/types";

export function TopNav({ me }: { me: PublicUser }) {
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [framed, setFramed] = useState(false);

  useEffect(() => {
    try {
      setFramed(window.self !== window.top);
    } catch {
      setFramed(true);
    }
  }, []);

  async function logout() {
    setBusy(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      clearToken();
      hardNavigate("/");
    }
  }

  const link = (href: string, label: string) => (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        pathname === href ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0d0906]/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-4">
          <Link href="/chat" className="flex items-center gap-2 text-lg font-black tracking-tight">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Better321 logo" className="h-9 w-9 object-contain drop-shadow-[0_4px_10px_rgba(249,115,22,0.35)]" />
            <span>
              Better<span className="text-orange-400">321</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {link("/chat", "Chat")}
            {me.role !== "guest" && link("/friends", "Friends & Wall")}
            {me.role !== "guest" && link("/plinko", "🎰 Plinko")}
            {link("/profile", "My profile")}
            {link(`/u/${me.username}`, "Public page")}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {me.role !== "guest" && "coins" in me && <CoinPill initialCoins={(me as SelfUser).coins} />}
          <Link href="/profile" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-white/5">
            <Avatar src={me.avatarUrl} name={me.displayName} accent={me.accentColor} size={30} />
            <span className="hidden text-sm font-medium sm:inline" style={{ color: me.accentColor }}>
              {me.displayName}
            </span>
            <RoleBadge role={me.role} rank={me.rank} />
          </Link>
          {framed && (
            <a
              href={typeof window !== "undefined" ? window.location.href : "/chat"}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost hidden !px-3 !py-1.5 text-sm sm:inline-block"
              title="Open Better321 in a full browser tab"
            >
              Open in new tab ↗
            </a>
          )}
          <button onClick={logout} disabled={busy} className="btn-ghost !px-3 !py-1.5 text-sm">
            {busy ? "…" : "Log out"}
          </button>
        </div>
      </div>
    </header>
  );
}
