import type { Metadata } from "next";
import { Heebo, Rubik } from "next/font/google";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

// Primary body font
const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
  display: "swap",
});

// Headings / labels — Rubik (rounded, toy-like; supports Hebrew)
const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Pixme — פסיפס מהתמונה שלך",
    template: "%s · Pixme",
  },
  description:
    "הפכו תמונה לפסיפס לבנים — העלו, צפו בתצוגה מקדימה, והזמינו ערכה.",
  openGraph: {
    title: "Pixme — פסיפס מהתמונה שלך",
    description:
      "הפכו תמונה לפסיפס לבנים — העלו, צפו בתצוגה מקדימה, והזמינו ערכה.",
    locale: "he_IL",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable} ${rubik.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
