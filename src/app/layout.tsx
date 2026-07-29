import type { Metadata } from "next";
import { Playfair_Display, DM_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// GEA suite type stack (see DESIGN.md): Playfair Display / DM Sans /
// IBM Plex Mono — Google-hosted stand-ins for the licensed Klim faces.
// Display is weight 400 only per the house rule (never bold Playfair).
const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const body = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GEA - Weekly Campaign & Vendor Reports",
  description: "Grants Estate Agents - Campaign Performance Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1A1814" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="GEA Portal" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
