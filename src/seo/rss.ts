/** A single `<item>` in an RSS 2.0 feed. */
export interface RssItem {
  title: string;
  link: string;
  date?: string | Date;
  excerpt?: string;
}

/** Channel metadata and items for {@link buildRssFeed}. */
export interface RssFeedOptions {
  title: string;
  link: string;
  description: string;
  items: RssItem[];
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cdata(s: string): string {
  return `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

function rfc822(d: string | Date): string | undefined {
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? undefined : date.toUTCString();
}

/** Build an RSS 2.0 feed string; titles/links are escaped, excerpts are CDATA-wrapped. */
export function buildRssFeed(opts: RssFeedOptions): string {
  const items = opts.items.map((it) => {
    const parts = [
      `      <title>${escapeXml(it.title)}</title>`,
      `      <link>${escapeXml(it.link)}</link>`,
    ];
    const pub = it.date !== undefined ? rfc822(it.date) : undefined;
    if (pub) parts.push(`      <pubDate>${pub}</pubDate>`);
    if (it.excerpt) parts.push(`      <description>${cdata(it.excerpt)}</description>`);
    return `    <item>\n${parts.join("\n")}\n    </item>`;
  });
  const body = items.length ? items.join("\n") + "\n" : "";
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n` +
    `    <title>${escapeXml(opts.title)}</title>\n    <link>${escapeXml(opts.link)}</link>\n` +
    `    <description>${escapeXml(opts.description)}</description>\n${body}  </channel>\n</rss>\n`
  );
}
