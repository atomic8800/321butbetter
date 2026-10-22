"use client";

import { useEffect, useSyncExternalStore } from "react";

// ===================================================================== client

export const TOKEN_KEY = "pulse_token";
export const SESSION_HEADER = "x-session-token";

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null | undefined): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable */
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** fetch() that always includes the session (cookie + header fallback). */
export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const h = new Headers(init.headers);
  const t = getToken();
  if (t) h.set(SESSION_HEADER, t);
  return fetch(input, { ...init, headers: h, credentials: "include", cache: "no-store" });
}

/** Append the token to a URL (for EventSource, which cannot send custom headers). */
export function withToken(url: string): string {
  const t = getToken();
  if (!t) return url;
  return `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(t)}`;
}

export function hardNavigate(path: string): void {
  window.location.assign(path);
}

// ===================================================================== coinStore

export type Wallet = {
  coins: number;
  nextIncomeAt: string;
  dailyAvailableAt: string;
  incomePerMinute: number;
  dailyBonus: number;
};

let balance: number | null = null;
let wallet: Wallet | null = null;
let holds = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/**
 * Tiny global store for the coin balance so the nav pill, gift modal and Plinko stay in sync.
 * Plinko "holds" the store while balls are falling so wins appear when they land.
 */
export const coinStore = {
  get: () => balance,
  getWallet: () => wallet,
  set(v: number | null) {
    if (v === balance) return;
    balance = v;
    emit();
  },
  add(delta: number) {
    if (balance == null) return;
    balance += delta;
    emit();
  },
  setWallet(w: Wallet | null, force = false) {
    wallet = w;
    if (w && (holds === 0 || force)) balance = w.coins;
    emit();
  },
  hold() {
    holds++;
  },
  release() {
    holds = Math.max(0, holds - 1);
  },
  isHeld: () => holds > 0,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useCoins(): number | null {
  return useSyncExternalStore(coinStore.subscribe, coinStore.get, () => null);
}

export function useWallet(): Wallet | null {
  return useSyncExternalStore(coinStore.subscribe, coinStore.getWallet, () => null);
}

export async function refreshWallet(force = false): Promise<Wallet | null> {
  try {
    const res = await apiFetch("/api/coins");
    if (!res.ok) return null;
    const data = (await res.json()) as { wallet: Wallet | null };
    if (data.wallet) coinStore.setWallet(data.wallet, force);
    return data.wallet;
  } catch {
    return null;
  }
}

let pollers = 0;
let timer: ReturnType<typeof setInterval> | null = null;

/** Polls the wallet (and grants passive income) while mounted. Safe to use from multiple components. */
export function useWalletPolling(enabled: boolean, initialCoins?: number) {
  useEffect(() => {
    if (!enabled) return;
    if (balance == null && initialCoins != null) coinStore.set(initialCoins);
    pollers++;
    if (pollers === 1) {
      void refreshWallet();
      timer = setInterval(() => void refreshWallet(), 15_000);
    }
    return () => {
      pollers--;
      if (pollers === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, [enabled, initialCoins]);
}
