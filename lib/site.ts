/**
 * Single source of truth for site-level identity. Previously SITE_URL was
 * hardcoded separately in the layout, robots, sitemap and OG image routes,
 * so moving to a custom domain meant finding all four.
 */
export const SITE_URL = "https://dryrunai.vercel.app";
export const SITE_NAME = "dryrun AI";
export const SITE_TAGLINE = "Every interview, rehearsed. Free, forever.";

export const SITE_DESCRIPTION =
  "Free AI interview practice: pick your stack and the agent builds a scratch-to-expert prep path, teaches it, then interviews you by voice — with whiteboard, coding and repo rounds, and a scored report card after every one.";

/** Structured data describing the app itself, for rich results. */
export function webApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Any (web browser)",
    browserRequirements:
      "Requires JavaScript. Voice rounds use the Web Speech API, best supported in Chrome and Edge.",
    inLanguage: "en",
    isAccessibleForFree: true,
    // Deliberately no aggregateRating or review — inventing ratings is both
    // dishonest and a Google structured-data violation.
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    featureList: [
      "Generated scratch-to-expert study path for any stack",
      "Voice mock interviews with adaptive follow-ups",
      "Interview on your own public GitHub repository",
      "Depth ladder that finds your knowledge ceiling",
      "Whiteboard round graded from your diagram",
      "Coding round with real test execution",
      "Salary negotiation simulator",
      "Panel interviews with multiple interviewers",
      "Scored report cards with model answers",
      "Delivery coaching: filler words, hedging and speech clarity",
      "Spaced repetition, daily drills and streaks",
    ],
  };
}

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
    description: SITE_TAGLINE,
  };
}
