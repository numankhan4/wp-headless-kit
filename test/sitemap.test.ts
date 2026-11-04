import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSitemap } from "../src/index.js";

test("buildSitemap matches snapshot", () => {
  const xml = buildSitemap([
    { loc: "https://example.com/", lastmod: "2024-01-02", changefreq: "daily", priority: 1 },
    { loc: "https://example.com/a?x=1&y=<2>", priority: 0.5 },
    { loc: "https://example.com/d", lastmod: new Date("2024-03-04T05:06:07Z") },
  ]);
  assert.equal(
    xml,
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2024-01-02</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://example.com/a?x=1&amp;y=&lt;2&gt;</loc>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://example.com/d</loc>
    <lastmod>2024-03-04T05:06:07.000Z</lastmod>
  </url>
</urlset>
`,
  );
});

test("buildSitemap escapes quotes and handles empty input", () => {
  assert.ok(buildSitemap([{ loc: `https://e.com/"'` }]).includes("&quot;&apos;"));
  assert.equal(
    buildSitemap([]),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n`,
  );
});
