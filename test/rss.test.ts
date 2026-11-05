import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRssFeed } from "../src/index.js";

test("buildRssFeed escapes and wraps excerpt in CDATA", () => {
  const xml = buildRssFeed({
    title: "A & B",
    link: "https://x.test/?a=1&b=2",
    description: "d <x>",
    items: [{ title: "T <1>", link: "https://x.test/p", date: "2024-01-02T03:04:05Z", excerpt: "hi ]]> <b>" }],
  });
  assert.match(xml, /<title>A &amp; B<\/title>/);
  assert.match(xml, /a=1&amp;b=2/);
  assert.match(xml, /<title>T &lt;1&gt;<\/title>/);
  assert.match(xml, /<pubDate>Tue, 02 Jan 2024 03:04:05 GMT<\/pubDate>/);
  assert.ok(xml.includes("<![CDATA[hi ]]]]><![CDATA[> <b>]]>"));
});

test("buildRssFeed handles empty items and bad dates", () => {
  const xml = buildRssFeed({ title: "t", link: "l", description: "d", items: [{ title: "a", link: "b", date: "nope" }] });
  assert.doesNotMatch(xml, /pubDate/);
  assert.ok(buildRssFeed({ title: "t", link: "l", description: "d", items: [] }).includes("</channel>"));
});
