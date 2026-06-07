import type { MetadataRoute } from "next";

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  // Only public, indexable marketing/entry pages.
  return [
    { url: `${base}/`, priority: 1 },
    { url: `${base}/create`, priority: 0.9 },
    { url: `${base}/b2b`, priority: 0.7 },
  ];
}
