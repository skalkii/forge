import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";

// Body / UI — warm humanist grotesque, distinctive but highly legible.
const sans = Hanken_Grotesk({
  variable: "--font-sans-face",
  subsets: ["latin"],
  display: "swap",
});

// Headings / display — characterful, slightly quirky grotesque with optical sizing.
const display = Bricolage_Grotesque({
  variable: "--font-display-face",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

// Numbers, IDs, code.
const mono = JetBrains_Mono({
  variable: "--font-mono-face",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Forge — VideoDB Growth Agent",
    template: "%s · Forge",
  },
  description:
    "Review queue and live operations dashboard for the VideoDB Growth Agent — find developers stuck on problems VideoDB solves, help them, and measure cost per activated developer.",
  applicationName: "Forge",
  // Icons resolved by file convention: app/icon.svg (crisp) + app/favicon.ico (legacy).
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1b19" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${display.variable} ${mono.variable} antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
