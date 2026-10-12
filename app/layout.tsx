import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chessito · A little better, every move",
  description: "Your private chess practice room. Play, understand, and improve.",
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
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
