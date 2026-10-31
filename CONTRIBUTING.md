# Contributing to wp-headless-kit

Thanks for your interest! Issues and pull requests are welcome.

## Getting started

```bash
git clone https://github.com/numankhan4/wp-headless-kit.git
cd wp-headless-kit
npm ci
npm test
```

Requires Node.js 22+.

## Before you open a PR

- Keep the change focused on one thing; small PRs get reviewed fastest.
- Add or update tests in `test/` for any behaviour change (`node:test`, mocked `fetch`, no network).
- Run `npm run typecheck`, `npm test` and `npm run format:check`.
- The core package has **zero runtime dependencies** — please keep it that way.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for the PR title (`feat:`, `fix:`, `docs:` …); releases are generated from them.

## Finding something to work on

Issues labeled [`roadmap`](https://github.com/numankhan4/wp-headless-kit/labels/roadmap) describe planned work.
Comment on an issue before starting so it isn't picked up twice.

## How this repo is maintained

Part of the day-to-day work is done by an AI-assisted workflow (see the README's
"How this repo is built"). Human contributions take priority: when you comment that you're
working on an issue, the maintainer labels it `community` and the automation skips it.

## Code of conduct

By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
