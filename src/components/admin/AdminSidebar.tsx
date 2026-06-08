"use client";
/**
 * Admin dashboard navigation — a persistent sidebar (RTL → renders on the right).
 * Each tab is its own route so deep links work. The active tab is highlighted
 * from the current pathname.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignOutButton } from "./SignOutButton";

interface Tab {
  href: string;
  label: string;
  /** Exact match only (for the index route). */
  exact?: boolean;
}

const TABS: Tab[] = [
  { href: "/admin", label: "סקירה", exact: true },
  { href: "/admin/orders", label: "הזמנות" },
  { href: "/admin/clients", label: "לקוחות" },
  { href: "/admin/inventory", label: "מלאי" },
  { href: "/admin/b2b", label: "עסקים" },
  { href: "/admin/finance", label: "כספים" },
  { href: "/admin/docs", label: "מסמכים" },
  { href: "/admin/sandbox", label: "ארגז חול" },
];

export function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const isActive = (t: Tab) =>
    t.exact ? pathname === t.href : pathname.startsWith(t.href);

  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 border-outline p-4 md:w-60 md:border-e">
      <div className="flex items-center justify-between md:flex-col md:items-start md:gap-2">
        <Link href="/admin" className="font-heading text-xl font-bold">
          לוח ניהול
        </Link>
        <span className="text-xs text-zinc-500" dir="ltr">
          {email}
        </span>
      </div>

      <nav className="flex flex-row flex-wrap gap-1 md:flex-col">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive(t)
                ? "bg-surface-muted font-semibold text-primary"
                : "text-zinc-600 hover:bg-surface-muted"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="md:mt-auto">
        <SignOutButton />
      </div>
    </aside>
  );
}
