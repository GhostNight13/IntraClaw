import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { Providers } from "./providers";
import { site } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const viewport: Viewport = {
  themeColor: "#020617",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "VetTiers — Say yes to more treatment plans",
    template: "%s · VetTiers",
  },
  description:
    "VetTiers helps veterinary clinics present Good / Better / Best treatment plans with built-in financing — so clients say yes instead of 'let me think about it.'",
  keywords: [
    "veterinary software",
    "vet practice management",
    "treatment plans",
    "vet financing",
    "Cherry financing",
    "CareCredit",
    "veterinary SaaS",
    "client compliance",
  ],
  authors: [{ name: "VetTiers" }],
  creator: "VetTiers",
  alternates: {
    canonical: site.url,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: site.url,
    title: "VetTiers — Say yes to more treatment plans",
    description:
      "Present Good / Better / Best veterinary treatment plans with built-in financing in 20 seconds. Join the waitlist for founding-clinic pricing.",
    siteName: "VetTiers",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "VetTiers — tiered treatment plans for veterinary clinics",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VetTiers — Say yes to more treatment plans",
    description:
      "Good / Better / Best vet treatment plans with built-in financing. Join the waitlist.",
    images: ["/og.png"],
    creator: site.twitter,
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
  icons: {
    icon: "/favicon.ico",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "VetTiers",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "VetTiers helps veterinary clinics present Good / Better / Best treatment plans with built-in financing.",
  offers: {
    "@type": "Offer",
    price: "149",
    priceCurrency: "USD",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: "149",
      priceCurrency: "USD",
      unitText: "MONTH",
    },
  },
  url: site.url,
  aggregateRating: undefined,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased">
        <Suspense fallback={null}>
          <Providers>{children}</Providers>
        </Suspense>
      </body>
    </html>
  );
}
