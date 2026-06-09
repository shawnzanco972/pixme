/**
 * Site footer — light, minimal, RTL.
 */
import { BrandLogo } from "@/components/BrandLogo";

export function SiteFooter() {
  return (
    <footer className="border-t border-outline/70 bg-surface/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-6 py-8 text-sm text-foreground/60 sm:flex-row">
        <span className="flex items-center gap-2 font-heading font-semibold text-foreground/80">
          <BrandLogo className="text-lg" />
          <span>— פסיפס מהתמונה שלך</span>
        </span>
        <span>© {new Date().getFullYear()} Pixipic. נבנה לבנה אחר לבנה.</span>
      </div>
    </footer>
  );
}
