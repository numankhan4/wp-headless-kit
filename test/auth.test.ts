import { test } from "node:test";
import assert from "node:assert/strict";
import { WPClient, basicAuth } from "../src/index.js";

test("basicAuth encodes username:password as a Basic header", () => {
  assert.equal(basicAuth("admin", "abcd efgh"), `Basic ${Buffer.from("admin:abcd efgh").toString("base64")}`);
});

test("basicAuth is UTF-8 safe", () => {
  assert.equal(basicAuth("jörg", "pässwörd ✓"), `Basic ${Buffer.from("jörg:pässwörd ✓").toString("base64")}`);
});

test("basicAuth header is sent by WPClient when fetching drafts", async () => {
  let seen: Headers | undefined;
  const client = new WPClient({
    baseUrl: "https://example.com",
    headers: { Authorization: basicAuth("admin", "secret") },
    fetch: async (_url, init) => {
      seen = new Headers(init?.headers);
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  await client.getPosts({ status: "draft" });
  assert.equal(seen?.get("authorization"), basicAuth("admin", "secret"));
});
