import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { files, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { COUNTRIES, LIMITS } from "@/lib/constants";
import { toPublicUser } from "@/lib/types";
import { sanitizeColorStyle, sanitizeFont } from "@/lib/style";

export const dynamic = "force-dynamic";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function str(form: FormData, key: string, max: number): string | null {
  const v = form.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s+/g, " ").slice(0, max);
  return t.length ? t : null;
}

async function storeFile(
  form: FormData,
  key: string,
  ownerId: number,
  kind: "avatar" | "banner" | "music",
): Promise<{ id: string; name: string } | null | "invalid"> {
  const f = form.get(key);
  if (!(f instanceof File) || f.size === 0) return null;
  const isMusic = kind === "music";
  const limit = isMusic ? LIMITS.music : LIMITS.image;
  if (f.size > limit) return "invalid";
  const mime = f.type || "";
  if (isMusic ? !mime.startsWith("audio/") : !mime.startsWith("image/")) return "invalid";
  const data = Buffer.from(await f.arrayBuffer());
  const [row] = await db
    .insert(files)
    .values({ ownerId, kind, mime, size: f.size, name: f.name.slice(0, 120), data })
    .returning({ id: files.id });
  return { id: row.id, name: f.name };
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "guest") {
    return Response.json({ error: "Guests can't customise a profile. Create a free account to unlock it." }, { status: 403 });
  }

  const form = await req.formData();

  const displayName = str(form, "displayName", 32) ?? user.displayName;
  const bio = str(form, "bio", LIMITS.bio) ?? "";
  const pronouns = str(form, "pronouns", 32);
  const gender = str(form, "gender", 40);
  const sexuality = str(form, "sexuality", 40);
  const relationship = str(form, "relationship", 40);
  const nameStyle = sanitizeColorStyle(form.get("nameStyle"));
  const messageStyle = sanitizeColorStyle(form.get("messageStyle"));
  const nameFont = sanitizeFont(form.get("nameFont"));
  const messageItalic = form.get("messageItalic") === "1";
  const nameGlow = form.get("nameGlow") === "1";
  const countryRaw = str(form, "country", 60);
  const country = countryRaw && COUNTRIES.includes(countryRaw) ? countryRaw : null;
  const musicTitleInput = str(form, "musicTitle", 80);
  const accentRaw = str(form, "accentColor", 7);
  const accentColor = accentRaw && HEX_RE.test(accentRaw) ? accentRaw : user.accentColor;

  let age: number | null = null;
  const ageRaw = str(form, "age", 3);
  if (ageRaw) {
    const n = parseInt(ageRaw, 10);
    if (Number.isNaN(n) || n < 13 || n > 120) {
      return Response.json({ error: "Age must be between 13 and 120." }, { status: 400 });
    }
    age = n;
  }

  const [avatar, banner, music] = await Promise.all([
    storeFile(form, "avatar", user.id, "avatar"),
    storeFile(form, "banner", user.id, "banner"),
    storeFile(form, "music", user.id, "music"),
  ]);
  if (avatar === "invalid" || banner === "invalid") {
    return Response.json({ error: `Images must be image files under ${LIMITS.image / 1024 / 1024}MB.` }, { status: 400 });
  }
  if (music === "invalid") {
    return Response.json({ error: `Music must be an audio file under ${LIMITS.music / 1024 / 1024}MB.` }, { status: 400 });
  }

  const removeAvatar = form.get("removeAvatar") === "1";
  const removeBanner = form.get("removeBanner") === "1";
  const removeMusic = form.get("removeMusic") === "1";

  const toDelete: string[] = [];
  let avatarFileId = user.avatarFileId;
  let bannerFileId = user.bannerFileId;
  let musicFileId = user.musicFileId;
  let musicTitle = user.musicTitle;

  if (avatar || removeAvatar) {
    if (user.avatarFileId) toDelete.push(user.avatarFileId);
    avatarFileId = avatar ? avatar.id : null;
  }
  if (banner || removeBanner) {
    if (user.bannerFileId) toDelete.push(user.bannerFileId);
    bannerFileId = banner ? banner.id : null;
  }
  if (music || removeMusic) {
    if (user.musicFileId) toDelete.push(user.musicFileId);
    musicFileId = music ? music.id : null;
    musicTitle = music ? musicTitleInput ?? music.name.replace(/\.[^.]+$/, "") : null;
  } else if (musicFileId) {
    musicTitle = musicTitleInput ?? musicTitle;
  }

  const [updated] = await db
    .update(users)
    .set({
      displayName,
      bio,
      age,
      gender,
      pronouns,
      country,
      sexuality,
      relationship,
      accentColor,
      nameStyle,
      messageStyle,
      nameFont,
      messageItalic,
      nameGlow,
      avatarFileId,
      bannerFileId,
      musicFileId,
      musicTitle,
    })
    .where(eq(users.id, user.id))
    .returning();

  if (toDelete.length) await db.delete(files).where(inArray(files.id, toDelete));

  return Response.json({ user: toPublicUser(updated) });
}
