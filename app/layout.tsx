import type { Metadata } from "next";
import "./globals.css";
import {headers} from 'next/headers';
import {getSession} from '@/src/server/auth-session';
import {getAccount} from '@/src/server/store';
import {runtime} from '@/src/server/runtime';
import {localeFromCookie,normalizeLocale} from '@/src/i18n/core';
import {I18nProvider} from '@/src/i18n/client';

export const metadata: Metadata = {
  title: "Legal Feed",
  description: "Follow Swiss legal topics in your personal Legal Feed. Monitor laws, court decisions and official publications, with relevant updates by email.",
  robots: {index:false,follow:false},
  referrer: 'no-referrer',
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const h=await headers();
  const session=await getSession(h,runtime().SITE_URL||'https://legalfeed.helveticlens.ch');
  const locale=session?normalizeLocale((await getAccount(session.owner_id)).locale):localeFromCookie(h.get('cookie')||'');
  return (
    <html lang={locale==='en'?'en-CH':locale} data-theme="light">
      <body className="antialiased"><I18nProvider initialLocale={locale} signedIn={!!session}>{children}</I18nProvider></body>
    </html>
  );
}
