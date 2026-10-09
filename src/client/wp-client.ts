import type { ListParams, Paginated, WPMedia, WPPage, WPPost, WPTerm } from "./types.js";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface WPClientOptions {
  /** Site root, e.g. `https://example.com` (no trailing `/wp-json`). */
  baseUrl: string;
  /** Custom fetch (for Next.js caching options, tests, or polyfills). Defaults to global fetch. */
  fetch?: FetchLike;
  /** Extra headers sent with every request, e.g. an Authorization header for application passwords. */
  headers?: Record<string, string>;
  /** Default `RequestInit` merged into every call (e.g. `{ next: { revalidate: 60 } }` in Next.js). */
  requestInit?: RequestInit;
  /** Retry 429 and 5xx responses up to `retries` times, waiting `baseDelayMs * 2^attempt` (or `Retry-After` when sent). */
  retry?: { retries: number; baseDelayMs: number };
}

export class WPError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly url?: string,
  ) {
    super(message);
    this.name = "WPError";
  }
}

/** Parse a `Retry-After` header (seconds or HTTP date) into milliseconds, or `undefined` if absent/invalid. */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed) * 1000;
  const date = Date.parse(trimmed);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

/** Serialise list params the way the WP REST API expects (arrays as comma lists). */
export function toQueryString(params: ListParams = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === false) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      search.set(key, value.join(","));
    } else if (value === true) {
      search.set(key, key === "_embed" ? "1" : "true");
    } else {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export class WPClient {
  private readonly root: string;
  private readonly fetchImpl: FetchLike;

  constructor(private readonly options: WPClientOptions) {
    if (!options.baseUrl) throw new Error("WPClient: baseUrl is required");
    this.root = options.baseUrl.replace(/\/+$/, "") + "/wp-json";
    const f = options.fetch ?? (globalThis.fetch as FetchLike | undefined);
    if (!f) throw new Error("WPClient: no fetch implementation available");
    // Call through a wrapper so browsers don't throw "Illegal invocation" when
    // the native fetch is invoked with `this` bound to the client.
    this.fetchImpl = options.fetch ? f : (input, init) => globalThis.fetch(input, init);
  }

  /** Low-level GET against any REST route, e.g. `request("/wp/v2/posts")`. */
  async request<T>(route: string, params?: ListParams): Promise<{ data: T; headers: Headers }> {
    const url = `${this.root}${route.startsWith("/") ? route : `/${route}`}${toQueryString(params)}`;
    const retries = Math.max(0, this.options.retry?.retries ?? 0);
    const baseDelayMs = this.options.retry?.baseDelayMs ?? 0;
    let res: Response;
    for (let attempt = 0; ; attempt++) {
      res = await this.fetchImpl(url, {
        ...this.options.requestInit,
        headers: { Accept: "application/json", ...this.options.headers },
      });
      if (res.ok || attempt >= retries || !(res.status === 429 || res.status >= 500)) break;
      const delay = parseRetryAfter(res.headers.get("retry-after")) ?? baseDelayMs * 2 ** attempt;
      await res.body?.cancel().catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    if (!res.ok) {
      let code: string | undefined;
      let message = `WordPress request failed with ${res.status}`;
      try {
        const body = (await res.json()) as { code?: string; message?: string };
        code = body.code;
        if (body.message) message = body.message;
      } catch {
        /* non-JSON error body */
      }
      throw new WPError(message, res.status, code, url);
    }
    return { data: (await res.json()) as T, headers: res.headers };
  }

  private async list<T>(route: string, params: ListParams = {}): Promise<Paginated<T>> {
    const { data, headers } = await this.request<T[]>(route, params);
    return {
      items: data,
      total: Number(headers.get("x-wp-total") ?? data.length),
      totalPages: Number(headers.get("x-wp-totalpages") ?? 1),
      page: params.page ?? 1,
    };
  }

  /** Async-iterate every item of a collection route, fetching pages until `x-wp-totalpages` is reached. */
  async *paginate<T = unknown>(route: string, params: ListParams = {}): AsyncGenerator<T, void, undefined> {
    let page = params.page ?? 1;
    while (true) {
      const { data, headers } = await this.request<T[]>(route, { ...params, page });
      yield* data;
      const totalPages = Number(headers.get("x-wp-totalpages") ?? 1);
      if (data.length === 0 || page >= totalPages) return;
      page++;
    }
  }

  getPosts(params?: ListParams): Promise<Paginated<WPPost>> {
    return this.list<WPPost>("/wp/v2/posts", params);
  }

  getPages(params?: ListParams): Promise<Paginated<WPPage>> {
    return this.list<WPPage>("/wp/v2/pages", params);
  }

  getCategories(params?: ListParams): Promise<Paginated<WPTerm>> {
    return this.list<WPTerm>("/wp/v2/categories", params);
  }

  getTags(params?: ListParams): Promise<Paginated<WPTerm>> {
    return this.list<WPTerm>("/wp/v2/tags", params);
  }

  async getMedia(id: number): Promise<WPMedia> {
    return (await this.request<WPMedia>(`/wp/v2/media/${id}`)).data;
  }

  /** Fetch a single post by slug; resolves to `null` when not found. */
  async getPostBySlug(slug: string, params: ListParams = {}): Promise<WPPost | null> {
    const { items } = await this.getPosts({ ...params, slug, per_page: 1 });
    return items[0] ?? null;
  }

  /** Fetch a single page by slug; resolves to `null` when not found. */
  async getPageBySlug(slug: string, params: ListParams = {}): Promise<WPPage | null> {
    const { items } = await this.getPages({ ...params, slug, per_page: 1 });
    return items[0] ?? null;
  }
}
