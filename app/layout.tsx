import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { PwaBootstrap } from "@/components/PwaBootstrap";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Footer } from "@/components/Footer";
import { UsernameGate } from "@/components/UsernameGate";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://dryrunai.vercel.app";
const DESCRIPTION =
  "Pick your stack; the agent builds your scratch-to-expert prep path, teaches you, and interviews you with voice, whiteboard and code — free, forever.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "dryrun AI — Interview Agent",
    template: "%s — dryrun AI",
  },
  description: DESCRIPTION,
  keywords: [
    "AI interview practice",
    "mock interview",
    "technical interview prep",
    "system design interview",
    "coding interview practice",
    "behavioral interview questions",
    "interview simulator",
    "voice mock interview",
  ],
  authors: [{ name: "dryrun AI" }],
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "dryrun AI",
    title: "dryrun AI — Interview Agent",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "dryrun AI — Interview Agent",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <TooltipProvider delay={200}>
            {children}
            <Footer />
            <UsernameGate />
          </TooltipProvider>
          <Toaster richColors position="top-center" />
          <PwaBootstrap />
        </ThemeProvider>
      </body>
    </html>
  );
}
