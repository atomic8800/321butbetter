import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="glass rounded-3xl p-10 text-center">
        <p className="text-5xl">🫥</p>
        <h1 className="mt-4 text-2xl font-black">Nothing here</h1>
        <p className="mt-2 text-sm text-zinc-400">That page or profile doesn&apos;t exist.</p>
        <Link href="/chat" className="btn-primary mt-6 inline-block">
          Back to chat
        </Link>
      </div>
    </main>
  );
}
