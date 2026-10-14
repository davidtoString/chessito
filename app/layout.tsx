import type { Metadata, Viewport } from "next";
import WebApp from './web-app';
import {AppearanceProvider} from './appearance';
import {headers} from 'next/headers';
import "./globals.css";
import "./board.css";

export const metadata: Metadata = {
  title: "Chessito · A little better, every move",
  description: "Your private chess practice room. Play, understand, and improve.",
  manifest: '/manifest.webmanifest',
  appleWebApp: {capable:true,title:'Chessito',statusBarStyle:'default'},
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: '/icons/icon-192.png',
  },
};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#40694f'};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce=(await headers()).get('x-nonce')||undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased"><AppearanceProvider nonce={nonce}>{children}<WebApp /></AppearanceProvider></body>
    </html>
  );
}
