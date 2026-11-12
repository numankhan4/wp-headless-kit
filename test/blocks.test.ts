import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBlocks, passthroughHtml, renderBlocks, renderImage } from "../src/index.js";
import type { ParsedBlock } from "../src/index.js";

test("renderImage outputs lazy img with dimensions and escaped alt", () => {
  const html = `<!-- wp:image {"width":640,"height":480} -->
<figure class="wp-block-image"><img src="/a.jpg?x=1&amp;y=2" alt="A &quot;<b>&quot; &amp; c"/></figure>
<!-- /wp:image -->`;
  const [out] = renderBlocks(parseBlocks(html), { renderers: { "core/image": renderImage }, fallback: passthroughHtml });
  assert.equal(
    out,
    '<img src="/a.jpg?x=1&amp;y=2" alt="A &quot;&lt;b&gt;&quot; &amp; c" width="640" height="480" loading="lazy">',
  );
});

test("renderImage drops javascript: URLs and escapes attribute breakouts", () => {
  const bad: ParsedBlock = {
    blockName: "core/image",
    attrs: { url: "javascript:alert(1)" },
    innerBlocks: [],
    innerHTML: "",
    innerContent: [],
  };
  assert.equal(renderImage(bad, [], "k"), "");
  const q = { ...bad, attrs: { url: "https://x/a.png", alt: '" onerror="x', width: "10px" } };
  assert.equal(
    renderImage(q, [], "k"),
    '<img src="https://x/a.png" alt="&quot; onerror=&quot;x" width="10" loading="lazy">',
  );
});

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
  assert.match(
    html,
    /<div class="wp-block-columns">\s*<div class="wp-block-column">\s*<p>Left<\/p>\s*<\/div>\s*<\/div>/,
  );
  const columns = parseBlocks(doc)[1]!;
  assert.deepEqual(
    columns.innerContent.map((c) => (c === null ? null : "html")),
    ["html", null, "html"],
  );
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
