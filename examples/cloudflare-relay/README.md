# AppFeedback relay — Cloudflare Workers

A complete, deployable [relay](https://hayek.github.io/appfeedback-docs/guides/relay/) for the AppFeedback web SDK. Your browser app POSTs feedback here; this Worker holds your GitHub token (the browser never does) and opens the issue.

The handler is the framework-agnostic `createFetchHandler` from `@appfeedback/relay`. The only Worker-specific code is the wrapper that supplies env bindings and CORS — the same handler runs unchanged on **Deno, Bun, and Vercel/Netlify Edge**.

## Deploy

```bash
npm install
npm i -g wrangler   # or use npx

# 1. Point it at your repo (public config):
#    edit wrangler.toml → REPO_OWNER, REPO_NAME, ALLOWED_ORIGIN

# 2. Set your GitHub token as a secret (issues:write on that repo):
wrangler secret put GITHUB_TOKEN

# 3. (optional) Enable Cloudflare Turnstile CAPTCHA:
wrangler secret put TURNSTILE_SECRET

# 4. Ship it:
npm run deploy
```

You'll get a URL like `https://appfeedback-relay.<you>.workers.dev`.

## Point the widget at it

```ts
import { mountFeedbackWidget } from '@appfeedback/widget'
import { RelayTransport } from '@appfeedback/core'

mountFeedbackWidget(el, {
  transport: new RelayTransport({ endpoint: 'https://appfeedback-relay.<you>.workers.dev' }),
  appName: 'Acme',
  appVersion: '1.0.0',
})
```

## What it does

`createFetchHandler` validates the payload, runs your optional CAPTCHA check, formats the byte-exact issue body, and creates the GitHub issue — returning `{ issueNumber, issueUrl }`. On bad input it returns `400`, on a failed CAPTCHA `403`, and on a GitHub upstream failure `502`. See the [relay contract](https://github.com/hayek/appfeedback-spec/blob/main/relay-contract.md) for the wire details.

## Notes

- **`ALLOWED_ORIGIN`** defaults to `*`. Tighten it to your site's origin in production.
- The token lives only in Cloudflare's secret store — it is never sent to the browser. This is the whole point of the relay; see the [security model](https://hayek.github.io/appfeedback-docs/guides/security/).
- For Firebase or Appwrite, `@appfeedback/relay` ships `firebaseHandler` and `appwriteHandler` instead — same validation and wire format.
