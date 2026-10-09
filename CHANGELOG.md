# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- REST client: opt-in `retry` option (`{ retries, baseDelayMs }`) retrying 429 and 5xx responses with exponential backoff and `Retry-After` support.
- REST client: `WPClient` with `getPosts`, `getPages`, `getCategories`, `getTags`, `getMedia`, `getPostBySlug` and `getPageBySlug`, pagination metadata via `Paginated<T>`, injectable `fetch` (`FetchLike`), `WPError` for failed requests and `toQueryString` for list parameters.
- Typed WordPress REST models: `WPPost`, `WPPage`, `WPTerm`, `WPMedia`, `ListParams` and `YoastHeadJson`.
- SEO: `yoastToMetadata` converts Yoast head JSON into page metadata (`PageMetadata`, `MetadataOptions`).
- Blocks: `parseBlocks` parses Gutenberg block documents into a `ParsedBlock` tree; `renderBlocks` and `passthroughHtml` render it with custom `BlockRenderer`s.
- Utilities: `decodeEntities`, `escapeHtml`, `stripTags`, `toExcerpt` and `readingTime`.
- Zero runtime dependencies, ESM-only with full TypeScript types.

[Unreleased]: https://github.com/numankhan4/wp-headless-kit/commits/main
