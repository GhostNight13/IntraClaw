export const site = {
  name: "VetTiers",
  tagline: "Good / Better / Best treatment plans with built-in financing.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://vettiers.com",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@vettiers.com",
  twitter: "@vettiers",
} as const;
