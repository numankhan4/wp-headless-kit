import type { ParsedBlock } from "./parse.js";

/**
 * A renderer receives the parsed block and its already-rendered children
 * and returns an output node. `T` is string for HTML, or e.g. ReactNode.
 */
export type BlockRenderer<T> = (block: ParsedBlock, children: T[], key: string) => T;

export interface RenderOptions<T> {
  /** Renderers keyed by block name, e.g. `"core/image"`. */
  renderers: Record<string, BlockRenderer<T>>;
  /** Used when no renderer matches (including freeform HTML). */
  fallback: BlockRenderer<T>;
}

/** Walk a parsed block tree and render it with a renderer map. */
export function renderBlocks<T>(blocks: ParsedBlock[], options: RenderOptions<T>, keyPrefix = "b"): T[] {
  return blocks.map((block, i) => {
    const key = `${keyPrefix}-${i}`;
    const children = renderBlocks(block.innerBlocks, options, key);
    const renderer = (block.blockName && options.renderers[block.blockName]) || options.fallback;
    return renderer(block, children, key);
  });
}

/**
 * String renderer that keeps WordPress's saved HTML and places each rendered
 * child back where it appeared, so wrappers such as columns keep their children.
 */
export const passthroughHtml: BlockRenderer<string> = (block, children) => {
  if (!children.length) return block.innerHTML;
  let i = 0;
  return block.innerContent.map((part) => (part === null ? (children[i++] ?? "") : part)).join("");
};
