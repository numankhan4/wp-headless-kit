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

  const images = yoast.og_image?.map((img) => clean({ url: rewrite(img.url, opts) ?? img.url, width: img.width, height: img.height })!);

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
