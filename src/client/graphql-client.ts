import { WPError } from "./wp-client.js";
import type { FetchLike } from "./wp-client.js";

export interface WPGraphQLClientOptions {
  /** Full GraphQL endpoint URL, e.g. `https://example.com/graphql`. */
  endpoint: string;
  /** Custom fetch (for tests or framework caching). Defaults to global fetch. */
  fetch?: FetchLike;
  /** Extra headers sent with every request, e.g. Authorization. */
  headers?: Record<string, string>;
  /** Default `RequestInit` merged into every call. */
  requestInit?: RequestInit;
}

/** Minimal WPGraphQL client: POSTs a document and throws `WPError` on HTTP or GraphQL errors. */
export class WPGraphQLClient {
  private readonly fetchImpl: FetchLike;

  constructor(private readonly options: WPGraphQLClientOptions) {
    if (!options.endpoint) throw new Error("WPGraphQLClient: endpoint is required");
    const f = options.fetch ?? (globalThis.fetch as FetchLike | undefined);
    if (!f) throw new Error("WPGraphQLClient: no fetch implementation available");
    this.fetchImpl = options.fetch ? f : (input, init) => globalThis.fetch(input, init);
  }

  /** Run a GraphQL query and return its `data`; GraphQL errors are thrown as `WPError` with code `graphql_error`. */
  async query<T = unknown>(document: string, variables?: Record<string, unknown>): Promise<T> {
    const url = this.options.endpoint;
    const res = await this.fetchImpl(url, {
      ...this.options.requestInit,
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...this.options.headers },
      body: JSON.stringify({ query: document, variables }),
    });
    let body: { data?: T | null; errors?: { message?: string }[] } | undefined;
    try {
      body = (await res.json()) as typeof body;
    } catch {
      /* non-JSON body */
    }
    if (body?.errors?.length) {
      const message = body.errors.map((e) => e.message ?? "Unknown GraphQL error").join("; ");
      throw new WPError(message, res.status, "graphql_error", url);
    }
    if (!res.ok) throw new WPError(`WPGraphQL request failed with ${res.status}`, res.status, undefined, url);
    if (body?.data === undefined || body.data === null) {
      throw new WPError("WPGraphQL response contained no data", res.status, "graphql_no_data", url);
    }
    return body.data;
  }
}
