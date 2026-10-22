# Better321 — Live Chat

A live chat community built with **Next.js (App Router)**, **PostgreSQL** and **Drizzle ORM**.

- 💬 Live chat with @mentions, photos & videos, custom gradient name/message colours and fonts
- 👤 Profiles with picture, banner, profile music and inclusive tags (age, gender, pronouns, country, sexuality, relationship status)
- 👥 Friends, private DMs (with photos/videos) and a friends-only wall
- 🪙 Coins (earned every minute online + daily bonus), 🎁 gifts and 🎰 Plinko
- 🛡️ Owner & moderator tools (mute, kick, ban, clear chat, mod log) and a guest role

---

## Deploy on Vercel

### 1. Put the code on GitHub

The project is **89 files**, so it fits in a single upload on the GitHub website (the limit is 100 per upload).

**GitHub website (no software needed):**
1. Unzip the download.
2. On github.com click **New repository**, give it a name, and click **Create repository** (don't add a README).
3. On the empty repository page click **uploading an existing file**.
4. Open the unzipped `better321` folder, select **everything inside it** (Ctrl+A / Cmd+A), and drag it onto the upload area.
   Drag the *contents*, not the `better321` folder itself, so `package.json` ends up at the top level of the repository.
5. Click **Commit changes**.

> Files starting with a dot (`.gitignore`, `.env.example`) are hidden by default on Mac and Windows. They're optional:
> the site deploys fine without them. To include them, show hidden files first (Mac: Cmd+Shift+. in Finder;
> Windows: File Explorer → View → Hidden items).

**GitHub Desktop:** *File → Add local repository…* → choose the unzipped folder → let it **create a repository** there → **Publish repository**.

**Command line:**
```bash
git init -b main && git add -A && git commit -m "Better321"
git remote add origin https://github.com/YOUR-NAME/better321.git
git push -u origin main
```

### 2. Import it into Vercel

1. Go to **[vercel.com/new](https://vercel.com/new)** and import your repository.
2. Vercel detects **Next.js** automatically. Leave the build settings as they are; `vercel.json` already sets them.
3. Click **Deploy**. The **first deploy will fail** with "No database connection string was found". That's expected; add the database next.

### 3. Add a database

1. In your Vercel project open **Storage → Create Database → Neon (Serverless Postgres)**.
   Choose a region close to your Vercel functions (default: *US East / Washington, D.C.*).
2. Connect it to your project for **Production** and **Preview**. This adds `DATABASE_URL` (and `DATABASE_URL_UNPOOLED`) for you.
3. Go to **Deployments → ⋯ → Redeploy**.

Every deploy runs `scripts/migrate.mjs` first, which creates or updates the database tables automatically.

### 4. Become the owner

Open your site and **sign up with the username `atomic8800`**. That account automatically gets the 👑 Owner rank
(change `OWNER_USERNAME` in `src/lib/moderation.ts` to use a different name).

---

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Postgres connection string. Added automatically by the Neon integration (pooled). `POSTGRES_URL` also works. |
| `DATABASE_URL_UNPOOLED` | optional | Direct connection used for migrations, if present. Added by the Neon integration. |

You can also use any other hosted Postgres (Supabase, Railway, etc.): just set `DATABASE_URL`.

---

## Good to know on Vercel

- **Uploads are limited to 4 MB per file** (and 4 MB total per wall post), because Vercel rejects requests larger than 4.5 MB.
  For bigger videos/songs you'd need direct-to-storage uploads (for example Vercel Blob).
- **Files are stored in the database.** Pictures, banners, songs and chat media live in Postgres, so watch your database's storage quota.
- **Live updates** use a streaming connection that reconnects automatically every few minutes (Vercel stops a function after 5 minutes on the free plan).
  Each open chat tab checks the database about once a second, so a busy chat uses more database compute; keep an eye on your Neon usage.
- Accounts and messages from the editor preview are **not** copied over; your Vercel site starts with an empty database.

---

## Run it locally

Requirements: Node.js 20+ and a PostgreSQL database.

```bash
npm install
cp .env.example .env          # then edit DATABASE_URL
node scripts/migrate.mjs      # create the tables
npm run dev                   # http://localhost:3000
```

## Changing the database schema

1. Edit `src/db/schema.ts`.
2. Run `npx drizzle-kit generate` to create a new migration in `drizzle/`.
3. Commit it. The next Vercel deploy applies it automatically.

## Project structure

```
src/app/                pages and API routes (Next.js App Router)
src/components/         React components
  ChatRoom.tsx          the live chat (lounge + DMs)
  chat/                 message list, DM thread, sidebar & online list, styled names
  Shells.tsx            page wrappers (chat, profile, public profile, Plinko)
  session.tsx           login state, sign-in gate, kicked/banned screen
  ui.tsx                avatar, tags & badges, media viewer, music player, friend button
  economy.tsx           coin balance, gifts, gifts tab
  moderation.tsx        mod tools & owner panel
src/db/                 database connection + schema (Drizzle ORM)
src/lib/                shared logic (auth, chat, social, coins & Plinko, styles, formatting, …)
drizzle/                SQL migrations (applied on deploy)
scripts/migrate.mjs     migration runner used by the Vercel build
public/                 logo and gift images
vercel.json             Vercel build settings
index.html              repository front page (not served by the app)
```
