# Publishing to npm

The four `@appfeedback/*` packages are release-ready — dual ESM/CJS builds
(tsup), types-first `publishConfig.exports`, `access: public`, and clean
`publint` / `@arethetypeswrong/cli` checks. The only thing left needs **your**
npm credentials.

## One-time setup

1. An npm account with access to the `@appfeedback` scope.
2. An **automation access token** added to the repo as the `NPM_TOKEN` secret
   (Settings → Secrets and variables → Actions). Provenance is attested via
   GitHub OIDC, so the token only needs publish rights.

## Cutting a release

```sh
# 1. Bump versions (all four packages move together):
#    edit packages/*/package.json "version", or use your preferred tool.
# 2. Sanity check what would ship:
pnpm check:publish        # publint + are-the-types-wrong on each package
# 3. Commit, tag, push:
git commit -am "release: v0.1.0"
git tag v0.1.0
git push && git push --tags
```

Pushing the `v0.1.0` tag triggers `.github/workflows/release.yml`, which
installs, tests, builds, and runs `pnpm -r publish --access public --provenance`.
pnpm publishes in dependency order (`core` first) and rewrites the `workspace:*`
ranges to the concrete version, so consumers get `@appfeedback/core@0.1.0`.

## Manual publish (without the workflow)

```sh
pnpm -r build
npm login
pnpm -r publish --access public
```

> **Always publish with `pnpm publish`, never `npm publish`.** Each package keeps
> its real published metadata under `publishConfig` (top-level `exports` points at
> `./src` for local dev). `pnpm publish`/`pnpm pack` merge `publishConfig` into the
> tarball; plain `npm publish` does **not**, and would ship a package whose
> `exports` points at the absent `./src/index.ts`. For the same reason
> `pnpm check:publish` builds first and runs `attw` against the `pnpm pack`
> tarball (not `npm pack`).

## Packages

| Package | Notes |
| --- | --- |
| `@appfeedback/core` | Published first; the others depend on it. |
| `@appfeedback/relay` | Server-side; depends on core. |
| `@appfeedback/widget` | Bundles core; ships the `.afb-*` DOM widget. |
| `@appfeedback/react` | `'use client'` banner; React is a peer dependency. |
