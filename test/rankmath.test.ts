import { test } from "node:test";
import assert from "node:assert/strict";
import { rankMathToMetadata } from "../src/index.js";

const HTML = `<title>Hello &amp; World - Site</title>
<meta name="description" content="A &quot;great&quot; post"/>
<meta name="robots" content="noindex, follow"/>
<link rel="canonical" href="https://cms.example.com/hello/" />
<meta property="og:locale" content="en_US" />
<meta property="og:type" content="article" />
<meta property="og:title" content="OG Title" />
<meta property="og:description" content="OG Desc" />
<meta property="og:url" content="https://cms.example.com/hello/" />
<meta property="og:site_name" content="Site" />
<meta property="og:image" content="https://cms.example.com/a.jpg" />
<meta property="og:image:width" content="800" />
<meta property="og:image:height" content="600" />
<meta property="article:published_time" content="2024-01-01T00:00:00+00:00" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="TW Title" />
<meta name="twitter:description" content="TW Desc" />
<meta name="twitter:image" content="https://cms.example.com/t.jpg" />`;

test("rankMathToMetadata parses head HTML", () => {
  const m = rankMathToMetadata(HTML);
  assert.equal(m.title, "Hello & World - Site");
  assert.equal(m.description, 'A "great" post');
  assert.equal(m.alternates?.canonical, "https://cms.example.com/hello/");
  assert.deepEqual(m.robots, { index: false, follow: true });
  assert.equal(m.openGraph?.title, "OG Title");
  assert.equal(m.openGraph?.siteName, "Site");
  assert.equal(m.openGraph?.publishedTime, "2024-01-01T00:00:00+00:00");
  assert.deepEqual(m.openGraph?.images, [{ url: "https://cms.example.com/a.jpg", width: 800, height: 600 }]);
  assert.equal(m.twitter?.card, "summary_large_image");
  assert.deepEqual(m.twitter?.images, ["https://cms.example.com/t.jpg"]);
});

test("rankMathToMetadata rewrites origin and handles empty input", () => {
  const m = rankMathToMetadata(HTML, {
    rewriteOrigin: { from: "https://cms.example.com", to: "https://www.example.com/" },
  });
  assert.equal(m.alternates?.canonical, "https://www.example.com/hello/");
  assert.equal(m.openGraph?.url, "https://www.example.com/hello/");
  assert.deepEqual(rankMathToMetadata(undefined), {});
  assert.deepEqual(rankMathToMetadata("<p>x</p>"), {});
});
