"use client";

import Link from "next/link";
import { StyledName } from "@/components/chat/StyledText";
import { useState, type ReactNode } from "react";
import { GiftsTab, useGifts, type GiftData } from "@/components/economy";
import { Avatar } from "@/components/ui";
import { MusicPlayer } from "@/components/ui";
import { ProfileTags, RoleBadge } from "@/components/ui";
import type { PublicUser } from "@/lib/types";

type Props = {
  user: PublicUser;
  online?: boolean;
  isMe?: boolean;
  autoPlayMusic?: boolean;
  compactMusic?: boolean;
  large?: boolean;
  actions?: ReactNode;
};

export function ProfileCard({ user, online = false, isMe = false, autoPlayMusic = false, compactMusic = false, large = false, actions }: Props) {
  const joined = new Date(user.createdAt).toLocaleDateString([], { month: "short", year: "numeric" });
  const avatarSize = large ? 128 : 88;
  const [tab, setTab] = useState<"about" | "gifts">("about");
  const canHaveGifts = user.role !== "guest";
  const giftData = useGifts(user.username, user.id, canHaveGifts);

  return (
    <article className="overflow-hidden">
      {/* Banner */}
      <div
        className={`relative w-full ${large ? "h-56 sm:h-72" : "h-36"}`}
        style={{
          background: user.bannerUrl
            ? `url(${user.bannerUrl}) center/cover no-repeat`
            : `linear-gradient(135deg, ${user.accentColor}cc, ${user.accentColor}33 60%, #1c120b)`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-[#140d08] via-transparent to-transparent" />
      </div>

      <div className={`${large ? "px-6 sm:px-10" : "px-5"}`}>
        <div className="flex items-end justify-between gap-3" style={{ marginTop: -avatarSize / 2 }}>
          <div className="rounded-full border-4 border-[#140d08] bg-[#140d08]">
            <Avatar src={user.avatarUrl} name={user.displayName} accent={user.accentColor} size={avatarSize} online={online} />
          </div>
          <div className="mb-2 flex flex-wrap justify-end gap-2">
            {actions}
            {isMe && (
              <Link href="/profile" className="btn-ghost !px-3 !py-1.5 text-xs">
                Edit profile
              </Link>
            )}
            {!large && (
              <Link href={`/u/${user.username}`} className="btn-ghost !px-3 !py-1.5 text-xs">
                Full page ↗
              </Link>
            )}
          </div>
        </div>

        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={`${large ? "text-3xl" : "text-xl"} max-w-full font-black tracking-tight`}>
              <StyledName user={user} fallback={user.accentColor} className="py-0.5" />
            </h2>
            <RoleBadge role={user.role} rank={user.rank} />
            {online && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
                <span className="online-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" /> online
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500">@{user.username} · joined {joined}</p>
        </div>


        {canHaveGifts && <ProfileTabs data={giftData} isMe={isMe} tab={tab} setTab={setTab} />}

        {tab === "gifts" && canHaveGifts ? (
          <div className="mt-4">
            <GiftsTab data={giftData} isMe={isMe} />
          </div>
        ) : (
          <>
          {user.bio && <p className={`mt-4 whitespace-pre-wrap text-zinc-200 ${large ? "text-base" : "text-sm"}`}>{user.bio}</p>}

          <div className="mt-4">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Tags</h3>
            {user.role === "guest" ? (
              <p className="text-sm text-zinc-500">Guests don&apos;t have profile tags yet.</p>
            ) : (
              <ProfileTags user={user} />
            )}
          </div>

          <div className="mt-5 pb-6">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Profile music</h3>
            {user.musicUrl ? (
              <MusicPlayer
                src={user.musicUrl}
                title={user.musicTitle || "Untitled track"}
                accent={user.accentColor}
                autoPlay={autoPlayMusic}
                compact={compactMusic}
              />
            ) : (
              <p className="text-sm text-zinc-500">
                {isMe ? (
                  <>
                    No song yet —{" "}
                    <Link href="/profile" className="text-orange-300 hover:underline">
                      upload one
                    </Link>
                    .
                  </>
                ) : (
                  "No song set."
                )}
              </p>
            )}
          </div>
          </>
        )}
      </div>
    </article>
  );
}

function ProfileTabs({
  data,
  isMe,
  tab,
  setTab,
}: {
  data: GiftData | null;
  isMe: boolean;
  tab: "about" | "gifts";
  setTab: (t: "about" | "gifts") => void;
}) {
  return (
    <div className="mt-4 flex gap-1 rounded-xl bg-white/5 p-1 text-sm">
      {(["about", "gifts"] as const).map((t) => (
        <button
          key={t}
          onClick={() => setTab(t)}
          className={`flex-1 rounded-lg px-3 py-1.5 font-medium transition ${
            tab === t ? "bg-orange-500/20 text-orange-100 shadow" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {t === "about" ? "👤 About" : `🎁 Gifts${data ? ` (${data.total})` : ""}`}
          {t === "gifts" && isMe && data && data.total > 0 && tab !== "gifts" && (
            <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-orange-400 align-middle" />
          )}
        </button>
      ))}
    </div>
  );
}
