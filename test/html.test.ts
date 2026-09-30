import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeEntities, escapeHtml, readingTime, stripTags, toExcerpt } from "../src/index.js";

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
