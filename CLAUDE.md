# CLAUDE.md — project conventions for AI contributors

This file is read by the automated daily-dev, PR-review and backlog-planner workflows.

## Project
`wp-headless-kit` is a typed, **zero-runtime-dependency** TypeScript toolkit for headless WordPress front ends.
Modules: `src/client` (REST client), `src/seo` (Yoast/metadata), `src/blocks` (Gutenberg parse/render), `src/utils`.
Everything public is re-exported from `src/index.ts`.

## Rules
- TypeScript strict mode, ESM, `NodeNext` resolution: relative imports end in `.js`.
- No new runtime dependencies. Dev dependencies only when the issue asks for them.
- Public functions get a one-line JSDoc comment. Prefer small pure functions.
- Tests use `node:test` + `node:assert/strict` in `test/*.test.ts`. Mock `fetch` — never hit the network.
- Keep the build working on Node 22: `npm run typecheck && npm test`.
- Framework adapters (Next.js, React) must not be imported by the core; put them under `src/adapters/<name>` or `examples/`.
- HTML helpers must be safe by default: escape text, never trust `innerHTML` from WordPress without a sanitizer option.
- One issue per PR, small diffs. Update README.md when the public API changes.
- Never modify `.github/`, release/publishing config, or anything that handles secrets.
