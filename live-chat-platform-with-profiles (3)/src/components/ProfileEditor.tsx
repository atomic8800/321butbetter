"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Avatar } from "@/components/ui";
import { ProfileTags } from "@/components/ui";
import {
  ACCENT_COLORS,
  COUNTRIES,
  CUSTOM_OPTION,
  GENDERS,
  LIMITS,
  PRONOUNS,
  RELATIONSHIP_STATUSES,
  SEXUALITIES,
} from "@/lib/constants";
import type { PublicUser } from "@/lib/types";
import { apiFetch } from "@/lib/client";
import { ChatStyleEditor } from "@/components/ChatStyleEditor";
import type { UserStyle } from "@/lib/style";

function pickMode(value: string | null, options: readonly string[]): { choice: string; custom: string } {
  if (!value) return { choice: "", custom: "" };
  if ((options as readonly string[]).includes(value)) return { choice: value, custom: "" };
  return { choice: CUSTOM_OPTION, custom: value };
}

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

export function ProfileEditor({ initial, onSaved }: { initial: PublicUser; onSaved?: (u: PublicUser) => void }) {
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio);
  const [age, setAge] = useState(initial.age ? String(initial.age) : "");
  const [accent, setAccent] = useState(initial.accentColor);
  const [chatStyle, setChatStyle] = useState<UserStyle>({
    nameStyle: initial.nameStyle,
    messageStyle: initial.messageStyle,
    nameFont: initial.nameFont,
    messageItalic: initial.messageItalic,
    nameGlow: initial.nameGlow,
  });
  const [country, setCountry] = useState(initial.country ?? "");

  const g0 = pickMode(initial.gender, GENDERS);
  const [genderChoice, setGenderChoice] = useState(g0.choice);
  const [genderCustom, setGenderCustom] = useState(g0.custom);
  const s0 = pickMode(initial.sexuality, SEXUALITIES);
  const [sexChoice, setSexChoice] = useState(s0.choice);
  const [sexCustom, setSexCustom] = useState(s0.custom);
  const r0 = pickMode(initial.relationship, RELATIONSHIP_STATUSES);
  const [relChoice, setRelChoice] = useState(r0.choice);
  const [relCustom, setRelCustom] = useState(r0.custom);
  const p0 = pickMode(initial.pronouns, PRONOUNS);
  const [proChoice, setProChoice] = useState(p0.choice);
  const [proCustom, setProCustom] = useState(p0.custom);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [removeBanner, setRemoveBanner] = useState(false);
  const [removeMusic, setRemoveMusic] = useState(false);
  const [musicTitle, setMusicTitle] = useState(initial.musicTitle ?? "");

  const avatarPreview = useObjectUrl(avatarFile);
  const bannerPreview = useObjectUrl(bannerFile);
  const musicPreview = useObjectUrl(musicFile);

  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);
  const musicInput = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const gender = genderChoice === CUSTOM_OPTION ? genderCustom : genderChoice;
  const sexuality = sexChoice === CUSTOM_OPTION ? sexCustom : sexChoice;
  const pronouns = proChoice === CUSTOM_OPTION ? proCustom : proChoice;
  const relationship = relChoice === CUSTOM_OPTION ? relCustom : relChoice;

  const shownAvatar = removeAvatar ? null : avatarPreview ?? initial.avatarUrl;
  const shownBanner = removeBanner ? null : bannerPreview ?? initial.bannerUrl;
  const shownMusic = removeMusic ? null : musicPreview ?? initial.musicUrl;

  const previewUser = useMemo(
    () => ({
      age: age ? Number(age) : null,
      gender: gender || null,
      pronouns: pronouns || null,
      country: country || null,
      sexuality: sexuality || null,
      relationship: relationship || null,
      role: "member" as const,
    }),
    [age, gender, pronouns, country, sexuality, relationship],
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    // Vercel caps each request at 4.5 MB, so each new file is uploaded in its own request.
    const uploads: { field: "avatar" | "banner" | "music"; file: File; limit: number; label: string }[] = [];
    if (avatarFile) uploads.push({ field: "avatar", file: avatarFile, limit: LIMITS.image, label: "Profile picture" });
    if (bannerFile) uploads.push({ field: "banner", file: bannerFile, limit: LIMITS.image, label: "Banner" });
    if (musicFile) uploads.push({ field: "music", file: musicFile, limit: LIMITS.music, label: "Song" });
    const tooBig = uploads.find((u) => u.file.size > u.limit);
    if (tooBig) {
      setError(`${tooBig.label} must be under ${tooBig.limit / 1024 / 1024}MB (this one is ${(tooBig.file.size / 1024 / 1024).toFixed(1)}MB).`);
      setBusy(false);
      return;
    }

    const baseForm = (first: boolean) => {
      const fd = new FormData();
      fd.set("displayName", displayName);
      fd.set("bio", bio);
      fd.set("age", age);
      fd.set("accentColor", accent);
      fd.set("country", country);
      fd.set("gender", gender);
      fd.set("sexuality", sexuality);
      fd.set("pronouns", pronouns);
      fd.set("relationship", relationship);
      fd.set("nameStyle", chatStyle.nameStyle ?? "");
      fd.set("messageStyle", chatStyle.messageStyle ?? "");
      fd.set("nameFont", chatStyle.nameFont ?? "");
      fd.set("messageItalic", chatStyle.messageItalic ? "1" : "0");
      fd.set("nameGlow", chatStyle.nameGlow ? "1" : "0");
      fd.set("musicTitle", musicTitle);
      if (first) {
        if (removeAvatar) fd.set("removeAvatar", "1");
        if (removeBanner) fd.set("removeBanner", "1");
        if (removeMusic) fd.set("removeMusic", "1");
      }
      return fd;
    };

    try {
      const steps = uploads.length ? uploads : [null];
      let latest: PublicUser | undefined;
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const fd = baseForm(i === 0);
        if (step) fd.set(step.field, step.file);
        const res = await apiFetch("/api/profile", { method: "POST", body: fd });
        const data = (await res.json().catch(() => ({}))) as { error?: string; user?: PublicUser };
        if (!res.ok) {
          setError(
            (step ? `${step.label}: ` : "") +
              (res.status === 413 ? "file is too large to upload." : data.error ?? "Could not save profile."),
          );
          if (data.user ?? latest) onSaved?.((data.user ?? latest)!);
          return;
        }
        latest = data.user;
        if (i === 0) {
          setRemoveAvatar(false);
          setRemoveBanner(false);
          setRemoveMusic(false);
        }
        if (step?.field === "avatar") setAvatarFile(null);
        if (step?.field === "banner") setBannerFile(null);
        if (step?.field === "music") setMusicFile(null);
      }
      setSaved(true);
      if (latest) onSaved?.(latest);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const fileLabel = (f: File | null) => (f ? `${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)` : null);

  return (
    <form onSubmit={submit} className="mt-4 grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {/* Visuals */}
        <section className="glass overflow-hidden rounded-3xl">
          <div
            className="relative h-44 w-full"
            style={{
              background: shownBanner
                ? `url(${shownBanner}) center/cover no-repeat`
                : `linear-gradient(135deg, ${accent}cc, ${accent}33 60%, #1c120b)`,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-[#140d08] via-transparent to-transparent" />
            <div className="absolute right-3 top-3 flex gap-2">
              <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => bannerInput.current?.click()}>
                🖼️ Change banner
              </button>
              {shownBanner && (
                <button
                  type="button"
                  className="btn-ghost !px-3 !py-1.5 text-xs"
                  onClick={() => {
                    setBannerFile(null);
                    setRemoveBanner(true);
                  }}
                >
                  Remove
                </button>
              )}
            </div>
            <input
              ref={bannerInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                setBannerFile(e.target.files?.[0] ?? null);
                setRemoveBanner(false);
              }}
            />
          </div>
          <div className="px-5 pb-5">
            <div className="-mt-12 flex items-end gap-4">
              <button
                type="button"
                onClick={() => avatarInput.current?.click()}
                className="group relative rounded-full border-4 border-[#140d08] bg-[#140d08]"
                title="Change profile picture"
              >
                <Avatar src={shownAvatar} name={displayName || "?"} accent={accent} size={96} />
                <span className="absolute inset-1 grid place-items-center rounded-full bg-black/50 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
                  Change
                </span>
              </button>
              <input
                ref={avatarInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  setAvatarFile(e.target.files?.[0] ?? null);
                  setRemoveAvatar(false);
                }}
              />
              <div className="mb-2 flex flex-wrap gap-2 text-xs text-zinc-400">
                {fileLabel(avatarFile) && <span className="rounded-full bg-white/5 px-2 py-1">New pfp: {fileLabel(avatarFile)}</span>}
                {fileLabel(bannerFile) && <span className="rounded-full bg-white/5 px-2 py-1">New banner: {fileLabel(bannerFile)}</span>}
                {shownAvatar && (
                  <button
                    type="button"
                    className="rounded-full bg-white/5 px-2 py-1 hover:bg-white/10"
                    onClick={() => {
                      setAvatarFile(null);
                      setRemoveAvatar(true);
                    }}
                  >
                    Remove pfp
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-zinc-300">Display name</span>
                <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={32} required />
              </label>
              <div className="text-sm">
                <span className="mb-1 block text-zinc-300">Profile accent colour</span>
                <div className="flex flex-wrap items-center gap-2">
                  {ACCENT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAccent(c)}
                      className={`h-7 w-7 rounded-full transition ${accent === c ? "ring-2 ring-white ring-offset-2 ring-offset-[#140d08]" : "hover:scale-110"}`}
                      style={{ background: c }}
                      aria-label={`Accent ${c}`}
                    />
                  ))}
                  <input
                    type="color"
                    value={accent}
                    onChange={(e) => setAccent(e.target.value)}
                    className="h-7 w-9 cursor-pointer rounded border border-white/10 bg-transparent"
                    aria-label="Custom accent colour"
                  />
                </div>
              </div>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 flex justify-between text-zinc-300">
                  <span>Bio</span>
                  <span className="text-zinc-500">
                    {bio.length}/{LIMITS.bio}
                  </span>
                </span>
                <textarea
                  className="input min-h-[80px] resize-y"
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, LIMITS.bio))}
                  placeholder="Tell people a little about you…"
                />
              </label>
            </div>
          </div>
        </section>

        {/* Tags */}
        <section className="glass rounded-3xl p-5">
          <h2 className="text-lg font-bold">Profile tags</h2>
          <p className="mt-1 text-sm text-zinc-400">
            All optional. Share only what you want — every option includes a custom choice.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-300">🎂 Age</span>
              <input
                className="input"
                type="number"
                min={13}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="—"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-300">🌍 Country</span>
              <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="">— Not set —</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <ChoiceField
              label="✨ Gender"
              options={GENDERS}
              choice={genderChoice}
              custom={genderCustom}
              onChoice={setGenderChoice}
              onCustom={setGenderCustom}
              placeholder="Describe your gender"
            />
            <ChoiceField
              label="💬 Pronouns"
              options={PRONOUNS}
              choice={proChoice}
              custom={proCustom}
              onChoice={setProChoice}
              onCustom={setProCustom}
              placeholder="e.g. xe/xem"
            />
            <ChoiceField
              label="🏳️‍🌈 Sexuality"
              options={SEXUALITIES}
              choice={sexChoice}
              custom={sexCustom}
              onChoice={setSexChoice}
              onCustom={setSexCustom}
              placeholder="Describe your sexuality"
            />
            <ChoiceField
              label="💞 Relationship status"
              options={RELATIONSHIP_STATUSES}
              choice={relChoice}
              custom={relCustom}
              onChoice={setRelChoice}
              onCustom={setRelCustom}
              placeholder="Describe your relationship status"
            />
          </div>
        </section>

        {/* Music */}
        <ChatStyleEditor
          value={chatStyle}
          onChange={setChatStyle}
          preview={{
            id: initial.id,
            username: initial.username,
            displayName,
            avatarUrl: shownAvatar,
            accentColor: accent,
            rank: initial.rank,
          }}
        />

        <section className="glass rounded-3xl p-5">
          <h2 className="text-lg font-bold">Profile music</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Upload a song (MP3, OGG, WAV… up to {LIMITS.music / 1024 / 1024}MB). It plays on your profile page.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-ghost text-sm" onClick={() => musicInput.current?.click()}>
              🎵 {shownMusic ? "Replace song" : "Upload song"}
            </button>
            <input
              ref={musicInput}
              type="file"
              accept="audio/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setMusicFile(f);
                setRemoveMusic(false);
                if (f && !musicTitle) setMusicTitle(f.name.replace(/\.[^.]+$/, ""));
              }}
            />
            {shownMusic && (
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={() => {
                  setMusicFile(null);
                  setRemoveMusic(true);
                  setMusicTitle("");
                }}
              >
                Remove song
              </button>
            )}
            {fileLabel(musicFile) && <span className="text-xs text-zinc-400">{fileLabel(musicFile)}</span>}
          </div>
          {shownMusic && (
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-zinc-300">Track title</span>
                <input className="input" value={musicTitle} onChange={(e) => setMusicTitle(e.target.value)} maxLength={80} placeholder="Song name" />
              </label>
              <audio controls src={shownMusic} className="w-full" preload="metadata" />
            </div>
          )}
        </section>

        {error && (
          <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Saving…" : "Save profile"}
          </button>
          {saved && <span className="text-sm text-emerald-300">Saved ✓</span>}
        </div>
      </div>

      {/* Live preview */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="glass overflow-hidden rounded-3xl">
          <div
            className="h-24 w-full"
            style={{
              background: shownBanner
                ? `url(${shownBanner}) center/cover no-repeat`
                : `linear-gradient(135deg, ${accent}cc, ${accent}33 60%, #1c120b)`,
            }}
          />
          <div className="px-4 pb-4">
            <div className="-mt-8 rounded-full border-4 border-[#140d08] bg-[#140d08]" style={{ width: 72 }}>
              <Avatar src={shownAvatar} name={displayName || "?"} accent={accent} size={64} />
            </div>
            <p className="mt-2 text-lg font-black" style={{ color: accent }}>
              {displayName || "Your name"}
            </p>
            <p className="text-xs text-zinc-500">@{initial.username}</p>
            {bio && <p className="mt-2 text-sm text-zinc-300">{bio}</p>}
            <div className="mt-3">
              <ProfileTags user={previewUser} />
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              {shownMusic ? `🎵 ${musicTitle || "Untitled track"}` : "No profile music"}
            </p>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-zinc-500">Live preview · this is how others see you</p>
      </aside>
    </form>
  );
}

function ChoiceField({
  label,
  options,
  choice,
  custom,
  onChoice,
  onCustom,
  placeholder,
}: {
  label: string;
  options: readonly string[];
  choice: string;
  custom: string;
  onChoice: (v: string) => void;
  onCustom: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="text-sm">
      <span className="mb-1 block text-zinc-300">{label}</span>
      <select className="input" value={choice} onChange={(e) => onChoice(e.target.value)}>
        <option value="">— Not set —</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value={CUSTOM_OPTION}>{CUSTOM_OPTION}</option>
      </select>
      {choice === CUSTOM_OPTION && (
        <input
          className="input mt-2"
          value={custom}
          onChange={(e) => onCustom(e.target.value)}
          placeholder={placeholder}
          maxLength={40}
        />
      )}
    </div>
  );
}
