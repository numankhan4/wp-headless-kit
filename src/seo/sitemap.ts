/** A single `<url>` entry in an XML sitemap. */
export interface SitemapEntry {
  loc: string;
  lastmod?: string | Date;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Build a sitemap.org XML document from entries, escaping all values. */
export function buildSitemap(entries: SitemapEntry[]): string {
  const urls = entries.map((e) => {
    const parts = [`    <loc>${escapeXml(e.loc)}</loc>`];
    if (e.lastmod !== undefined) {
      const v = e.lastmod instanceof Date ? e.lastmod.toISOString() : e.lastmod;
      parts.push(`    <lastmod>${escapeXml(v)}</lastmod>`);
    }
    if (e.changefreq) parts.push(`    <changefreq>${escapeXml(e.changefreq)}</changefreq>`);
    if (e.priority !== undefined) {
      parts.push(`    <priority>${Math.min(1, Math.max(0, e.priority)).toFixed(1)}</priority>`);
    }
    return `  <url>\n${parts.join("\n")}\n  </url>`;
  });
  const body = urls.length ? urls.join("\n") + "\n" : "";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}</urlset>\n`;
}
