# Contributing to AppFeedback (Web/TypeScript SDK)

Thanks for helping improve AppFeedback! This is the Web/TypeScript SDK, a
pnpm workspace with four packages: `core`, `relay`, `widget`, and `react`.
Bug reports, docs fixes, and pull requests are all welcome.

## Prerequisites

- Node.js (LTS) with Corepack
- pnpm (managed via Corepack — no global install needed)

## Build & test

```sh
corepack enable
pnpm install
pnpm -r test
pnpm -r typecheck
```

`-r` runs across every package in the workspace. Please make sure both the
tests and the type checks pass before opening a PR.

## The golden rule: the wire format is pinned by the spec

The cross-platform wire format is defined by the golden fixtures in
[**appfeedback-spec**](https://github.com/hayek/appfeedback-spec). The Swift,
Android, and Web SDKs must all encode and decode byte-for-byte identical
payloads, and the conformance tests in this repo run against fixtures synced
from the spec.

**Any change to the wire format must update the spec fixtures first.** Never
edit a synced fixture just to make a test pass — that silently breaks the
other platforms. The correct flow is:

1. Propose the change in `appfeedback-spec` and update its fixtures.
2. Run the spec's `scripts/sync-to-web.sh` to bring the fixtures here.
3. Update the affected packages to satisfy the new fixtures.

If a conformance test fails, treat it as a real cross-platform contract
mismatch, not a fixture to be massaged.

## Conventions

- Match the existing TypeScript style; keep public API additions documented.
- Add a `CHANGELOG.md` entry under `[Unreleased]` for user-facing changes.

## Questions

See the docs at <https://hayek.github.io/appfeedback-docs/>. For security
issues, follow [SECURITY.md](SECURITY.md) — do not open a public issue.
