import { test } from "node:test";
import assert from "node:assert/strict";
import { WPClient } from "../src/index.js";

function mockFetch(body: unknown, status = 200) {
  const calls: string[] = [];
  const fetch = async (url: string) => {
    calls.push(url);
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
  return { fetch, calls };
}

test("cache serves hits without fetching and refetches after ttl", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1000 });
  const { fetch, calls } = mockFetch({ id: 1 });
  const wp = new WPClient({ baseUrl: "https://example.com", fetch, cache: { ttlMs: 100 } });
  await wp.getMedia(1);
  await wp.getMedia(1);
  assert.equal(calls.length, 1);
  t.mock.timers.tick(101);
  await wp.getMedia(1);
  assert.equal(calls.length, 2);
});

test("cache evicts least-recently-used entries beyond max", async () => {
  const { fetch, calls } = mockFetch({ id: 1 });
  const wp = new WPClient({ baseUrl: "https://example.com", fetch, cache: { ttlMs: 60_000, max: 2 } });
  await wp.getMedia(1);
  await wp.getMedia(2);
  await wp.getMedia(1); // hit, makes 2 the oldest
  await wp.getMedia(3); // evicts 2
  assert.equal(calls.length, 3);
  await wp.getMedia(1);
  assert.equal(calls.length, 3);
  await wp.getMedia(2);
  assert.equal(calls.length, 4);
});

test("cache does not store errors and is off by default", async () => {
  const bad = mockFetch({ message: "no" }, 404);
  const wp = new WPClient({ baseUrl: "https://example.com", fetch: bad.fetch, cache: { ttlMs: 1000 } });
  await assert.rejects(wp.getMedia(1));
  await assert.rejects(wp.getMedia(1));
  assert.equal(bad.calls.length, 2);
  const ok = mockFetch({ id: 1 });
  const plain = new WPClient({ baseUrl: "https://example.com", fetch: ok.fetch });
  await plain.getMedia(1);
  await plain.getMedia(1);
  assert.equal(ok.calls.length, 2);
});
