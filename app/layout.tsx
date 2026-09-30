import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Legal Feed",
  description: "Legal monitoring profiles and updates.",
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
