import type { CSSProperties } from "react";

/** Client- and server-safe helpers for custom chat styles. */

export type ColorStyle =
  | { type: "solid"; color: string }
  | { type: "gradient"; angle: number; colors: string[] };

export type UserStyle = {
  nameStyle: string | null;
  messageStyle: string | null;
  nameFont: string | null;
  messageItalic: boolean;
  nameGlow: boolean;
};

export const DEFAULT_NAME_COLOR = "#f4f4f5";
export const DEFAULT_MESSAGE_COLOR = "#ececee";

const HEX = /^#[0-9a-f]{6}$/i;

export function parseColorStyle(raw: string | null | undefined): ColorStyle | null {
  if (!raw) return null;
  if (raw.startsWith("solid:")) {
    const c = raw.slice(6);
    return HEX.test(c) ? { type: "solid", color: c.toLowerCase() } : null;
  }
  if (raw.startsWith("gradient:")) {
    const [, a, list] = raw.split(":");
    const angle = Number(a);
    const colors = (list ?? "").split(",");
    if (!Number.isFinite(angle) || colors.length < 2 || colors.length > 4 || !colors.every((c) => HEX.test(c))) return null;
    return { type: "gradient", angle: ((Math.round(angle) % 360) + 360) % 360, colors: colors.map((c) => c.toLowerCase()) };
  }
  return null;
}

export function serializeColorStyle(s: ColorStyle | null): string | null {
  if (!s) return null;
  return s.type === "solid" ? `solid:${s.color}` : `gradient:${s.angle}:${s.colors.join(",")}`;
}

/** Validates untrusted input and returns the canonical string (or null). */
export function sanitizeColorStyle(raw: unknown): string | null {
  return typeof raw === "string" ? serializeColorStyle(parseColorStyle(raw.trim())) : null;
}

export const NAME_FONTS = [
  { key: "default", label: "Default", family: "inherit", scale: 1 },
  { key: "script", label: "Script", family: "'Kaushan Script', cursive", scale: 1.15 },
  { key: "rounded", label: "Rounded", family: "'Fredoka', sans-serif", scale: 1.06 },
  { key: "marker", label: "Marker", family: "'Permanent Marker', cursive", scale: 1 },
  { key: "gothic", label: "Gothic", family: "'Pirata One', serif", scale: 1.2 },
  { key: "elegant", label: "Elegant", family: "'Playfair Display', serif", scale: 1.06 },
  { key: "pixel", label: "Pixel", family: "'Press Start 2P', monospace", scale: 0.62 },
  { key: "typewriter", label: "Typewriter", family: "'Special Elite', monospace", scale: 1.05 },
] as const;

export type FontKey = (typeof NAME_FONTS)[number]["key"];

export function sanitizeFont(raw: unknown): string | null {
  if (typeof raw !== "string" || raw === "default") return null;
  return NAME_FONTS.some((f) => f.key === raw) ? raw : null;
}

export function fontByKey(key: string | null | undefined) {
  return NAME_FONTS.find((f) => f.key === key) ?? NAME_FONTS[0];
}

export const GRADIENT_PRESETS: { name: string; colors: string[] }[] = [
  { name: "Better321", colors: ["#ffd36e", "#f97316"] },
  { name: "Sunset", colors: ["#ff9a3c", "#ff3d77"] },
  { name: "Candy", colors: ["#f472b6", "#c084fc"] },
  { name: "Ocean", colors: ["#38bdf8", "#6366f1"] },
  { name: "Mint", colors: ["#4ade80", "#2dd4bf"] },
  { name: "Fire", colors: ["#fde047", "#f97316", "#dc2626"] },
  { name: "Galaxy", colors: ["#a78bfa", "#ec4899", "#f59e0b"] },
  { name: "Rainbow", colors: ["#ff5f6d", "#ffc371", "#47e891", "#4facfe"] },
  { name: "Ice", colors: ["#e0f2fe", "#93c5fd"] },
  { name: "Toxic", colors: ["#d9f99d", "#22c55e"] },
  { name: "Rose gold", colors: ["#fecdd3", "#e11d48"] },
  { name: "Midnight", colors: ["#818cf8", "#22d3ee"] },
];

export const SOLID_SWATCHES = [
  "#f4f4f5", "#fb923c", "#f97316", "#fbbf24", "#facc15", "#a3e635", "#4ade80", "#2dd4bf",
  "#38bdf8", "#60a5fa", "#818cf8", "#a78bfa", "#e879f9", "#f472b6", "#fb7185", "#ef4444",
];

export function gradientCss(s: { angle: number; colors: string[] }): string {
  return `linear-gradient(${s.angle}deg, ${s.colors.join(", ")})`;
}

export function primaryColor(style: ColorStyle | null, fallback: string): string {
  if (!style) return fallback;
  return style.type === "solid" ? style.color : style.colors[0];
}

/** CSS for coloured text. Gradients are clipped to the glyphs and repeat per wrapped line. */
export function colorCss(style: ColorStyle | null, fallback: string): CSSProperties {
  if (!style) return { color: fallback };
  if (style.type === "solid") return { color: style.color };
  return {
    backgroundImage: gradientCss(style),
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    WebkitTextFillColor: "transparent",
    WebkitBoxDecorationBreak: "clone",
    boxDecorationBreak: "clone",
  };
}

export function nameCss(u: Partial<UserStyle>, fallback = DEFAULT_NAME_COLOR): CSSProperties {
  const style = parseColorStyle(u.nameStyle);
  const font = fontByKey(u.nameFont);
  const css: CSSProperties = { ...colorCss(style, fallback) };
  if (font.key !== "default") {
    css.fontFamily = font.family;
    css.fontSize = `${font.scale}em`;
    css.fontWeight = font.key === "pixel" || font.key === "gothic" ? 400 : undefined;
    css.lineHeight = 1.2;
  }
  if (u.nameGlow) {
    const c = primaryColor(style, fallback);
    css.filter = `drop-shadow(0 0 5px ${c}aa) drop-shadow(0 0 1px ${c})`;
  }
  return css;
}

export function messageCss(u: Partial<UserStyle>): CSSProperties {
  const css = colorCss(parseColorStyle(u.messageStyle), DEFAULT_MESSAGE_COLOR);
  if (u.messageItalic) css.fontStyle = "italic";
  return css;
}

export function hasCustomStyle(u: Partial<UserStyle>): boolean {
  return !!(u.nameStyle || u.messageStyle || u.nameFont || u.nameGlow || u.messageItalic);
}
