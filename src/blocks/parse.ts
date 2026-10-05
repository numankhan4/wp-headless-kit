/**
 * A minimal parser for Gutenberg's serialized block format:
 *   <!-- wp:namespace/name {"json":"attrs"} --> inner html <!-- /wp:namespace/name -->
 *   <!-- wp:name {"attrs":1} /-->            (self-closing)
 * It returns the same tree shape as `@wordpress/block-serialization-default-parser`.
 */
export interface ParsedBlock {
  /** Fully-qualified block name (core blocks get the `core/` prefix), or null for freeform HTML. */
  blockName: string | null;
  attrs: Record<string, unknown>;
  innerBlocks: ParsedBlock[];
  /** HTML directly inside this block, with inner blocks removed. */
  innerHTML: string;
  /**
   * HTML fragments interleaved with `null` placeholders marking where each inner
   * block sits (same contract as WordPress's parser), so wrappers can be rebuilt.
   */
  innerContent: Array<string | null>;
}

const TOKEN = /<!--\s+(\/)?wp:([a-z][a-z0-9_-]*\/)?([a-z][a-z0-9_-]*)\s+(\{[\s\S]*?\}\s+)?(\/)?-->/g;

function normalizeName(ns: string | undefined, name: string): string {
  return `${ns ?? "core/"}${name}`;
}

function freeform(html: string): ParsedBlock | null {
  return html.trim() ? { blockName: null, attrs: {}, innerBlocks: [], innerHTML: html, innerContent: [html] } : null;
}

function parseAttrs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function parseBlocks(document: string): ParsedBlock[] {
  const root: ParsedBlock = { blockName: "__root__", attrs: {}, innerBlocks: [], innerHTML: "", innerContent: [] };
  const stack: ParsedBlock[] = [root];
  let cursor = 0;

  const appendHtml = (html: string) => {
    if (!html) return;
    const parent = stack[stack.length - 1]!;
    if (parent === root) {
      const block = freeform(html);
      if (block) root.innerBlocks.push(block);
    } else {
      parent.innerHTML += html;
      parent.innerContent.push(html);
    }
  };

  for (const match of document.matchAll(TOKEN)) {
    const [whole, closer, ns, name, attrsRaw, selfClosing] = match;
    const index = match.index ?? 0;
    appendHtml(document.slice(cursor, index));
    cursor = index + whole.length;
    const blockName = normalizeName(ns, name!);

    if (closer) {
      // Pop until we close the matching opener; tolerate malformed nesting.
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i]!.blockName === blockName) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const block: ParsedBlock = {
      blockName,
      attrs: parseAttrs(attrsRaw?.trim()),
      innerBlocks: [],
      innerHTML: "",
      innerContent: [],
    };
    const parent = stack[stack.length - 1]!;
    parent.innerBlocks.push(block);
    if (parent !== root) parent.innerContent.push(null);
    if (!selfClosing) stack.push(block);
  }
  appendHtml(document.slice(cursor));
  return root.innerBlocks;
}
