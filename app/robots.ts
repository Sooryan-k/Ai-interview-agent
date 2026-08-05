import type { MetadataRoute } from "next";

const SITE_URL = "https://dryrunai.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/features", "/login", "/r/"],
      // Everything else needs a signed-in session and redirects to /login
      // for crawlers anyway — no point spending crawl budget on it.
      disallow: [
        "/dashboard",
        "/onboarding",
        "/prep",
        "/practice",
        "/stories",
        "/settings",
        "/interview",
        "/report",
        "/api/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
