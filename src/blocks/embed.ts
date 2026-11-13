import type { BlockRenderer } from "./render.js";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Extract a YouTube or Vimeo video reference from a URL, or null. */
export function parseVideoUrl(url: string): { provider: "youtube" | "vimeo"; id: string } | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^(www|m)\./, "");
  let id: string | undefined;
  if (host === "youtu.be") id = u.pathname.split("/")[1];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/);
    id = u.pathname === "/watch" ? (u.searchParams.get("v") ?? undefined) : m?.[1];
  } else if (host === "vimeo.com" || host === "player.vimeo.com") {
    id = u.pathname.split("/").find((p) => /^\d+$/.test(p));
    if (id) return { provider: "vimeo", id };
    return null;
  } else return null;
  return id && /^[\w-]{6,20}$/.test(id) ? { provider: "youtube", id } : null;
}

/**
 * `core/embed` renderer: YouTube/Vimeo become a privacy-friendly thumbnail link
 * (no iframe or third-party scripts); other providers keep the saved HTML.
 */
export const renderEmbed: BlockRenderer<string> = (block) => {
  const url = typeof block.attrs?.url === "string" ? block.attrs.url : "";
  const video = url ? parseVideoUrl(url) : null;
  if (!video) return block.innerHTML;
  const href =
    video.provider === "youtube"
      ? `https://www.youtube.com/watch?v=${video.id}`
      : `https://vimeo.com/${video.id}`;
  const thumb =
    video.provider === "youtube"
      ? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`
      : `https://vumbnail.com/${video.id}.jpg`;
  const label = video.provider === "youtube" ? "YouTube" : "Vimeo";
  return (
    `<figure class="wp-block-embed is-provider-${video.provider} lite-embed">` +
    `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">` +
    `<img src="${esc(thumb)}" alt="Watch video on ${label}" loading="lazy" referrerpolicy="no-referrer"></a></figure>`
  );
};
