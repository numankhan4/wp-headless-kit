# wp-headless-kit

[![CI](https://github.com/numankhan4/wp-headless-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/numankhan4/wp-headless-kit/actions/workflows/ci.yml)
![license](https://img.shields.io/badge/license-MIT-38bdf8)
![deps](https://img.shields.io/badge/runtime%20deps-0-0ea5e9)

**[▶ Live playground](https://numankhan4.github.io/wp-headless-kit/)**: fetch posts from any WordPress site, see the generated SEO metadata, and parse Gutenberg blocks in your browser.

Typed, zero-dependency building blocks for **headless WordPress** front ends (Next.js, Astro, Remix, or plain Node):

- **`WPClient`**: a small typed client for the WP REST API, with pagination headers, slug lookups and typed errors.
- **`yoastToMetadata`**: turns Yoast's `yoast_head_json` into a Next.js-compatible `Metadata` object and rewrites the CMS origin to your front-end origin.
- **`parseBlocks` / `renderBlocks`**: parse Gutenberg's serialized block markup and render it with your own component map.
- **HTML utilities**: `decodeEntities`, `toExcerpt`, `readingTime`, `stripTags`, `escapeHtml`.

## Install

```bash
npm install github:numankhan4/wp-headless-kit
```

## Quick start (Next.js App Router)

```ts
// lib/wp.ts
import { WPClient } from "wp-headless-kit";

export const wp = new WPClient({
  baseUrl: process.env.WP_URL!, // e.g. https://cms.example.com
  requestInit: { next: { revalidate: 300 } } as RequestInit,
});
```

```tsx
// app/blog/[slug]/page.tsx
import { notFound } from "next/navigation";
import { yoastToMetadata, parseBlocks, renderBlocks, passthroughHtml } from "wp-headless-kit";
import { wp } from "@/lib/wp";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = await wp.getPostBySlug(params.slug);
  return yoastToMetadata(post?.yoast_head_json, {
    rewriteOrigin: { from: process.env.WP_URL!, to: "https://www.example.com" },
  });
}

export default async function Post({ params }: { params: { slug: string } }) {
  const post = await wp.getPostBySlug(params.slug, { _embed: true });
  if (!post) notFound();
  const html = renderBlocks(parseBlocks(post.content.raw ?? post.content.rendered), {
    renderers: {},
    fallback: passthroughHtml,
  }).join("");
  return <article dangerouslySetInnerHTML={{ __html: html }} />;
}
```

## API

| Export                                                      | Description                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------------- |
| `new WPClient({ baseUrl, fetch?, headers?, requestInit?, retry?, timeoutMs? })` | Create a client. `timeoutMs` aborts each attempt that takes longer and throws `WPError` with code `timeout` (composes with `requestInit.signal`). `retry: { retries, baseDelayMs }` retries 429/5xx with exponential backoff and honours `Retry-After`. |
| `basicAuth(username, appPassword)`                          | `Authorization` header value for Application Passwords (see below). |
| `getPosts / getPages / getCategories / getTags(params)`     | Paginated lists: `{ items, total, totalPages, page }`.        |
| `getPostBySlug / getPageBySlug(slug)`                       | Single item or `null`.                                        |
| `getCollection<T>(restBase, params)`                        | Paginated list for any custom post type, e.g. `"books"`.      |
| `getItemBySlug<T>(restBase, slug, params?)`                 | Single custom post type item by slug, or `null`.              |
| `search(term, { type, subtype, per_page })`                 | Paginated `WPSearchResult[]` from `/wp/v2/search`.            |
| `getMedia(id)`                                              | Media item.                                                   |
| `paginate(route, params)`                                   | Async iterator over every item across all pages.              |
| `request(route, params)`                                    | Call any REST route.                                          |
| `WPError`                                                   | Thrown on non-2xx responses, with `status`, `code` and `url`. |
| `yoastToMetadata(yoast, { rewriteOrigin? })`                | Yoast to framework-neutral metadata.                          |
| `parseBlocks(html)`                                         | Gutenberg block tree.                                         |
| `renderBlocks(blocks, { renderers, fallback })`             | Render the tree to strings, React nodes, etc.                 |

### Fetching drafts with Application Passwords

Create an Application Password in your WordPress profile, then pass `basicAuth` as a header. It uses `TextEncoder` and `btoa`, so it works in Node and edge runtimes. Keep credentials server-side.

```ts
import { WPClient, basicAuth } from "wp-headless-kit";

const wp = new WPClient({
  baseUrl: "https://example.com",
  headers: { Authorization: basicAuth(process.env.WP_USER!, process.env.WP_APP_PASSWORD!) },
});

const { items: drafts } = await wp.getPosts({ status: "draft" });
```

## Development

```bash
npm install
npm test
npm run coverage # run tests and print a coverage summary
```

See [ROADMAP.md](ROADMAP.md) for what's coming.

## How this repo is built

This project doubles as a demo of an AI-assisted engineering workflow I designed:

- **Daily:** a GitHub Action picks the next roadmap issue, Claude implements it with tests, and opens a PR.
- **Every PR:** an AI review posts inline feedback; CI must pass before anything merges.
- **Risk-based merging:** docs/tests-only changes auto-merge; code, dependency and workflow changes are reviewed and merged by me.
- **Guardrails:** a cap on open PRs, protected workflow files, and a kill switch.

The workflows are in [`.github/workflows`](.github/workflows) if you want to reuse the setup.

## License

MIT © Numan Ul Haq
