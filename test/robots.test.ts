import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRobotsTxt } from "../src/index.js";

test("builds rules and sitemaps", () => {
  const out = buildRobotsTxt({
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/wp-admin/", "/private"], crawlDelay: 5 },
      { userAgent: ["Googlebot", "Bingbot"], disallow: "" },
    ],
    sitemaps: ["https://example.com/sitemap.xml"],
  });
  assert.equal(
    out,
    "User-agent: *\nAllow: /\nDisallow: /wp-admin/\nDisallow: /private\nCrawl-delay: 5\n\n" +
      "User-agent: Googlebot\nUser-agent: Bingbot\nDisallow: \n\nSitemap: https://example.com/sitemap.xml\n",
  );
});

test("empty input and newline injection", () => {
  assert.equal(buildRobotsTxt({}), "");
  const out = buildRobotsTxt({ sitemaps: ["https://a.com/s.xml\nDisallow: /"] });
  assert.equal(out, "Sitemap: https://a.com/s.xml Disallow: /\n");
});
