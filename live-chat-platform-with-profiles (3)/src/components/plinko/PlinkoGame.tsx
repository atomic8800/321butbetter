"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CoinIcon } from "@/components/economy";
import { apiFetch } from "@/lib/client";
import { coinStore, useCoins } from "@/lib/client";
import { CENTS, formatCoins } from "@/lib/economy";
import {
  FLOOD_OPTIONS,
  MAX_BET,
  MIN_BET,
  RISKS,
  ROW_OPTIONS,
  getMultipliers,
  maxMultiplier,
  type Risk,
} from "@/lib/economy";

// ---------------------------------------------------------------- types ----
type DropResult = { path: string; bin: number; multiplier: number; payout: number };
type Ball = {
  id: number;
  path: number[];
  bin: number;
  multiplier: number;
  payout: number;
  bet: number;
  start: number;
  seg: number; // last completed segment
  jitter: number;
  batch: number;
};
type Stats = { profit: number; wagered: number; wins: number; losses: number; balls: number; history: number[] };
type Geo = {
  w: number;
  h: number;
  cx: number;
  gap: number;
  pegR: number;
  ballR: number;
  pegY: (i: number) => number;
  binY: number;
  binH: number;
  binW: number;
};

const EMPTY_STATS: Stats = { profit: 0, wagered: 0, wins: 0, losses: 0, balls: 0, history: [0] };

// ------------------------------------------------------------- helpers ----
function geometry(w: number, h: number, rows: number): Geo {
  const padX = 14;
  const padTop = 16;
  const padBottom = 10;
  const gap = Math.min((w - 2 * padX) / (rows + 1), (h - padTop - padBottom) / (rows - 1 + 1.75));
  const contentH = (rows - 1 + 1.75) * gap;
  const offsetY = padTop + (h - padTop - padBottom - contentH) / 2;
  const pegY = (i: number) => offsetY + i * gap;
  const binY = pegY(rows - 1) + gap * 0.8;
  return {
    w,
    h,
    cx: w / 2,
    gap,
    pegR: Math.max(1.6, gap * 0.12),
    ballR: Math.max(3, gap * 0.25),
    pegY,
    binY,
    binH: gap * 0.9,
    binW: gap * 0.9,
  };
}

function binColor(k: number, rows: number, alpha = 1) {
  const d = Math.abs(k - rows / 2) / (rows / 2); // 0 centre → 1 edge
  const hue = 46 - 46 * Math.pow(d, 1.1);
  const light = 52 - d * 6;
  return `hsla(${hue}, 95%, ${light}%, ${alpha})`;
}

function fmtMult(m: number) {
  if (m >= 1000) return `${m / 1000}K`;
  return String(m);
}

