import type { WPMedia, WPTerm, WPUser } from "./types.js";

/** Anything that may carry an `_embedded` object, such as a `WPPost`. */
export type WithEmbedded = object;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function embeddedList(post: WithEmbedded, key: string): unknown[] | null {
  const embedded = (post as { _embedded?: unknown } | null | undefined)?._embedded;
  if (!isObject(embedded)) return null;
  const list = embedded[key];
  return Array.isArray(list) ? list : null;
}

/** Returns the embedded featured image, or `null` if `_embed` was not requested or there is none. */
export function getFeaturedImage(post: WithEmbedded): WPMedia | null {
  const first = embeddedList(post, "wp:featuredmedia")?.[0];
  return isObject(first) && typeof first.id === "number" ? (first as unknown as WPMedia) : null;
}

/** Returns the embedded author, or `null` if `_embed` was not requested or it could not be embedded. */
export function getAuthor(post: WithEmbedded): WPUser | null {
  const first = embeddedList(post, "author")?.[0];
  return isObject(first) && typeof first.id === "number" ? (first as unknown as WPUser) : null;
}

/** Returns embedded terms of one taxonomy (e.g. `"category"`), or `null` if `_embed` was not requested. */
export function getTerms(post: WithEmbedded, taxonomy: string): WPTerm[] | null {
  const groups = embeddedList(post, "wp:term");
  if (!groups) return null;
  return groups
    .flatMap((group) => (Array.isArray(group) ? group : []))
    .filter((t): t is WPTerm => isObject(t) && typeof t.id === "number" && t.taxonomy === taxonomy);
}
