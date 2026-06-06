# appfeedback-web

The **Web (TypeScript)** SDK in the [AppFeedback](https://hayek.github.io/appfeedback-docs/) family. It turns in-app feedback into a GitHub issue — in the exact same byte-for-byte wire format as the [Apple](https://github.com/hayek/AppFeedbackSDK) and [Android](https://github.com/hayek/appfeedback-android) SDKs.

> **Status:** all four packages build, typecheck, and pass their suites (including the cross-platform conformance gate). npm publishing is in progress — until then, install from this workspace.

## Packages

| Package | Purpose |
| --- | --- |
| `@appfeedback/core` | Framework-agnostic: wire format + `RelayTransport` / `DirectGitHubTransport` |
| `@appfeedback/widget` | Drop-in, dependency-free feedback form (`mountFeedbackWidget`) |
| `@appfeedback/react` | `<FeedbackForm>` React wrapper |
| `@appfeedback/relay` | The server-side handler **you** deploy (Cloudflare / Firebase / Appwrite / generic fetch) |

## The web is different: you host the relay

A browser can't safely hold a writable GitHub token — anything in client JS is public. So on the web the default path is a **relay you deploy and whose token you hold**; the browser only ever talks to your endpoint. The SDK ships reference relay handlers, but you run them. See the [security model](https://hayek.github.io/appfeedback-docs/guides/security/) and [relay guide](https://hayek.github.io/appfeedback-docs/guides/relay/).

```ts
import { mountFeedbackWidget } from '@appfeedback/widget'
import { RelayTransport } from '@appfeedback/core'

mountFeedbackWidget(el, {
  transport: new RelayTransport({ endpoint: '/api/feedback' }),
  appName: 'Acme',
  appVersion: '1.0.0',
})
```

A direct-to-GitHub transport exists for internal tools and prototypes, gated behind an explicit `dangerouslyUseClientToken` flag — it throws without it.

## Why byte-exact?

Every AppFeedback SDK emits an identical GitHub issue body, pinned by a shared spec and a golden-fixture conformance suite ([`appfeedback-spec`](https://github.com/hayek/appfeedback-spec)) that runs in this repo's CI.

## Develop

```sh
corepack enable
pnpm install
pnpm -r test        # vitest, incl. the conformance gate in @appfeedback/core
pnpm -r typecheck
```

API reference: <https://hayek.github.io/appfeedback-docs/reference/typescript/>

## License

MIT © Amir Hayek. See [LICENSE](./LICENSE).
