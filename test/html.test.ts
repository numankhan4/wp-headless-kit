import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeEntities, escapeHtml, readingTime, sanitizeHtml, stripTags, toExcerpt } from "../src/index.js";

test("decodeEntities handles named, decimal and hex entities", () => {
  assert.equal(decodeEntities("Tom &amp; Jerry &#8211; &#x2019;quoted&rsquo; &hellip;"), "Tom & Jerry – ’quoted’ …");
  assert.equal(decodeEntities("&unknown;"), "&unknown;");
});

test("escapeHtml escapes the five special characters", () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
});

test("stripTags removes markup, scripts and collapses whitespace", () => {
  assert.equal(stripTags("<p>Hello <b>world</b></p>\n<script>alert(1)</script><p>again</p>"), "Hello world again");
});

test("toExcerpt trims WordPress's [&hellip;] and cuts on a word boundary", () => {
  assert.equal(toExcerpt("<p>Short excerpt [&hellip;]</p>"), "Short excerpt");
  const long = "<p>" + "word ".repeat(60) + "</p>";
  const out = toExcerpt(long, 40);
  assert.ok(out.length <= 40);
  assert.ok(out.endsWith("…"));
  assert.ok(!out.includes("wor…"));
});

test("readingTime is at least one minute", () => {
  assert.equal(readingTime("<p>hi</p>"), 1);
  assert.equal(readingTime("<p>" + "w ".repeat(450) + "</p>"), 2);
});

test("sanitizeHtml keeps safe markup", () => {
  assert.equal(
    sanitizeHtml('<p class="a">Hi <a href="https://x.com/?a=1&b=2" title=\'t\'>link</a><br></p>'),
    '<p class="a">Hi <a href="https://x.com/?a=1&amp;b=2" title="t">link</a><br></p>',
  );
  assert.equal(sanitizeHtml('<a href="/rel">x</a><a href="mailto:a@b.c">m</a>'), '<a href="/rel">x</a><a href="mailto:a@b.c">m</a>');
});

test("sanitizeHtml strips common XSS vectors", () => {
  const vectors: string[] = [
    "<script>alert(1)</script>",
    "<SCRIPT SRC=//evil.js></SCRIPT>",
    "<script>alert(1)",
    '<img src=x onerror=alert(1)>',
    '<img src="x" OnError="alert(1)">',
    '<a href="javascript:alert(1)">x</a>',
    '<a href=" JaVa\tScRiPt:alert(1)">x</a>',
    '<a href="&#106;avascript:alert(1)">x</a>',
    '<a href="jav&#x09;ascript:alert(1)">x</a>',
    '<a href="data:text/html,<script>alert(1)</script>">x</a>',
    '<iframe src="https://evil"></iframe>',
    '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    "<svg onload=alert(1)><script>alert(1)</script></svg>",
    "<style>body{background:url(javascript:alert(1))}</style>",
    '<div style="x:expression(alert(1))" onclick="a()">x</div>',
    "<!--[if IE]><script>alert(1)</script><![endif]-->",
    "<object data=x></object><embed src=x>",
    "<<script>alert(1)//<</script>",
  ];
  for (const v of vectors) {
    const out = sanitizeHtml(v);
    assert.doesNotMatch(out, /<script|<iframe|<svg|<style|<object|<embed|\son\w+=|javascript:|srcdoc|style=|data:/i, `${v} -> ${out}`);
  }
  assert.equal(sanitizeHtml("<p>a</p><script>x</script><p>b</p>"), "<p>a</p><p>b</p>");
  assert.equal(sanitizeHtml('<img src=x onerror=alert(1)>'), '<img src="x">');
});

test("sanitizeHtml honours allowTags/allowAttrs but never unsafe ones", () => {
  assert.equal(sanitizeHtml("<p><b>x</b></p>", { allowTags: ["b"] }), "<b>x</b>");
  assert.equal(sanitizeHtml('<a href="/x" class="c">y</a>', { allowAttrs: ["href"] }), '<a href="/x">y</a>');
  assert.equal(sanitizeHtml('<a onclick="x()" href="/x">y</a>', { allowAttrs: ["onclick", "href"] }), '<a href="/x">y</a>');
  assert.equal(sanitizeHtml("<script>x</script>ok", { allowTags: ["script"] }), "ok");
  assert.equal(sanitizeHtml("1 < 2"), "1 &lt; 2");
});
