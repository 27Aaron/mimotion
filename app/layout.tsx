import type { Metadata } from "next";
import { cookies } from "next/headers";
import { routing } from "@/i18n/routing";
import "./globals.css";

export const metadata: Metadata = {
  title: "MiMotion",
  description: "Mi Band Auto Step Sync",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("NEXT_LOCALE")?.value;
  const locale =
    localeCookie && routing.locales.includes(localeCookie as "zh" | "en")
      ? localeCookie
      : routing.defaultLocale;

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://npm.elemecdn.com/lxgw-wenkai-screen-webfont/style.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
