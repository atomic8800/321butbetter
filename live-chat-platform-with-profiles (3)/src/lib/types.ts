import type { User } from "@/db/schema";
import { isActive, rankOf, type Rank } from "@/lib/moderation";
import type { UserStyle } from "@/lib/style";

export type PublicUser = UserStyle & {
  id: number;
  username: string;
  displayName: string;
  role: "guest" | "member";
  rank: Rank;
  mutedUntil: string | null;
  bio: string;
  age: number | null;
  gender: string | null;
  pronouns: string | null;
  country: string | null;
  sexuality: string | null;
  relationship: string | null;
  accentColor: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  musicUrl: string | null;
  musicTitle: string | null;
  createdAt: string;
  lastSeenAt: string;
};

export type Attachment = { url: string; type: "image" | "video" };

export type ChatMessage = {
  id: number;
  kind: "user" | "system";
  content: string;
  attachment: Attachment | null;
  createdAt: string;
  author: (UserStyle & {
    id: number;
    username: string;
    displayName: string;
    role: "guest" | "member";
    rank: Rank;
    accentColor: string;
    avatarUrl: string | null;
  }) | null;
};

export function toAttachment(fileId: string | null | undefined, type: string | null | undefined): Attachment | null {
  if (!fileId) return null;
  return { url: `/api/files/${fileId}`, type: type === "video" ? "video" : "image" };
}

export function fileUrl(id: string | null | undefined): string | null {
  return id ? `/api/files/${id}` : null;
}

export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role === "guest" ? "guest" : "member",
    rank: rankOf(u),
    mutedUntil: isActive(u.mutedUntil) ? u.mutedUntil!.toISOString() : null,
    bio: u.bio,
    age: u.age,
    gender: u.gender,
    pronouns: u.pronouns,
    country: u.country,
    sexuality: u.sexuality,
    relationship: u.relationship,
    accentColor: u.accentColor,
    nameStyle: u.nameStyle,
    messageStyle: u.messageStyle,
    nameFont: u.nameFont,
    messageItalic: u.messageItalic,
    nameGlow: u.nameGlow,
    avatarUrl: fileUrl(u.avatarFileId),
    bannerUrl: fileUrl(u.bannerFileId),
    musicUrl: fileUrl(u.musicFileId),
    musicTitle: u.musicTitle,
    createdAt: u.createdAt.toISOString(),
    lastSeenAt: u.lastSeenAt.toISOString(),
  };
}

export type SelfUser = PublicUser & {
  muteReason: string | null;
  kickedUntil: string | null;
  kickReason: string | null;
  coins: number;
};

export function toSelfUser(u: User): SelfUser {
  const kicked = isActive(u.kickedUntil);
  return {
    ...toPublicUser(u),
    muteReason: isActive(u.mutedUntil) ? u.muteReason : null,
    kickedUntil: kicked ? u.kickedUntil!.toISOString() : null,
    kickReason: kicked ? u.kickReason : null,
    coins: u.coins,
  };
}

export type ModLogEntry = {
  id: number;
  action: string;
  reason: string | null;
  until: string | null;
  createdAt: string;
  actor: string | null;
  target: string | null;
};

export type DirectMessage = {
  id: number;
  senderId: number;
  recipientId: number;
  content: string;
  attachment: Attachment | null;
  createdAt: string;
  readAt: string | null;
};

export type Conversation = {
  user: PublicUser;
  lastMessage: DirectMessage | null;
  unread: number;
};

export type FriendStatus = "self" | "none" | "friends" | "outgoing" | "incoming";

export type WallPost = {
  id: number;
  content: string;
  createdAt: string;
  author: PublicUser;
  media: Attachment[];
};

export type Presence = { online: PublicUser[]; offline: PublicUser[] };
