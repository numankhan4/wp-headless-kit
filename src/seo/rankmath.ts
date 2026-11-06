import { decodeEntities } from "../utils/html.js";
import type { MetadataOptions, PageMetadata } from "./yoast.js";

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    out[m[1]!.toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? "");
  }
  return out;
}

function clean<T extends object>(o: T): T | undefined {
  const e = Object.entries(o).filter(([, v]) => v !== undefined);
  return e.length ? (Object.fromEntries(e) as T) : undefined;
}

/** Parse the HTML head returned by Rank Math's `/rankmath/v1/getHead` into `PageMetadata`. */
export function rankMathToMetadata(html: string | undefined, opts: MetadataOptions = {}): PageMetadata {
  if (!html) return {};
  const rw = (url?: string) => {
    if (!url || !opts.rewriteOrigin) return url;
    const from = opts.rewriteOrigin.from.replace(/\/+$/, "");
    return url.startsWith(from) ? opts.rewriteOrigin.to.replace(/\/+$/, "") + url.slice(from.length) : url;
  };
  const meta = new Map<string, string[]>();
  let canonical: string | undefined;
  for (const m of html.matchAll(/<(meta|link)\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if (m[1]!.toLowerCase() === "link") {
      if (a.rel?.toLowerCase() === "canonical" && a.href) canonical ??= a.href;
      continue;
    }
    const key = (a.property ?? a.name)?.toLowerCase();
    if (!key || a.content === undefined) continue;
    meta.set(key, [...(meta.get(key) ?? []), a.content]);
  }
  const get = (k: string) => meta.get(k)?.[0];
  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch ? decodeEntities(titleMatch[1]!.trim()) : undefined;

  const robotsRaw = get("robots")?.toLowerCase();
  const robots = robotsRaw
    ? { index: !robotsRaw.includes("noindex"), follow: !robotsRaw.includes("nofollow") }
    : undefined;

  const widths = meta.get("og:image:width") ?? [];
  const heights = meta.get("og:image:height") ?? [];
  const images = (meta.get("og:image") ?? []).map((url, i) => {
    const img: { url: string; width?: number; height?: number } = { url: rw(url) ?? url };
    if (widths[i] && !Number.isNaN(Number(widths[i]))) img.width = Number(widths[i]);
    if (heights[i] && !Number.isNaN(Number(heights[i]))) img.height = Number(heights[i]);
    return img;
  });
  const twImage = get("twitter:image");

  const result: PageMetadata = {
    title,
    description: get("description"),
    alternates: clean({ canonical: rw(canonical) }),
    robots,
    openGraph: clean({
      title: get("og:title"),
      description: get("og:description"),
      url: rw(get("og:url")),
      siteName: get("og:site_name"),
      locale: get("og:locale"),
      type: get("og:type"),
      publishedTime: get("article:published_time"),
      modifiedTime: get("article:modified_time") ?? get("og:updated_time"),
      images: images.length ? images : undefined,
    }),
    twitter: clean({
      card: get("twitter:card"),
      title: get("twitter:title"),
      description: get("twitter:description"),
      images: twImage ? [rw(twImage) ?? twImage] : undefined,
    }),
  };
  return clean(result) ?? {};
}
