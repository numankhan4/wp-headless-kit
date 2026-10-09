import { test } from "node:test";
import assert from "node:assert/strict";
import { WPClient, WPError, parseRetryAfter, toQueryString } from "../src/index.js";

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
  assert.equal(
    toQueryString({ per_page: 5, categories: [1, 2], _embed: true, search: undefined, tags: [] }),
    "?per_page=5&categories=1%2C2&_embed=1",
  );
  assert.equal(toQueryString({}), "");
});

test("getPosts builds the URL and reads pagination headers", async () => {
  const { fetch, calls } = mockFetch([{ id: 1 }, { id: 2 }], {
    headers: { "x-wp-total": "12", "x-wp-totalpages": "6" },
  });
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

test("default fetch is not called with the client as `this` (browser Illegal invocation)", async () => {
  const original = globalThis.fetch;
  let receiver: unknown = "unset";
  globalThis.fetch = function (this: unknown) {
    receiver = this;
    return Promise.resolve(new Response("[]", { headers: { "content-type": "application/json" } }));
  } as typeof fetch;
  try {
    const wp = new WPClient({ baseUrl: "https://example.com" });
    await wp.getPosts();
    assert.ok(!(receiver instanceof WPClient), "fetch must not be invoked with the client as receiver");
  } finally {
    globalThis.fetch = original;
  }
});

test("paginate yields items across all pages and stops after the last", async () => {
  const calls: string[] = [];
  const fetch = async (url: string) => {
    calls.push(url);
    const page = Number(new URL(url).searchParams.get("page"));
    return new Response(JSON.stringify([{ id: page * 2 - 1 }, { id: page * 2 }]), {
      headers: { "x-wp-totalpages": "3" },
    });
  };
  const wp = new WPClient({ baseUrl: "https://example.com", fetch });
  const ids: number[] = [];
  for await (const post of wp.paginate<{ id: number }>("/wp/v2/posts", { per_page: 2 })) ids.push(post.id);
  assert.deepEqual(ids, [1, 2, 3, 4, 5, 6]);
  assert.equal(calls.length, 3);
  assert.ok(calls.every((c) => c.includes("per_page=2")));
});

test("constructor requires baseUrl", () => {
  assert.throws(() => new WPClient({ baseUrl: "" }), /baseUrl is required/);
});

type Step = { status: number; headers?: Record<string, string> };

function sequenceFetch(steps: Step[]) {
  let calls = 0;
  const fetch = async () => {
    const step = steps[Math.min(calls++, steps.length - 1)]!;
    const body = step.status < 400 ? [{ id: 1 }] : { message: "nope" };
    return new Response(JSON.stringify(body), { status: step.status, headers: step.headers });
  };
  return { fetch, count: () => calls };
}

test("retry: retries 5xx then succeeds", async () => {
  const { fetch, count } = sequenceFetch([{ status: 503 }, { status: 500 }, { status: 200 }]);
  const wp = new WPClient({ baseUrl: "https://example.com", fetch, retry: { retries: 3, baseDelayMs: 1 } });
  const res = await wp.getPosts();
  assert.equal(res.items.length, 1);
  assert.equal(count(), 3);
});

test("retry: retries 429 honouring Retry-After", async () => {
  const { fetch, count } = sequenceFetch([{ status: 429, headers: { "retry-after": "0" } }, { status: 200 }]);
  const wp = new WPClient({ baseUrl: "https://example.com", fetch, retry: { retries: 1, baseDelayMs: 10_000 } });
  await wp.getPosts();
  assert.equal(count(), 2);
});

test("retry: does not retry other 4xx", async () => {
  const { fetch, count } = sequenceFetch([{ status: 404 }, { status: 200 }]);
  const wp = new WPClient({ baseUrl: "https://example.com", fetch, retry: { retries: 3, baseDelayMs: 1 } });
  await assert.rejects(wp.getPosts(), (e: unknown) => e instanceof WPError && e.status === 404);
  assert.equal(count(), 1);
});

test("retry: throws WPError after retries are exhausted", async () => {
  const { fetch, count } = sequenceFetch([{ status: 502 }]);
  const wp = new WPClient({ baseUrl: "https://example.com", fetch, retry: { retries: 2, baseDelayMs: 1 } });
  await assert.rejects(wp.getPosts(), (e: unknown) => e instanceof WPError && e.status === 502);
  assert.equal(count(), 3);
});

test("retry: disabled by default", async () => {
  const { fetch, count } = sequenceFetch([{ status: 503 }, { status: 200 }]);
  const wp = new WPClient({ baseUrl: "https://example.com", fetch });
  await assert.rejects(wp.getPosts(), WPError);
  assert.equal(count(), 1);
});

test("parseRetryAfter handles seconds, dates and junk", () => {
  assert.equal(parseRetryAfter("2"), 2000);
  assert.equal(parseRetryAfter(new Date(5000).toUTCString(), 1000), 4000);
  assert.equal(parseRetryAfter("soon"), undefined);
  assert.equal(parseRetryAfter(null), undefined);
});
