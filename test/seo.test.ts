import { test } from "node:test";
import assert from "node:assert/strict";
import { yoastToMetadata, yoastJsonLd, yoastBreadcrumbs } from "../src/index.js";

test("yoastBreadcrumbs extracts the BreadcrumbList and rewrites origin", () => {
  const yoast = {
    schema: {
      "@graph": [
        { "@type": "WebPage", name: "x" },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 2, name: "Hello &amp; bye" },
            { "@type": "ListItem", position: 3, name: "Post &amp; more", item: "https://cms.example.com/blog/post/" },
            { "@type": "ListItem", position: 1, name: "Home", item: "https://cms.example.com/" },
          ],
        },
      ],
    },
  };
  assert.deepEqual(yoastBreadcrumbs(yoast), [
    { name: "Home", url: "https://cms.example.com/" },
    { name: "Post & more", url: "https://cms.example.com/blog/post/" },
  ]);
  const rewritten = yoastBreadcrumbs(yoast, {
    rewriteOrigin: { from: "https://cms.example.com", to: "https://www.example.com" },
  });
  assert.equal(rewritten[1]?.url, "https://www.example.com/blog/post/");
  assert.deepEqual(yoastBreadcrumbs(undefined), []);
  assert.deepEqual(yoastBreadcrumbs({ title: "x" }), []);
});

test("yoastJsonLd escapes script-closing sequences", () => {
  const evil = "</script><script>alert(1)</script> & <!--";
  const out = yoastJsonLd({ schema: { "@context": "https://schema.org", "@graph": [{ name: evil }] } });
  assert.ok(!out.includes("<"));
  assert.ok(!out.includes(">"));
  assert.equal(JSON.parse(out)["@graph"][0].name, evil);
});

test("yoastJsonLd returns empty string without a schema", () => {
  assert.equal(yoastJsonLd(undefined), "");
  assert.equal(yoastJsonLd({ title: "x" }), "");
});

test("yoastToMetadata maps Yoast fields and rewrites the origin", () => {
  const meta = yoastToMetadata(
    {
      title: "Hello &amp; welcome",
      description: "Desc",
      canonical: "https://cms.example.com/blog/hello/",
      robots: { index: "noindex", follow: "follow" },
      og_url: "https://cms.example.com/blog/hello/",
      og_type: "article",
      og_image: [{ url: "https://cms.example.com/img.jpg", width: 1200, height: 630 }],
      twitter_card: "summary_large_image",
    },
    { rewriteOrigin: { from: "https://cms.example.com", to: "https://www.example.com/" } },
  );

  assert.equal(meta.title, "Hello & welcome");
  assert.equal(meta.alternates?.canonical, "https://www.example.com/blog/hello/");
  assert.deepEqual(meta.robots, { index: false, follow: true });
  assert.equal(meta.openGraph?.url, "https://www.example.com/blog/hello/");
  assert.deepEqual(meta.openGraph?.images, [{ url: "https://www.example.com/img.jpg", width: 1200, height: 630 }]);
  assert.equal(meta.twitter?.card, "summary_large_image");
  assert.equal(meta.twitter?.images, undefined);
});

test("yoastToMetadata returns an empty object for missing input", () => {
  assert.deepEqual(yoastToMetadata(undefined), {});
  assert.deepEqual(yoastToMetadata({}), {});
});