function fmtSigned(cents: number) {
  const s = formatCoins(Math.abs(cents));
  return cents > 0 ? `+${s}` : cents < 0 ? `-${s}` : "0";
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Points the ball passes through: start → contact on each peg row → bin. */
function pointsFor(g: Geo, ball: Ball, rows: number) {
  const pts: { x: number; y: number }[] = [{ x: g.cx, y: g.pegY(0) - g.gap * 1.2 }];
  let rights = 0;
  for (let i = 0; i < rows; i++) {
    pts.push({ x: g.cx + (rights - i / 2) * g.gap, y: g.pegY(i) - g.pegR - g.ballR * 0.85 });
    rights += ball.path[i];
  }
  pts.push({ x: g.cx + (ball.bin - rows / 2) * g.gap, y: g.binY + g.binH * 0.25 });
  return pts;
}

// ---------------------------------------------------------------- sound ----
let audioCtx: AudioContext | null = null;
let lastTone = 0;
function tone(freq: number, dur = 0.09, vol = 0.05) {
  try {
    const now = performance.now();
    if (now - lastTone < 28) return;
    lastTone = now;
    audioCtx ??= new AudioContext();
    const o = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    o.type = "triangle";
    o.frequency.value = freq;
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.connect(gain).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  } catch {
    /* audio unavailable */
  }
}

// ------------------------------------------------------------ component ----
export function PlinkoGame() {
  const coins = useCoins();
  const [bet, setBet] = useState("10");
  const [risk, setRisk] = useState<Risk>("medium");
  const [rows, setRows] = useState<number>(16);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [run, setRun] = useState({ balls: 0, profit: 0, id: 0 });
  const [inFlight, setInFlight] = useState(0);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [lastHit, setLastHit] = useState<{ mult: number; payout: number; key: number } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const staticRef = useRef<HTMLCanvasElement | null>(null);
  const geoRef = useRef<Geo | null>(null);
  const dprRef = useRef(1);
  const ballsRef = useRef<Ball[]>([]);
  const pegGlowRef = useRef(new Map<string, number>());
  const binHitRef = useRef(new Map<number, number>());
  const cfgRef = useRef({ rows, risk });
  const dirtyRef = useRef(true);
  const mutedRef = useRef(false);
  const runIdRef = useRef(0);
  const batchLeftRef = useRef(new Map<number, number>());
  const ballIdRef = useRef(0);
  const landRef = useRef<(b: Ball) => void>(() => {});

  const locked = inFlight > 0 || pending > 0;

  // Restore settings
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("plinko:settings") ?? "{}") as { bet?: string; rows?: number; risk?: Risk };
      if (saved.bet) setBet(saved.bet);
      if (saved.rows && (ROW_OPTIONS as readonly number[]).includes(saved.rows)) setRows(saved.rows);
      if (saved.risk && RISKS.includes(saved.risk)) setRisk(saved.risk);
      const m = localStorage.getItem("plinko:muted") === "1";
      setMuted(m);
      mutedRef.current = m;
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("plinko:settings", JSON.stringify({ bet, rows, risk }));
    } catch {
      /* ignore */
    }
  }, [bet, rows, risk]);

  // ---------------------------------------------------------- drawing ----
  const buildStatic = useCallback(() => {
    const canvas = canvasRef.current;
    const g = geoRef.current;
    if (!canvas || !g) return;
    const dpr = dprRef.current;
    const off = staticRef.current ?? document.createElement("canvas");
    staticRef.current = off;
    off.width = canvas.width;
    off.height = canvas.height;
    const ctx = off.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, g.w, g.h);
    const { rows: R, risk: K } = cfgRef.current;

    // pegs
    for (let i = 0; i < R; i++) {
      for (let j = 0; j < i + 3; j++) {
        const x = g.cx + (j - (i + 2) / 2) * g.gap;
        const y = g.pegY(i);
        const grad = ctx.createRadialGradient(x - g.pegR * 0.35, y - g.pegR * 0.35, 0, x, y, g.pegR);
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.6, "#d9d9e0");
        grad.addColorStop(1, "#8a8a96");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, g.pegR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // bins
    const mults = getMultipliers(R, K);
    const font = Math.max(6, Math.min(g.binH * 0.42, g.binW * 0.34));
    ctx.font = `800 ${font}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let k = 0; k <= R; k++) {
      const x = g.cx + (k - R / 2) * g.gap - g.binW / 2;
      ctx.fillStyle = binColor(k, R);
      roundRect(ctx, x, g.binY, g.binW, g.binH, Math.min(4, g.binW * 0.18));
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(x, g.binY + g.binH - 2, g.binW, 2);
      ctx.fillStyle = "#1a0d05";
      ctx.fillText(fmtMult(mults[k]), x + g.binW / 2, g.binY + g.binH / 2 + 0.5);
    }
    dirtyRef.current = true;
  }, []);

  const resize = useCallback(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const w = wrap.clientWidth;
    const h = Math.round(Math.min(Math.max(w * 0.74, 300), 620));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    dprRef.current = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.height = `${h}px`;
    geoRef.current = geometry(w, h, cfgRef.current.rows);
    buildStatic();
  }, [buildStatic]);

  useEffect(() => {
    cfgRef.current = { rows, risk };
    resize();
  }, [rows, risk, resize]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => resize());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [resize]);

  // Animation loop
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const canvas = canvasRef.current;
      const g = geoRef.current;
      const stat = staticRef.current;
      if (!canvas || !g || !stat) return;
      const now = performance.now();
      const balls = ballsRef.current;
      const glows = pegGlowRef.current;
      const hits = binHitRef.current;
      if (!balls.length && !glows.size && !hits.size && !dirtyRef.current) return;
      dirtyRef.current = false;

      const ctx = canvas.getContext("2d")!;
      const dpr = dprRef.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(stat, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const R = cfgRef.current.rows;

      // peg glows
      for (const [key, t] of glows) {
        const age = now - t;
        if (age > 320) {
          glows.delete(key);
          continue;
        }
        const [i, j] = key.split(":").map(Number);
        const x = g.cx + (j - (i + 2) / 2) * g.gap;
        const y = g.pegY(i);
        const a = 1 - age / 320;
        ctx.fillStyle = `rgba(255, 190, 90, ${0.55 * a})`;
        ctx.beginPath();
        ctx.arc(x, y, g.pegR * (2.2 + a), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.arc(x, y, g.pegR * 1.1, 0, Math.PI * 2);
        ctx.fill();
      }

      // bin hit flashes
      for (const [k, t] of hits) {
        const age = now - t;
        if (age > 380) {
          hits.delete(k);
          continue;
        }
        const a = 1 - age / 380;
        const x = g.cx + (k - R / 2) * g.gap - g.binW / 2;
        const dy = Math.sin((age / 380) * Math.PI) * g.binH * 0.28;
        ctx.fillStyle = "#0e0a07";
        ctx.fillRect(x - 1, g.binY - 1, g.binW + 2, g.binH + 2);
        ctx.save();
        ctx.translate(0, dy);
        ctx.drawImage(
          stat,
          x * dpr,
          g.binY * dpr,
          g.binW * dpr,
          g.binH * dpr,
          x,
          g.binY,
          g.binW,
          g.binH,
        );
        ctx.fillStyle = `rgba(255,255,255,${0.45 * a})`;
        roundRect(ctx, x, g.binY, g.binW, g.binH, Math.min(4, g.binW * 0.18));
        ctx.fill();
        ctx.restore();
      }

      // balls
      const segDur = Math.min(170, Math.max(90, 2000 / (R + 1)));
      const done: Ball[] = [];
      for (const b of balls) {
        const elapsed = now - b.start;
        if (elapsed < 0) continue;
        const pts = pointsFor(g, b, R);
        const totalSegs = pts.length - 1;
        const s = Math.min(totalSegs - 1, Math.floor(elapsed / segDur));
        const u = Math.min(1, (elapsed - s * segDur) / segDur);

        // trigger peg glows / landing for completed segments
        while (b.seg < Math.min(s, totalSegs) && b.seg < totalSegs) {
          const reached = b.seg + 1; // point index reached
          if (reached >= 1 && reached <= R) {
            let rights = 0;
            for (let i = 0; i < reached - 1; i++) rights += b.path[i];
            glows.set(`${reached - 1}:${rights + 1}`, now);
          }
          b.seg++;
        }
        if (elapsed >= totalSegs * segDur) {
          done.push(b);
          continue;
        }
        const A = pts[s];
        const B = pts[s + 1];
        const hop = s === 0 ? 0 : g.gap * 0.32;
        const x = A.x + (B.x - A.x) * u + b.jitter * (s === 0 ? 0 : 1);
        const y = A.y + (B.y - A.y) * u * u - hop * 4 * u * (1 - u);
        const grad = ctx.createRadialGradient(x - g.ballR * 0.35, y - g.ballR * 0.4, 0, x, y, g.ballR);
        grad.addColorStop(0, "#fff1d6");
        grad.addColorStop(0.35, "#ff9a3c");
        grad.addColorStop(1, "#e2450f");
        ctx.fillStyle = grad;
        ctx.shadowColor = "rgba(255,120,40,0.55)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(x, y, g.ballR, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      if (done.length) {
        ballsRef.current = balls.filter((b) => !done.includes(b));
        for (const b of done) {
          hits.set(b.bin, now);
          landRef.current(b);
        }
        dirtyRef.current = true;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ---------------------------------------------------------- landing ----
  const onLand = (b: Ball) => {
    coinStore.add(b.payout);
    const net = b.payout - b.bet;
    setStats((s) => {
      const profit = s.profit + net;
      const history = [...s.history, profit];
      return {
        profit,
        wagered: s.wagered + b.bet,
        wins: s.wins + (net > 0 ? 1 : 0),
        losses: s.losses + (net < 0 ? 1 : 0),
        balls: s.balls + 1,
        history: history.length > 300 ? history.slice(history.length - 300) : history,
      };
    });
    if (b.batch === runIdRef.current) setRun((r) => ({ ...r, profit: r.profit + net }));
    setInFlight((n) => Math.max(0, n - 1));
    setLastHit({ mult: b.multiplier, payout: b.payout, key: b.id });
    const left = (batchLeftRef.current.get(b.batch) ?? 1) - 1;
    if (left <= 0) {
      batchLeftRef.current.delete(b.batch);
      coinStore.release();
    } else batchLeftRef.current.set(b.batch, left);
    if (!mutedRef.current) {
      const m = b.multiplier;
      tone(m >= 10 ? 1046 : m >= 2 ? 784 : m >= 1 ? 587 : 392, m >= 10 ? 0.25 : 0.09, m >= 10 ? 0.08 : 0.045);
    }
  };

  useEffect(() => {
    landRef.current = onLand;
  });

  // ---------------------------------------------------------- betting ----
  const betCoins = Number(bet);
  const betValid = Number.isFinite(betCoins) && betCoins >= MIN_BET && betCoins <= MAX_BET;

  const drop = useCallback(
    async (count: number) => {
      setError(null);
      const value = Number(bet);
      if (!Number.isFinite(value) || value < MIN_BET || value > MAX_BET) {
        setError(`Bet must be between ${MIN_BET} and ${MAX_BET.toLocaleString()} coins.`);
        return;
      }
      const betCents = Math.round(value * CENTS);
      const total = betCents * count;
      const bal = coinStore.get();
      if (bal != null && total > bal) {
        setError(count > 1 ? `Dropping ${count} balls costs ${formatCoins(total)} coins — not enough.` : "Not enough coins.");
        return;
      }
      if (!mutedRef.current) tone(660, 0.05, 0.03);

      coinStore.hold();
      coinStore.add(-total);
      setPending((n) => n + 1);
      try {
        const res = await apiFetch("/api/plinko", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bet: value, rows, risk, count }),
        });
        const data = (await res.json().catch(() => ({}))) as { results?: DropResult[]; balance?: number; error?: string };
        if (!res.ok || !data.results) {
          coinStore.add(total);
          coinStore.release();
          setError(data.error ?? "Bet failed.");
          return;
        }
        const batch = ++runIdRef.current;
        batchLeftRef.current.set(batch, data.results.length);
        setRun({ balls: data.results.length, profit: 0, id: batch });
        const now = performance.now();
        const stagger = count > 1 ? Math.min(60, 6000 / count) : 0;
        const g = geoRef.current;
        const newBalls: Ball[] = data.results.map((r, i) => ({
          id: ++ballIdRef.current,
          path: r.path.split("").map(Number),
          bin: r.bin,
          multiplier: r.multiplier,
          payout: r.payout,
          bet: betCents,
          start: now + i * stagger,
          seg: 0,
          jitter: g ? (Math.random() - 0.5) * g.gap * 0.08 : 0,
          batch,
        }));
        ballsRef.current = [...ballsRef.current, ...newBalls];
        setInFlight((n) => n + newBalls.length);
      } catch {
        coinStore.add(total);
        coinStore.release();
        setError("Network error.");
      } finally {
        setPending((n) => Math.max(0, n - 1));
      }
    },
    [bet, rows, risk],
  );

  // Space bar = bet
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.code === "Space" && tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA" && tag !== "BUTTON") {
        e.preventDefault();
        void drop(1);
      }
      if (e.key === "Escape") setShowHelp(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drop]);

  // Release any holds if we leave mid-drop.
  useEffect(
    () => () => {
      for (let i = 0; i < batchLeftRef.current.size; i++) coinStore.release();
    },
    [],
  );

  function adjustBet(f: number) {
    const v = Number(bet) || 0;
    let next = Math.round(v * f * 100) / 100;
    next = Math.max(MIN_BET, Math.min(MAX_BET, next));
    if (f > 1 && coins != null) next = Math.min(next, Math.max(MIN_BET, Math.floor(coins) / CENTS));
    setBet(String(next));
  }

  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    mutedRef.current = m;
    try {
      localStorage.setItem("plinko:muted", m ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  // ---------------------------------------------------------- render ----
  const top = maxMultiplier(rows, risk);
  const selectCls =
    "w-full cursor-pointer appearance-none bg-transparent text-xl font-bold text-zinc-100 outline-none disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="overflow-hidden rounded-3xl border border-amber-200/10 bg-[#100c09] shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <h1 className="font-serif text-2xl tracking-[0.3em] text-amber-200/90">PLINKO</h1>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-2 pr-3.5 text-lg font-bold tabular-nums">
            <CoinIcon size={22} /> {formatCoins(coins)}
          </span>
          <button onClick={toggleMute} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/10" title={muted ? "Unmute" : "Mute"}>
            {muted ? "🔇" : "🔊"}
          </button>
          <button onClick={() => setShowHelp(true)} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] font-bold hover:bg-white/10" title="How to play">
            ?
          </button>
          <Link href="/chat" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/10" title="Back to chat">
            ✕
          </Link>
        </div>
      </div>

      <div className="grid gap-4 px-4 pb-4 lg:grid-cols-[1fr_360px]">
        {/* Board */}
        <div className="relative">
          <div
            ref={wrapRef}
            className="relative overflow-hidden rounded-2xl border border-amber-300/25"
            style={{ background: "radial-gradient(ellipse at 50% 0%, #3a2c1d 0%, #1a130d 45%, #0e0a07 100%)" }}
          >
            <canvas ref={canvasRef} className="block w-full" />
            {lastHit && (
              <div
                key={lastHit.key}
                className={`animate-fade-up pointer-events-none absolute right-3 top-3 rounded-xl px-3 py-1.5 text-sm font-black tabular-nums shadow-lg ${
                  lastHit.mult >= 1 ? "bg-emerald-500/90 text-black" : "bg-black/60 text-zinc-300"
                }`}
              >
                {lastHit.mult}× · {formatCoins(lastHit.payout)}
              </div>
            )}
          </div>
          <p className="mt-2 text-center text-xs text-zinc-500">
            {rows} rows · {risk} · pays up to {fmtMult(top)}x{" "}
            <span className="ml-1 rounded border border-white/15 px-1.5 py-0.5 text-[10px]">⌨ Space = bet</span>
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Bet amount</p>
              <div className="mt-1 flex items-center gap-1.5">
                <input
                  className="w-full min-w-0 bg-transparent text-xl font-bold tabular-nums outline-none"
                  inputMode="decimal"
                  value={bet}
                  onChange={(e) => setBet(e.target.value.replace(/[^0-9.]/g, ""))}
                  aria-label="Bet amount"
                />
                <button onClick={() => adjustBet(0.5)} className="rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-bold hover:bg-white/10">
                  ½
                </button>
                <button onClick={() => adjustBet(2)} className="rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-bold hover:bg-white/10">
                  2×
                </button>
              </div>
            </div>
            <label className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Risk</p>
              <select className={`${selectCls} mt-1 capitalize`} value={risk} disabled={locked} onChange={(e) => setRisk(e.target.value as Risk)}>
                {RISKS.map((r) => (
                  <option key={r} value={r} className="bg-[#1c120b] capitalize">
                    {r[0].toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute bottom-4 right-3 text-xs text-zinc-400">▼</span>
            </label>
            <label className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Rows</p>
              <select className={`${selectCls} mt-1`} value={rows} disabled={locked} onChange={(e) => setRows(Number(e.target.value))}>
                {ROW_OPTIONS.map((r) => (
                  <option key={r} value={r} className="bg-[#1c120b]">
                    {r}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute bottom-4 right-3 text-xs text-zinc-400">▼</span>
            </label>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div>
                <p className="text-sm text-zinc-300">This run</p>
                <p className="text-xs text-zinc-500">
                  {run.balls} ball{run.balls === 1 ? "" : "s"}
                  {inFlight > 0 && ` · ${inFlight} falling`}
                </p>
              </div>
              <span className={`text-lg font-bold tabular-nums ${run.profit > 0 ? "text-emerald-400" : run.profit < 0 ? "text-rose-400" : "text-zinc-300"}`}>
                {fmtSigned(run.profit)}
              </span>
            </div>
          </div>

          {locked && <p className="-mt-1 text-center text-[11px] text-zinc-500">Risk &amp; rows unlock when all balls have landed.</p>}

          <button
            onClick={() => void drop(1)}
            disabled={!betValid}
            className="rounded-2xl py-4 text-lg font-black tracking-[0.25em] text-[#2a1d05] shadow-[0_8px_30px_rgba(212,167,72,0.25)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
            style={{ background: "linear-gradient(180deg, #f3dc8e 0%, #d8b25a 55%, #b8913d 100%)" }}
          >
            BET
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Flood</span>
            {FLOOD_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => void drop(n)}
                disabled={!betValid}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] py-2 text-sm font-bold hover:bg-white/10 disabled:opacity-50"
                title={betValid ? `Drop ${n} balls for ${formatCoins(Math.round(betCoins * CENTS) * n)} coins` : undefined}
              >
                {n}
              </button>
            ))}
          </div>

          {error && <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}

          {/* Live stats */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Live stats</p>
              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-zinc-400">{stats.balls} balls</span>
                <button
                  onClick={() => setStats(EMPTY_STATS)}
                  className="rounded-lg border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-300 hover:bg-white/10"
                >
                  Reset
                </button>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {[
                ["Profit", fmtSigned(stats.profit), stats.profit > 0 ? "text-emerald-400" : stats.profit < 0 ? "text-rose-400" : ""],
                ["Wagered", formatCoins(stats.wagered), ""],
                ["Wins", String(stats.wins), ""],
                ["Losses", String(stats.losses), ""],
              ].map(([label, value, cls]) => (
                <div key={label} className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</p>
                  <p className={`truncate text-sm font-bold tabular-nums ${cls}`}>{value}</p>
                </div>
              ))}
            </div>
            <Sparkline points={stats.history} />
          </div>
        </div>
      </div>

      {showHelp && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
          <div className="animate-fade-up max-w-md rounded-3xl border border-amber-200/15 bg-[#140d08] p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-black">How Plinko works</h2>
            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
              <li>🎯 Pick a bet, a <b>risk</b> level and how many <b>rows</b> of pegs (8–16), then press <b>BET</b>.</li>
              <li>⚪ The ball bounces left or right on every peg and lands in a slot — your bet is multiplied by that slot.</li>
              <li>🔥 <b>Higher risk</b> and <b>more rows</b> make the edge slots pay much more (up to 1000×) but the middle pays less.</li>
              <li>🌊 <b>Flood</b> drops 100 or 250 balls at once with the same bet each.</li>
              <li>🎲 Every bounce is decided on the server, so results are fair and can&apos;t be tampered with.</li>
              <li>🪙 Out of coins? You earn coins every minute you&apos;re online, plus a daily bonus from the coin menu.</li>
            </ul>
            <button onClick={() => setShowHelp(false)} className="btn-primary mt-5 w-full">
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const W = 300;
  const H = 56;
  const min = Math.min(0, ...points);
  const max = Math.max(0, ...points);
  const span = max - min || 1;
  const x = (i: number) => (points.length <= 1 ? 0 : (i / (points.length - 1)) * W);
  const y = (v: number) => H - 4 - ((v - min) / span) * (H - 8);
  const d = points.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = points[points.length - 1] ?? 0;
  const color = last >= 0 ? "#34d399" : "#fb7185";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-14 w-full" preserveAspectRatio="none">
      <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
      {points.length > 1 ? (
        <path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      ) : (
        <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}
