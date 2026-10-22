"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, getToken, hardNavigate, setToken } from "@/lib/client";

type Mode = "guest" | "login" | "register";

export function AuthPanel({ upgrade = false }: { upgrade?: boolean }) {
  const [mode, setMode] = useState<Mode>(upgrade ? "register" : "guest");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nickname, setNickname] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");

  // If the browser blocked our cookie but we still hold a valid token, go straight in.
  useEffect(() => {
    if (upgrade || !getToken()) return;
    apiFetch("/api/me")
      .then((res) => {
        if (res.ok) hardNavigate("/chat");
      })
      .catch(() => {});
  }, [upgrade]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const url = mode === "guest" ? "/api/auth/guest" : mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "guest"
          ? { nickname }
          : mode === "login"
            ? { username, password }
            : { username, password, displayName: displayName || username };
      const res = await apiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; token?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setToken(data.token);
      // Full navigation so the new session is picked up reliably.
      hardNavigate(upgrade ? "/profile" : "/chat");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const tabs: { key: Mode; label: string }[] = upgrade
    ? [{ key: "register", label: "Create account" }]
    : [
        { key: "guest", label: "Join as guest" },
        { key: "login", label: "Log in" },
        { key: "register", label: "Sign up" },
      ];

  return (
    <div className="glass rounded-3xl p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:p-8">
      {!upgrade && (
        <div className="mb-6 grid grid-cols-3 rounded-xl bg-white/5 p-1 text-sm">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setMode(t.key);
                setError(null);
              }}
              className={`rounded-lg px-3 py-2 font-medium transition ${
                mode === t.key ? "bg-white/10 text-white shadow" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        {mode === "guest" && (
          <>
            <div>
              <h2 className="text-2xl font-bold">Jump straight in</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Guests can chat and browse profiles. Pick a nickname or we&apos;ll give you one.
              </p>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-300">Nickname (optional)</span>
              <input
                className="input"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. NightOwl"
                maxLength={24}
                autoComplete="nickname"
              />
            </label>
          </>
        )}

        {mode === "login" && (
          <>
            <div>
              <h2 className="text-2xl font-bold">Welcome back</h2>
              <p className="mt-1 text-sm text-zinc-400">Log in to your account.</p>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-300">Username</span>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-300">Password</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
          </>
        )}

        {mode === "register" && (
          <>
            <div>
              <h2 className="text-2xl font-bold">{upgrade ? "Upgrade your guest account" : "Create your profile"}</h2>
              <p className="mt-1 text-sm text-zinc-400">
                {upgrade
                  ? "Keep your chat history and unlock avatar, banner, music and tags."
                  : "Members get a customisable profile with music, banner and tags."}
              </p>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-300">Username</span>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={20}
                pattern="[A-Za-z0-9_]{3,20}"
                placeholder="letters, numbers, underscores"
                autoComplete="username"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-300">Display name (optional)</span>
              <input
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={32}
                placeholder="How others see you"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-300">Password</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="at least 6 characters"
              />
            </label>
          </>
        )}

        {error && (
          <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy
            ? "One moment…"
            : mode === "guest"
              ? "Enter chat as guest →"
              : mode === "login"
                ? "Log in →"
                : upgrade
                  ? "Upgrade account →"
                  : "Create account →"}
        </button>
      </form>
    </div>
  );
}
