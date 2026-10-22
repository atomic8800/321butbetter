import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthPanel } from "@/components/AuthPanel";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/chat");

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 py-12 lg:grid-cols-2">
      <section className="animate-fade-up">
        <div className="mb-6 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Better321 logo"
            className="h-20 w-20 object-contain drop-shadow-[0_10px_30px_rgba(249,115,22,0.45)]"
          />
          <span className="text-4xl font-black tracking-tight">
            Better<span className="text-orange-400">321</span>
          </span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
          <span className="online-dot inline-block h-2 w-2 rounded-full bg-emerald-400" />
          Live right now
        </div>
        <h1 className="mt-5 text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl">
          Talk to the world,{" "}
          <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-orange-500 bg-clip-text text-transparent">
            in real time.
          </span>
        </h1>
        <p className="mt-5 max-w-lg text-lg text-zinc-400">
          Better321 is a live chat room with a twist: your profile is yours. Upload a banner, a profile picture and your own
          song, then tag yourself with who you are — on your terms.
        </p>
        <ul className="mt-8 grid gap-3 text-sm text-zinc-300 sm:grid-cols-2">
          {[
            ["⚡", "Instant live messages & who's-online list"],
            ["🎵", "Upload profile music that plays on your page"],
            ["🖼️", "Custom avatar, banner & accent colour"],
            ["🏷️", "Inclusive tags: age, gender, pronouns, country, sexuality"],
            ["👋", "Hop in as a guest — no sign-up required"],
            ["🛡️", "Owner & moderators keep the chat friendly"],
          ].map(([icon, text]) => (
            <li key={text} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3">
              <span className="text-lg" aria-hidden>
                {icon}
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="animate-fade-up">
        <AuthPanel />
      </section>
    </main>
  );
}
