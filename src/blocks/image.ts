import { decodeEntities, escapeHtml } from "../utils/html.js";
import type { BlockRenderer } from "./render.js";

function imgAttr(html: string, name: string): string | undefined {
  const m = new RegExp(`<img\\b[^>]*?\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(html);
  const raw = m?.[1] ?? m?.[2];
  return raw === undefined ? undefined : decodeEntities(raw);
}

function dimension(value: unknown): string | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/px$/, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? String(Math.round(n)) : undefined;
}

function safeUrl(url: string | undefined): string | undefined {
  const u = url?.trim();
  if (!u) return undefined;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(u.replace(/[\u0000- ]/g, ""))?.[1]?.toLowerCase();
  return !scheme || scheme === "http" || scheme === "https" ? u : undefined;
}

/** HTML renderer for `core/image` emitting an `<img>` with width, height, lazy loading and escaped attributes. */
export const renderImage: BlockRenderer<string> = (block) => {
  const src = safeUrl(typeof block.attrs.url === "string" ? block.attrs.url : imgAttr(block.innerHTML, "src"));
  if (!src) return "";
  const altAttr = block.attrs.alt;
  const alt = typeof altAttr === "string" ? altAttr : (imgAttr(block.innerHTML, "alt") ?? "");
  const width = dimension(block.attrs.width ?? imgAttr(block.innerHTML, "width"));
  const height = dimension(block.attrs.height ?? imgAttr(block.innerHTML, "height"));
  const attrs = [`src="${escapeHtml(src)}"`, `alt="${escapeHtml(alt)}"`];
  if (width) attrs.push(`width="${width}"`);
  if (height) attrs.push(`height="${height}"`);
  attrs.push('loading="lazy"');
  return `<img ${attrs.join(" ")}>`;
};
