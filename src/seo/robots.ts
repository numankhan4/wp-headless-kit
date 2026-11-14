/** A robots.txt rule group for one or more user agents. */
export interface RobotsRule {
  userAgent: string | string[];
  allow?: string | string[];
  disallow?: string | string[];
  crawlDelay?: number;
}

export interface RobotsTxtOptions {
  rules?: RobotsRule[];
  sitemaps?: string[];
}

const clean = (s: string): string => s.replace(/[\r\n]+/g, " ").trim();
const list = (v?: string | string[]): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** Builds a robots.txt string from rule groups and sitemap URLs (newlines stripped from values). */
export function buildRobotsTxt(options: RobotsTxtOptions = {}): string {
  const blocks: string[] = [];
  for (const rule of options.rules ?? []) {
    const lines: string[] = [];
    for (const ua of list(rule.userAgent)) lines.push(`User-agent: ${clean(ua)}`);
    if (lines.length === 0) continue;
    for (const p of list(rule.allow)) lines.push(`Allow: ${clean(p)}`);
    for (const p of list(rule.disallow)) lines.push(`Disallow: ${clean(p)}`);
    if (rule.crawlDelay !== undefined && Number.isFinite(rule.crawlDelay)) {
      lines.push(`Crawl-delay: ${rule.crawlDelay}`);
    }
    blocks.push(lines.join("\n"));
  }
  const sitemaps = (options.sitemaps ?? []).map((s) => `Sitemap: ${clean(s)}`);
  if (sitemaps.length) blocks.push(sitemaps.join("\n"));
  return blocks.length ? blocks.join("\n\n") + "\n" : "";
}
