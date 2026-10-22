import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  uuid,
  customType,
  index,
  uniqueIndex,
  bigint,
  boolean,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: text("username").notNull().unique(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash"),
    role: text("role").notNull().default("member"), // "guest" | "member"
    rank: text("rank").notNull().default("user"), // "user" | "moderator" (owner is fixed by username)
    mutedUntil: timestamp("muted_until", { withTimezone: true }),
    muteReason: text("mute_reason"),
    kickedUntil: timestamp("kicked_until", { withTimezone: true }),
    kickReason: text("kick_reason"),
    kickedIp: text("kicked_ip"),
    lastIp: text("last_ip"),
    // Currency, stored in hundredths of a coin (5000 = 50.00 coins).
    coins: bigint("coins", { mode: "number" }).notNull().default(50000),
    lastIncomeAt: timestamp("last_income_at", { withTimezone: true }).notNull().defaultNow(),
    lastDailyAt: timestamp("last_daily_at", { withTimezone: true }),
    bio: text("bio").notNull().default(""),
    age: integer("age"),
    gender: text("gender"),
    pronouns: text("pronouns"),
    country: text("country"),
    sexuality: text("sexuality"),
    relationship: text("relationship"),
    accentColor: text("accent_color").notNull().default("#fb923c"),
    // Chat style: "solid:#rrggbb" or "gradient:<angle>:#c1,#c2[,#c3,#c4]" (null = default).
    nameStyle: text("name_style"),
    messageStyle: text("message_style"),
    nameFont: text("name_font"),
    messageItalic: boolean("message_italic").notNull().default(false),
    nameGlow: boolean("name_glow").notNull().default(false),
    avatarFileId: uuid("avatar_file_id"),
    bannerFileId: uuid("banner_file_id"),
    musicFileId: uuid("music_file_id"),
    musicTitle: text("music_title"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("users_last_seen_idx").on(t.lastSeenAt)],
);

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // avatar | banner | music
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  name: text("name").notNull().default(""),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    kind: text("kind").notNull().default("user"), // user | system
    content: text("content").notNull(),
    attachmentFileId: uuid("attachment_file_id"),
    attachmentType: text("attachment_type"), // image | video
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("messages_created_idx").on(t.createdAt), index("messages_deleted_idx").on(t.deletedAt)],
);

export const modActions = pgTable(
  "mod_actions",
  {
    id: serial("id").primaryKey(),
    actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
    targetId: integer("target_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetName: text("target_name"),
    reason: text("reason"),
    until: timestamp("until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("mod_actions_created_idx").on(t.createdAt)],
);

export const directMessages = pgTable(
  "direct_messages",
  {
    id: serial("id").primaryKey(),
    senderId: integer("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientId: integer("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull().default(""),
    attachmentFileId: uuid("attachment_file_id"),
    attachmentType: text("attachment_type"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [
    index("dm_sender_idx").on(t.senderId, t.recipientId),
    index("dm_recipient_idx").on(t.recipientId, t.readAt),
  ],
);

export const friendships = pgTable(
  "friendships",
  {
    id: serial("id").primaryKey(),
    requesterId: integer("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addresseeId: integer("addressee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"), // pending | accepted
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("friendships_pair_idx").on(t.requesterId, t.addresseeId),
    index("friendships_addressee_idx").on(t.addresseeId, t.status),
  ],
);

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("posts_author_idx").on(t.authorId, t.id)],
);

export const postMedia = pgTable(
  "post_media",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    fileId: uuid("file_id").notNull(),
    type: text("type").notNull(), // image | video
    position: integer("position").notNull().default(0),
  },
  (t) => [index("post_media_post_idx").on(t.postId)],
);

export const gifts = pgTable(
  "gifts",
  {
    id: serial("id").primaryKey(),
    senderId: integer("sender_id").references(() => users.id, { onDelete: "set null" }),
    recipientId: integer("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gift: text("gift").notNull(), // heart | donut | kiss | beer
    message: text("message"),
    price: integer("price").notNull(), // hundredths of a coin
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("gifts_recipient_idx").on(t.recipientId, t.id)],
);

/** Permanent bans. The banned account itself is deleted; this keeps it from coming back. */
export const bans = pgTable(
  "bans",
  {
    id: serial("id").primaryKey(),
    username: text("username"),
    ip: text("ip"),
    displayName: text("display_name").notNull().default(""),
    reason: text("reason"),
    actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("bans_username_idx").on(t.username), index("bans_ip_idx").on(t.ip)],
);

export type User = typeof users.$inferSelect;
export type Message = typeof messages.$inferSelect;
