import type { Metadata } from "next";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light">
      <body className="antialiased">{children}</body>
    </html>
  );
}
