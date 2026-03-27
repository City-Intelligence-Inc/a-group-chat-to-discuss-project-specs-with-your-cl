import type { Metadata } from "next";
import { Inter, Newsreader, DM_Sans, Plus_Jakarta_Sans, Space_Grotesk, JetBrains_Mono, Outfit, Lora } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Townhall — Real-time Chat",
  description: "Real-time chat room application with channels, reactions, and presence",
};

const fontVars = [
  inter.variable,
  newsreader.variable,
  dmSans.variable,
  plusJakarta.variable,
  spaceGrotesk.variable,
  jetbrainsMono.variable,
  outfit.variable,
  lora.variable,
].join(" ");

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={fontVars}>
        <body className="min-h-screen antialiased bg-white text-neutral-900 font-sans">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
