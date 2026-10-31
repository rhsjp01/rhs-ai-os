import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Deploy-time surfaces:
//  - ORG_URL → marketing root (rhsaisolutions.com). The public marketing
//    page that carries the brand schema and llms.txt is served here once
//    the old site is merged — the login gateway is never the canonical
//    home page of the marketing domain.
//  - APP_URL → application surface (app.rhsaisolutions.com). This control
//    center lives on the subdomain; canonical, OG and sitemap URLs all
//    point here.
export const ORG_URL = 'https://rhsaisolutions.com';
export const APP_URL = 'https://app.rhsaisolutions.com';

const DESCRIPTION =
  'Multi-tenant property intelligence platform from Right Hand Services by JP: AI site intelligence with AI-generated aerial visualizations, a shared compliance ledger, simulated AEO visibility estimates, smart invoicing and tiered SaaS billing.';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "RHS AI Solutions OS — Property Intelligence & Compliance Platform",
    template: "%s | RHS AI Solutions OS",
  },
  description: DESCRIPTION,
  applicationName: "RHS AI Solutions OS",
  category: "technology",
  keywords: [
    "RHS AI Solutions",
    "Right Hand Services by JP",
    "property intelligence platform",
    "AI site intelligence",
    "compliance ledger",
    "AEO visibility tracking",
    "answer engine optimization",
    "vegetation management compliance",
    "right-of-way compliance",
    "B2B SaaS",
    "smart invoicing",
    "Candor NC",
  ],
  authors: [{ name: "Right Hand Services by JP" }],
  creator: "Right Hand Services by JP",
  publisher: "RHS AI Solutions",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/icon.png" }],
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "RHS AI Solutions OS",
    title: "RHS AI Solutions OS — Property Intelligence & Compliance Platform",
    description: DESCRIPTION,
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1216,
        height: 640,
        alt: "RHS AI Solutions OS — Property Intelligence & Operational Compliance",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RHS AI Solutions OS — Property Intelligence & Compliance Platform",
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-neutral-950 text-neutral-100`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
