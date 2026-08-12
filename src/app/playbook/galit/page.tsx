import { PackagingGuide } from "@/components/playbook/PackagingGuide";

/**
 * Internal sourcing guide for Galit (packaging sourcing in Israel).
 * Unlisted: noindex/nofollow here, plus `/playbook` is disallowed in robots.ts
 * and absent from sitemap.ts. Reachable only by knowing the URL.
 */
export const metadata = {
  title: "אריזה — מדריך פנימי",
  robots: { index: false, follow: false, nocache: true },
};

export default function GalitPlaybookPage() {
  return <PackagingGuide />;
}
