import { test } from "node:test";
import assert from "node:assert/strict";
import { getAuthor, getFeaturedImage, getTerms } from "../src/index.js";

const embedded = {
  author: [{ id: 3, name: "Ada", slug: "ada", avatar_urls: { "96": "https://x/a.png" } }],
  "wp:featuredmedia": [{ id: 9, source_url: "https://x/i.jpg", alt_text: "alt" }],
  "wp:term": [
    [{ id: 1, name: "News", slug: "news", taxonomy: "category" }],
    [{ id: 2, name: "Tip", slug: "tip", taxonomy: "post_tag" }],
  ],
};
const post = { id: 1, _embedded: embedded };

test("helpers read embedded data", () => {
  assert.equal(getFeaturedImage(post)?.source_url, "https://x/i.jpg");
  assert.equal(getAuthor(post)?.name, "Ada");
  assert.deepEqual(getTerms(post, "category")?.map((t) => t.slug), ["news"]);
  assert.deepEqual(getTerms(post, "post_tag")?.map((t) => t.slug), ["tip"]);
});

test("helpers return null when _embed was not requested", () => {
  const bare = { id: 1 };
  assert.equal(getFeaturedImage(bare), null);
  assert.equal(getAuthor(bare), null);
  assert.equal(getTerms(bare, "category"), null);
});

test("unknown taxonomy yields an empty array", () => {
  assert.deepEqual(getTerms(post, "genre"), []);
});

test("embedded errors and missing media return null", () => {
  const broken = { _embedded: { author: [{ code: "rest_user_invalid_id", message: "x" }], "wp:featuredmedia": [] } };
  assert.equal(getAuthor(broken), null);
  assert.equal(getFeaturedImage(broken), null);
  assert.equal(getTerms(broken, "category"), null);
});
