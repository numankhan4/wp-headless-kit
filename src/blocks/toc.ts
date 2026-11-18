import type { ParsedBlock } from "./parse.js";

/** A table-of-contents entry. */
export interface TocEntry {
  level: number;
  text: string;
  id: string;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (m, dec, hex, name) => {
      if (name) return ENTITIES[name.toLowerCase()] ?? m;
      const code = dec ? Number(dec) : parseInt(hex, 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(text: string): string {
  return (
    text
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "section"
  );
}

const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function walk(blocks: ParsedBlock[], visit: (b: ParsedBlock) => void): void {
  for (const b of blocks) {
    visit(b);
    walk(b.innerBlocks, visit);
  }
}

/**
 * Extracts `{ level, text, id }` for every `core/heading` block (nested too) and, mutating the
 * blocks, adds a unique slug id (as `attrs.anchor` and an `id` attribute in the HTML) to headings lacking one.
 */
export function extractToc(blocks: ParsedBlock[]): TocEntry[] {
  const headings: ParsedBlock[] = [];
  walk(blocks, (b) => {
    if (b.blockName === "core/heading") headings.push(b);
  });

  const idOf = (b: ParsedBlock): string => {
    if (typeof b.attrs.anchor === "string" && b.attrs.anchor) return b.attrs.anchor;
    return /<h[1-6][^>]*?\sid=(?:"([^"]*)"|'([^']*)')/i.exec(b.innerHTML)?.slice(1).find(Boolean) ?? "";
  };

  // Reserve existing ids first so generated ones never collide with them.
  const used = new Set<string>();
  for (const b of headings) {
    const id = idOf(b);
    if (id) used.add(id);
  }

  const toc: TocEntry[] = [];
  for (const b of headings) {
    const tag = /<h([1-6])\b/i.exec(b.innerHTML);
    const rawLevel = typeof b.attrs.level === "number" ? b.attrs.level : tag ? Number(tag[1]) : 2;
    const level = Math.min(6, Math.max(1, Math.trunc(rawLevel) || 2));
    const text = textOf(b.innerHTML);
    let id = idOf(b);
    if (!id) {
      const base = slugify(text);
      id = base;
      for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
      used.add(id);
      b.attrs.anchor = id;
      const addId = (html: string) => html.replace(/<h([1-6])\b/i, `<h$1 id="${escapeAttr(id)}"`);
      b.innerHTML = addId(b.innerHTML);
      b.innerContent = b.innerContent.map((c) => (typeof c === "string" && /<h[1-6]\b/i.test(c) ? addId(c) : c));
    }
    toc.push({ level, text, id });
  }
  return toc;
}
