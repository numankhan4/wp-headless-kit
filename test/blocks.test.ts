import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBlocks, passthroughHtml, renderBlocks } from "../src/index.js";

const doc = `<!-- wp:heading {"level":2} -->
<h2>Title</h2>
<!-- /wp:heading -->

<!-- wp:columns -->
<div class="wp-block-columns"><!-- wp:column -->
<div class="wp-block-column"><!-- wp:paragraph -->
<p>Left</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column --></div>
<!-- /wp:columns -->

<!-- wp:acme/cta {"href":"/contact"} /-->
<p>freeform</p>`;

test("parseBlocks builds a nested tree with attrs and namespaces", () => {
  const blocks = parseBlocks(doc);
  assert.deepEqual(
    blocks.map((b) => b.blockName),
    ["core/heading", "core/columns", "acme/cta", null],
  );
  assert.deepEqual(blocks[0]!.attrs, { level: 2 });
  assert.equal(blocks[1]!.innerBlocks[0]!.blockName, "core/column");
  assert.equal(blocks[1]!.innerBlocks[0]!.innerBlocks[0]!.blockName, "core/paragraph");
  assert.deepEqual(blocks[2]!.attrs, { href: "/contact" });
  assert.equal(blocks[3]!.innerHTML.trim(), "<p>freeform</p>");
});

test("passthroughHtml keeps inner blocks inside their wrapper markup", () => {
  const html = renderBlocks(parseBlocks(doc), { renderers: {}, fallback: passthroughHtml }).join("");
  assert.match(html, /<div class="wp-block-columns">\s*<div class="wp-block-column">\s*<p>Left<\/p>\s*<\/div>\s*<\/div>/);
  const columns = parseBlocks(doc)[1]!;
  assert.deepEqual(columns.innerContent.map((c) => (c === null ? null : "html")), ["html", null, "html"]);
});

test("parseBlocks tolerates invalid JSON attributes", () => {
  const [block] = parseBlocks(`<!-- wp:image {bad json} /-->`);
  assert.equal(block?.blockName, "core/image");
  assert.deepEqual(block?.attrs, {});
});

test("renderBlocks applies custom renderers and falls back to passthrough", () => {
  const html = renderBlocks(parseBlocks(doc), {
    renderers: { "acme/cta": (b) => `<a href="${String(b.attrs.href)}">CTA</a>` },
    fallback: passthroughHtml,
  }).join("");
  assert.match(html, /<h2>Title<\/h2>/);
  assert.match(html, /<p>Left<\/p>/);
  assert.match(html, /<a href="\/contact">CTA<\/a>/);
});
