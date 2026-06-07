# @appfeedback/relay

Portable, server-side relay handler for the AppFeedback web SDK. Your browser app
POSTs feedback to the relay; the relay holds your GitHub token (the browser never
does) and opens the issue.

```ts
import { createFetchHandler } from '@appfeedback/relay'

const handler = createFetchHandler(
  { githubToken: process.env.GITHUB_TOKEN!, owner: 'acme', repo: 'feedback' },
  { allowedOrigin: 'https://acme.com' }, // optional CORS
)
```

`createFetchHandler` returns a web-standard `(Request) => Promise<Response>` that
runs unchanged on Cloudflare Workers, Deno, Bun, and Vercel/Netlify Edge.

## Adapters

For platforms that don't expose a web-standard `Request`/`Response`:

- `firebaseHandler(config, options?)` — Firebase Cloud Functions (2nd gen) `onRequest`.
- `appwriteHandler(config, options?)` — Appwrite Functions.

Both accept the same optional `FetchHandlerOptions` second argument as
`createFetchHandler` (e.g. `{ allowedOrigin: '*' }`) and forward it, so CORS —
including the `OPTIONS` preflight — works identically across every adapter.

## CORS

Pass `{ allowedOrigin }` to enable CORS. It accepts `'*'`, a single origin, or an
array of origins; a matching request `Origin` is echoed back, otherwise no
`Access-Control-Allow-Origin` header is emitted. Omit the option entirely for
same-origin behaviour (`OPTIONS` → 405, no CORS headers).

## Attachments are not handled

The AppFeedback spec defines an optional `attachments` field, but **this reference
handler does not process uploads** — it only creates a GitHub issue from the text
fields (`title`, `description`, `extraFields`, `deviceInfo`). If you need file
uploads, implement them yourself in your adapter: store the file (e.g. in object
storage), then embed the resulting URL into `description` or `extraFields` before
the payload reaches `handleFeedback`. The wire validation is unchanged; uploads are
simply out of scope for the reference relay.
