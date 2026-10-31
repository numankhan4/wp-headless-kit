import { test } from "node:test";
import assert from "node:assert/strict";
import { WPGraphQLClient, WPError } from "../src/index.js";

function mock(body: unknown, status = 200) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetch = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  };
  return { fetch, calls };
}

const ENDPOINT = "https://example.com/graphql";

test("query posts document and variables and returns data", async () => {
  const { fetch, calls } = mock({ data: { posts: [1] } });
  const gql = new WPGraphQLClient({ endpoint: ENDPOINT, fetch, headers: { "X-A": "b" } });
  const data = await gql.query<{ posts: number[] }>("query($n:Int){posts(first:$n)}", { n: 1 });
  assert.deepEqual(data, { posts: [1] });
  const init = calls[0]?.init;
  assert.equal(init?.method, "POST");
  assert.deepEqual(JSON.parse(init?.body as string), {
    query: "query($n:Int){posts(first:$n)}",
    variables: { n: 1 },
  });
  assert.equal((init?.headers as Record<string, string> | undefined)?.["X-A"], "b");
});

test("GraphQL errors surface as WPError", async () => {
  const { fetch } = mock({ errors: [{ message: "bad" }, { message: "worse" }] });
  const gql = new WPGraphQLClient({ endpoint: ENDPOINT, fetch });
  await assert.rejects(gql.query("{x}"), (e: unknown) => {
    assert.ok(e instanceof WPError);
    assert.equal(e.message, "bad; worse");
    assert.equal(e.code, "graphql_error");
    return true;
  });
});

test("HTTP failure surfaces as WPError", async () => {
  const { fetch } = mock("oops", 502);
  const gql = new WPGraphQLClient({ endpoint: ENDPOINT, fetch });
  await assert.rejects(gql.query("{x}"), (e: unknown) => e instanceof WPError && e.status === 502);
});

test("missing data throws WPError", async () => {
  const { fetch } = mock({});
  const gql = new WPGraphQLClient({ endpoint: ENDPOINT, fetch });
  await assert.rejects(gql.query("{x}"), (e: unknown) => e instanceof WPError && e.code === "graphql_no_data");
});
