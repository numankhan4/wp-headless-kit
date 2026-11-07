import type { YoastHeadJson } from "../client/types.js";
import { decodeEntities } from "../utils/html.js";

/**
 * Framework-neutral page metadata. The shape intentionally mirrors Next.js's
 * `Metadata` object so it can be returned from `generateMetadata` directly.
 */
export interface PageMetadata {
  title?: string;
  description?: string;
  alternates?: { canonical?: string };
  robots?: { index: boolean; follow: boolean };
  openGraph?: {
    title?: string;
    description?: string;
    url?: string;
    siteName?: string;
    locale?: string;
    type?: string;
    publishedTime?: string;
    modifiedTime?: string;
    images?: Array<{ url: string; width?: number; height?: number }>;
  };
  twitter?: {
    card?: string;
    title?: string;
    description?: string;
    images?: string[];
  };
}

export interface MetadataOptions {
  /** Rewrite URLs from the WordPress origin to the front-end origin. */
  rewriteOrigin?: { from: string; to: string };
}

function rewrite(url: string | undefined, opts: MetadataOptions): string | undefined {
  if (!url || !opts.rewriteOrigin) return url;
  const { from, to } = opts.rewriteOrigin;
  return url.startsWith(from) ? to.replace(/\/+$/, "") + url.slice(from.replace(/\/+$/, "").length) : url;
}

function clean<T extends object>(obj: T): T | undefined {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
  return entries.length ? (Object.fromEntries(entries) as T) : undefined;
}

/** Convert Yoast's `yoast_head_json` into framework-neutral metadata. */
export function yoastToMetadata(yoast: YoastHeadJson | undefined, opts: MetadataOptions = {}): PageMetadata {
  if (!yoast) return {};
  const text = (s?: string) => (s ? decodeEntities(s) : undefined);

  const robots = yoast.robots
    ? { index: yoast.robots.index !== "noindex", follow: yoast.robots.follow !== "nofollow" }
    : undefined;

  const images = yoast.og_image?.map((img) =>
    clean({ url: rewrite(img.url, opts) ?? img.url, width: img.width, height: img.height })!,
  );

  const meta: PageMetadata = {
    title: text(yoast.title),
    description: text(yoast.description),
    alternates: clean({ canonical: rewrite(yoast.canonical, opts) }),
    robots,
    openGraph: clean({
      title: text(yoast.og_title),
      description: text(yoast.og_description),
      url: rewrite(yoast.og_url, opts),
      siteName: text(yoast.og_site_name),
      locale: yoast.og_locale,
      type: yoast.og_type,
      publishedTime: yoast.article_published_time,
      modifiedTime: yoast.article_modified_time,
      images: images?.length ? images : undefined,
    }),
    twitter: clean({
      card: yoast.twitter_card,
      title: text(yoast.twitter_title),
      description: text(yoast.twitter_description),
      images: yoast.twitter_image ? [yoast.twitter_image] : undefined,
    }),
  };
  return clean(meta) ?? {};
}

/** Extract breadcrumb `{ name, url }` items from the BreadcrumbList node of Yoast's schema graph. */
export function yoastBreadcrumbs(
  yoast: YoastHeadJson | undefined,
  opts: MetadataOptions = {},
): Array<{ name: string; url: string }> {
  const schema = yoast?.schema;
  const graph = (schema as { "@graph"?: unknown } | undefined)?.["@graph"];
  const nodes: unknown[] = Array.isArray(graph) ? graph : Array.isArray(schema) ? schema : [schema];
  const list = nodes.find((n) => {
    if (!n || typeof n !== "object") return false;
    const t = (n as { "@type"?: unknown })["@type"];
    return t === "BreadcrumbList" || (Array.isArray(t) && t.includes("BreadcrumbList"));
  }) as { itemListElement?: unknown } | undefined;
  const raw = list?.itemListElement;
  if (!Array.isArray(raw)) return [];

  const items: Array<{ pos: number; idx: number; name: string; url: string }> = [];
  raw.forEach((i, idx) => {
    if (!i || typeof i !== "object") return;
    const rec = i as Record<string, unknown>;
    const item = rec.item;
    const obj = item && typeof item === "object" ? (item as Record<string, unknown>) : undefined;
    const url = typeof item === "string" ? item : obj?.["@id"];
    const name = rec.name ?? obj?.name;
    if (typeof url !== "string" || typeof name !== "string" || !name) return;
    items.push({ pos: typeof rec.position === "number" ? rec.position : idx, idx, name: decodeEntities(name), url });
  });
  items.sort((a, b) => a.pos - b.pos || a.idx - b.idx);
  return items.map((i) => ({ name: i.name, url: rewrite(i.url, opts) ?? i.url }));
}

/** Serialize Yoast's schema graph to a string that is safe inside a `<script type="application/ld+json">` tag. */
export function yoastJsonLd(yoast: YoastHeadJson | undefined): string {
  const json = yoast?.schema === undefined ? undefined : JSON.stringify(yoast.schema);
  if (!json) return "";
  return json.replace(/[<>&]/g, (c) => "\\u00" + c.charCodeAt(0).toString(16).padStart(2, "0"));
}
