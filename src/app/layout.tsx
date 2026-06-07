import type { Metadata } from "next";
import { Heebo, David_Libre } from "next/font/google";
import "./globals.css";

// Primary body font
const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
  display: "swap",
});

// Headings font
const davidLibre = David_Libre({
  variable: "--font-david-libre",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700"],
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
      className={`${heebo.variable} ${davidLibre.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
