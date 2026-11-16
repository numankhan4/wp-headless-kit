import { decodeEntities, escapeHtml } from "../utils/html.js";
import type { BlockRenderer } from "./render.js";

function caption(html: string): string {
  const m = /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i.exec(html);
  return m?.[1] ? decodeEntities(m[1].replace(/<[^>]*>/g, "")).trim() : "";
}

/** HTML renderer for `core/gallery`: a `<figure>` grid wrapping each rendered child image in its own `<figure>` with an escaped caption. */
export const renderGallery: BlockRenderer<string> = (block, children) => {
  const items = children
    .map((child, i) => {
      if (!child) return "";
      const text = caption(block.innerBlocks[i]?.innerHTML ?? "");
      return `<figure class="wp-block-gallery-item">${child}${text ? `<figcaption>${escapeHtml(text)}</figcaption>` : ""}</figure>`;
    })
    .filter(Boolean);
  if (!items.length) return "";
  const cols = Number(block.attrs.columns);
  const style = Number.isInteger(cols) && cols > 0 && cols <= 12 ? ` style="--gallery-columns:${cols}"` : "";
  return `<figure class="wp-block-gallery"${style}>${items.join("")}</figure>`;
};
