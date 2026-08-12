import type { MetadataRoute } from "next";

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private/transactional areas should not be indexed.
      // `/playbook` holds unlisted internal ops guides (e.g. /playbook/galit).
      disallow: ["/admin", "/order/", "/workspace/", "/b2b/thank-you", "/playbook"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
