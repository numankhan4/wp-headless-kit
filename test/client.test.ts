import { test } from "node:test";
import assert from "node:assert/strict";
import { WPClient, WPError, toQueryString } from "../src/index.js";

function mockFetch(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  const calls: string[] = [];
  const fetch = async (url: string) => {
    calls.push(url);
    return new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers: { "content-type": "application/json", ...init.headers },
    });
  };
  return { fetch, calls };
}

test("toQueryString serialises arrays, booleans and skips empties", () => {
  assert.equal(toQueryString({ per_page: 5, categories: [1, 2], _embed: true, search: undefined, tags: [] }), "?per_page=5&categories=1%2C2&_embed=1");
  assert.equal(toQueryString({}), "");
});

test("getPosts builds the URL and reads pagination headers", async () => {
  const { fetch, calls } = mockFetch([{ id: 1 }, { id: 2 }], { headers: { "x-wp-total": "12", "x-wp-totalpages": "6" } });
  const wp = new WPClient({ baseUrl: "https://example.com/", fetch });
  const res = await wp.getPosts({ per_page: 2, page: 3 });
  assert.equal(calls[0], "https://example.com/wp-json/wp/v2/posts?per_page=2&page=3");
  assert.deepEqual(res, { items: [{ id: 1 }, { id: 2 }], total: 12, totalPages: 6, page: 3 });
});

test("getPostBySlug returns null when not found", async () => {
  const { fetch } = mockFetch([]);
  const wp = new WPClient({ baseUrl: "https://example.com", fetch });
  assert.equal(await wp.getPostBySlug("missing"), null);
});

test("non-OK responses throw WPError with the WordPress error code", async () => {
  const { fetch } = mockFetch({ code: "rest_post_invalid_id", message: "Invalid post ID." }, { status: 404 });
  const wp = new WPClient({ baseUrl: "https://example.com", fetch });
  await assert.rejects(wp.getMedia(99), (err: unknown) => {
    assert.ok(err instanceof WPError);
    assert.equal(err.status, 404);
    assert.equal(err.code, "rest_post_invalid_id");
    assert.equal(err.message, "Invalid post ID.");
    return true;
  });
});

test("constructor requires baseUrl", () => {
  assert.throws(() => new WPClient({ baseUrl: "" }), /baseUrl is required/);
});
