"use client";

import { Avatar } from "@/components/ui";
import { MessageText, RankIcon, StyledName } from "@/components/chat/StyledText";
import { buildMentionMatcher } from "@/lib/format";
import type { Rank } from "@/lib/moderation";
import {
  DEFAULT_MESSAGE_COLOR,
  DEFAULT_NAME_COLOR,
  GRADIENT_PRESETS,
  NAME_FONTS,
  SOLID_SWATCHES,
  gradientCss,
  parseColorStyle,
  serializeColorStyle,
  type ColorStyle,
  type UserStyle,
} from "@/lib/style";

type Props = {
  value: UserStyle;
  onChange: (v: UserStyle) => void;
  preview: { id: number; username: string; displayName: string; avatarUrl: string | null; accentColor: string; rank: Rank };
};

export function ChatStyleEditor({ value, onChange, preview }: Props) {
  const set = (patch: Partial<UserStyle>) => onChange({ ...value, ...patch });
  const sampleMatcher = buildMentionMatcher([{ id: -1, username: "better321", displayName: "Better321" }]);
  const previewUser = { ...preview, ...value };

  return (
    <section className="glass rounded-3xl p-5">
      <h2 className="text-lg font-bold">Chat style</h2>
      <p className="mt-1 text-sm text-zinc-400">Make your name and messages stand out with colours, gradients and fonts.</p>

      {/* Live preview */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#161616]">
        <p className="border-b border-white/[0.06] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Live preview
        </p>
        <div className="flex gap-3 px-4 py-2.5">
          <span className="shrink-0 self-start rounded-full bg-zinc-300/80 p-[2px]">
            <Avatar src={preview.avatarUrl} name={preview.displayName || "?"} accent={preview.accentColor} size={42} />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex min-w-0 items-center gap-1.5 text-[14px] font-bold leading-tight">
              <RankIcon rank={preview.rank} user={value} size={13} />
              <StyledName user={{ ...previewUser, displayName: preview.displayName || "Your name" }} />
            </div>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
              <MessageText
                content="hey Better321 this is how my messages look now 🔥✨"
                style={value}
                matcher={sampleMatcher}
                meId={preview.id}
              />
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ColorStylePicker
          label="Username colour"
          value={value.nameStyle}
          defaultColor={DEFAULT_NAME_COLOR}
          onChange={(nameStyle) => set({ nameStyle })}
        />
        <ColorStylePicker
          label="Message colour"
          value={value.messageStyle}
          defaultColor={DEFAULT_MESSAGE_COLOR}
          onChange={(messageStyle) => set({ messageStyle })}
        />
      </div>

      <div className="mt-5">
        <p className="mb-2 text-sm text-zinc-300">Username font</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {NAME_FONTS.map((f) => {
            const selected = (value.nameFont ?? "default") === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => set({ nameFont: f.key === "default" ? null : f.key })}
                className={`truncate rounded-xl border px-3 py-2.5 text-center transition ${
                  selected ? "border-orange-400/70 bg-orange-500/15" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
                }`}
              >
                <span
                  className="block truncate font-bold text-zinc-100"
                  style={f.key === "default" ? undefined : { fontFamily: f.family, fontSize: `${f.scale}em`, fontWeight: 400 }}
                >
                  {preview.displayName || f.label}
                </span>
                <span className="mt-0.5 block text-[10px] uppercase tracking-wider text-zinc-500">{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Toggle checked={value.nameGlow} onChange={(nameGlow) => set({ nameGlow })} label="✨ Glowing username" />
        <Toggle checked={value.messageItalic} onChange={(messageItalic) => set({ messageItalic })} label="𝘐 Italic messages" />
        <button
          type="button"
          onClick={() => onChange({ nameStyle: null, messageStyle: null, nameFont: null, messageItalic: false, nameGlow: false })}
          className="btn-ghost !px-3 !py-1.5 text-xs"
        >
          Reset to default
        </button>
      </div>
    </section>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm transition ${
        checked ? "border-orange-400/60 bg-orange-500/15 text-orange-100" : "border-white/10 bg-white/[0.03] text-zinc-300"
      }`}
    >
      <span className={`relative h-4 w-7 rounded-full transition ${checked ? "bg-orange-500" : "bg-zinc-600"}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${checked ? "left-3.5" : "left-0.5"}`} />
      </span>
      {label}
    </button>
  );
}

function ColorStylePicker({
  label,
  value,
  defaultColor,
  onChange,
}: {
  label: string;
  value: string | null;
  defaultColor: string;
  onChange: (v: string | null) => void;
}) {
  const parsed = parseColorStyle(value);
  const mode = parsed?.type ?? "default";
  const emit = (s: ColorStyle | null) => onChange(serializeColorStyle(s));

  const solidColor = parsed?.type === "solid" ? parsed.color : parsed?.type === "gradient" ? parsed.colors[0] : "#fb923c";
  const grad = parsed?.type === "gradient" ? parsed : { type: "gradient" as const, angle: 90, colors: [...GRADIENT_PRESETS[0].colors] };

  const tabs: { key: "default" | "solid" | "gradient"; label: string }[] = [
    { key: "default", label: "Default" },
    { key: "solid", label: "Solid" },
    { key: "gradient", label: "Gradient" },
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-200">{label}</p>
        <span
          className="h-5 w-16 rounded-full border border-white/15"
          style={{
            background: parsed ? (parsed.type === "solid" ? parsed.color : gradientCss(parsed)) : defaultColor,
          }}
        />
      </div>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-black/25 p-1 text-xs">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() =>
              t.key === "default"
                ? emit(null)
                : t.key === "solid"
                  ? emit({ type: "solid", color: solidColor })
                  : emit({ type: "gradient", angle: grad.angle, colors: grad.colors })
            }
            className={`rounded-md px-2 py-1.5 font-medium transition ${
              mode === t.key ? "bg-orange-500/25 text-orange-100" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === "default" && <p className="mt-3 text-xs text-zinc-500">Uses the standard chat colour.</p>}

      {mode === "solid" && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-1.5">
            {SOLID_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => emit({ type: "solid", color: c })}
                className={`h-6 w-6 rounded-full transition ${solidColor === c ? "ring-2 ring-white ring-offset-2 ring-offset-[#1a110a]" : "hover:scale-110"}`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
            Custom
            <input
              type="color"
              value={solidColor}
              onChange={(e) => emit({ type: "solid", color: e.target.value })}
              className="h-7 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
            />
            <span className="font-mono">{solidColor}</span>
          </label>
        </div>
      )}

      {mode === "gradient" && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-4 gap-1.5">
            {GRADIENT_PRESETS.map((p) => {
              const selected = p.colors.join() === grad.colors.join();
              return (
                <button
                  key={p.name}
                  type="button"
                  title={p.name}
                  onClick={() => emit({ type: "gradient", angle: grad.angle, colors: [...p.colors] })}
                  className={`h-7 rounded-lg transition ${selected ? "ring-2 ring-white ring-offset-2 ring-offset-[#1a110a]" : "hover:scale-105"}`}
                  style={{ background: gradientCss({ angle: 90, colors: p.colors }) }}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {grad.colors.map((c, i) => (
              <span key={i} className="relative">
                <input
                  type="color"
                  value={c}
                  onChange={(e) => {
                    const colors = [...grad.colors];
                    colors[i] = e.target.value;
                    emit({ ...grad, colors });
                  }}
                  className="h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
                  aria-label={`Gradient colour ${i + 1}`}
                />
                {grad.colors.length > 2 && (
                  <button
                    type="button"
                    onClick={() => emit({ ...grad, colors: grad.colors.filter((_, j) => j !== i) })}
                    className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-zinc-700 text-[9px] text-white"
                    aria-label="Remove colour"
                  >
                    ✕
                  </button>
                )}
              </span>
            ))}
            {grad.colors.length < 4 && (
              <button
                type="button"
                onClick={() => emit({ ...grad, colors: [...grad.colors, grad.colors[grad.colors.length - 1]] })}
                className="btn-ghost !px-2.5 !py-1 text-xs"
              >
                + colour
              </button>
            )}
          </div>
          <label className="flex items-center gap-3 text-xs text-zinc-400">
            Angle
            <input
              type="range"
              min={0}
              max={360}
              step={15}
              value={grad.angle}
              onChange={(e) => emit({ ...grad, angle: Number(e.target.value) })}
              className="flex-1 accent-orange-500"
            />
            <span className="w-9 text-right font-mono">{grad.angle}°</span>
          </label>
        </div>
      )}
    </div>
  );
}
