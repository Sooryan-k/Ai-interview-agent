/**
 * Emits schema.org structured data. Server-rendered into the HTML so crawlers
 * see it without executing JavaScript.
 *
 * The JSON is escaped for `<` — a literal "</script>" inside a string value
 * would otherwise close the tag early and break the page.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
