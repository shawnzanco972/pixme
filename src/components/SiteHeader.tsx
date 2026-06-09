/**
 * Site header — RTL (logo at the start/right, nav, then a primary CTA at the
 * end/left). Sticky, light, with the brand red logotype.
 */
import Link from "next/link";

import { BrandLogo } from "@/components/BrandLogo";

const NAV = [
  { href: "/create", label: "יצירה" },
  { href: "/b2b", label: "לעסקים" },
  { href: "/#how", label: "איך זה עובד" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-outline/70 bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <Link href="/" aria-label="Pixipic — דף הבית">
          <BrandLogo className="text-2xl" />
        </Link>

        <nav className="hidden items-center gap-6 sm:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="font-heading text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <Link href="/create" className="btn btn-primary">
          התחילו ליצור
        </Link>
      </div>
    </header>
  );
}
