import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Better321 — Live Chat",
  description: "Chat live with people around the world. Build a profile with your own music, banner and vibe.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600&family=Kaushan+Script&family=Permanent+Marker&family=Pirata+One&family=Playfair+Display:ital,wght@1,700&family=Press+Start+2P&family=Special+Elite&display=swap"
        />
      </head>
      <body className="min-h-full bg-[#0d0906] text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
