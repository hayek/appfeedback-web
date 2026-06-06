# P2b-1 — Web Transports + Relay Handler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the web client transports (`RelayTransport`, `DirectGitHubTransport`) to `@appfeedback/core`, and a new framework-agnostic `@appfeedback/relay` package (portable `handleFeedback` handler + adapters), all verified with mocked `fetch` in Node.

**Architecture:** The browser SDK's default path is `RelayTransport`, which POSTs structured feedback to an adopter-operated relay (per `appfeedback-spec/relay-contract.md`). `DirectGitHubTransport` is a dev-only escape hatch gated behind `dangerouslyUseClientToken: true`. `@appfeedback/relay` is the server-side handler adopters deploy: it validates, optionally verifies a CAPTCHA, formats the issue body via `@appfeedback/core`, and creates the GitHub issue — exposed via a generic `Request→Response` adapter (Cloudflare/Vercel/Netlify/Deno/Bun) plus Firebase/Appwrite entry points.

**Tech Stack:** TypeScript 5.7+, vitest 2.1+, Node 22 (global `fetch`/`Request`/`Response`), pnpm workspace. Tests inject a mock `fetch` (no network).

**Reference:** relay contract `/Users/amir/Developer/appfeedback-spec/relay-contract.md`; core types in `packages/core/src/types.ts`.

---

## Conventions
- Repo: `/Users/amir/Developer/appfeedback-web` (existing pnpm workspace). Prefix commands with `cd /Users/amir/Developer/appfeedback-web && …`.
- Core tests: `cd /Users/amir/Developer/appfeedback-web/packages/core && pnpm test`. Relay tests: `cd /Users/amir/Developer/appfeedback-web/packages/relay && pnpm test`. Both via `pnpm -r test` from root.
- No network in tests — inject `fetchImpl` (a `vi.fn()`), never call real GitHub.

---

### Task 1: `FeedbackSubmissionError` + `RelayTransport` (core)

**Files:** Create `packages/core/src/errors.ts`, `packages/core/src/transports/relayTransport.ts`. Test: `packages/core/test/relayTransport.test.ts`.

- [ ] **Step 1: Write the failing test** — `packages/core/test/relayTransport.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { RelayTransport } from '../src/transports/relayTransport'
import { FeedbackSubmissionError } from '../src/errors'
import type { FeedbackReport, DeviceInfo } from '../src/types'

const report: FeedbackReport = { type: 'bug', title: 'Crash', description: 'boom', contactEmail: 'a@b.com', extraFields: { k: 'v' } }
const device: DeviceInfo = { appName: 'A', appVersion: '1', buildNumber: '1', model: 'M', osName: 'Web', osVersion: 'x' }

function okFetch(body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }))
}

describe('RelayTransport', () => {
  it('POSTs the contract payload and returns the issue number', async () => {
    const fetchImpl = okFetch({ issueNumber: 123, issueUrl: 'https://gh/x/y/issues/123' })
    const t = new RelayTransport({ endpoint: 'https://relay.example/api', fetchImpl })
    const n = await t.submit(report, device)
    expect(n).toBe(123)
    expect(fetchImpl).toHaveBeenCalledOnce()
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://relay.example/api')
    expect(init.method).toBe('POST')
    const sent = JSON.parse(init.body)
    expect(sent).toMatchObject({
      type: 'bug', title: 'Crash', description: 'boom', contactEmail: 'a@b.com',
      extraFields: { k: 'v' }, deviceInfo: device, captchaToken: null,
    })
  })

  it('includes a captcha token when a provider is configured', async () => {
    const fetchImpl = okFetch({ issueNumber: 1, issueUrl: 'u' })
    const t = new RelayTransport({ endpoint: 'e', fetchImpl, getCaptchaToken: async () => 'tok-123' })
    await t.submit(report, device)
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).captchaToken).toBe('tok-123')
  })

  it('throws FeedbackSubmissionError with the relay error message on non-2xx', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 }))
    const t = new RelayTransport({ endpoint: 'e', fetchImpl })
    await expect(t.submit(report, device)).rejects.toMatchObject({ name: 'FeedbackSubmissionError', status: 429, message: 'rate limited' })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/amir/Developer/appfeedback-web/packages/core && pnpm test 2>&1 | tail -10
```
Expected: unresolved imports.

- [ ] **Step 3: Implement**

`packages/core/src/errors.ts`:
```ts
/** Thrown by transports when a submission fails. `status` is the HTTP status
 *  from the relay or GitHub when applicable. */
export class FeedbackSubmissionError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message)
    this.name = 'FeedbackSubmissionError'
  }
}
```

`packages/core/src/transports/relayTransport.ts`:
```ts
import type { FeedbackTransport, FeedbackReport, DeviceInfo } from '../types'
import { FeedbackSubmissionError } from '../errors'

export interface RelayTransportConfig {
  /** Absolute URL of the adopter-operated relay (per relay-contract.md). */
  endpoint: string
  /** Optional bot-mitigation token provider (Turnstile/hCaptcha). */
  getCaptchaToken?: () => Promise<string | null> | string | null
  /** Injectable fetch (tests). Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch
}

/** Default web transport: POSTs structured feedback to the adopter's relay,
 *  which holds the GitHub credential server-side. */
export class RelayTransport implements FeedbackTransport {
  constructor(private readonly config: RelayTransportConfig) {}

  async submit(report: FeedbackReport, deviceInfo: DeviceInfo): Promise<number> {
    const doFetch = this.config.fetchImpl ?? fetch
    const captchaToken = this.config.getCaptchaToken ? (await this.config.getCaptchaToken()) : null

    const payload = {
      type: report.type,
      title: report.title,
      description: report.description,
      contactEmail: report.contactEmail ?? null,
      extraFields: report.extraFields ?? {},
      deviceInfo,
      captchaToken: captchaToken ?? null,
    }

    let res: Response
    try {
      res = await doFetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch (e) {
      throw new FeedbackSubmissionError(`relay request failed: ${(e as Error).message}`)
    }

    if (!res.ok) {
      let message = `relay responded ${res.status}`
      try {
        const j = (await res.json()) as { error?: string }
        if (j?.error) message = j.error
      } catch { /* non-JSON error body */ }
      throw new FeedbackSubmissionError(message, res.status)
    }

    const data = (await res.json()) as { issueNumber: number }
    return data.issueNumber
  }
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd /Users/amir/Developer/appfeedback-web/packages/core && pnpm test 2>&1 | tail -8
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/amir/Developer/appfeedback-web && git add -A && git commit -q -m "feat(core): RelayTransport (default web transport) + FeedbackSubmissionError"
```

---

### Task 2: `DirectGitHubTransport` (core, dev-only escape hatch)

**Files:** Create `packages/core/src/transports/directGitHubTransport.ts`. Test: `packages/core/test/directGitHubTransport.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest'
import { DirectGitHubTransport } from '../src/transports/directGitHubTransport'
import type { FeedbackReport, DeviceInfo } from '../src/types'

const report: FeedbackReport = { type: 'feature-request', title: 'Dark mode', description: 'please' }
const device: DeviceInfo = { appName: 'A', appVersion: '1', buildNumber: '1', model: 'M', osName: 'Web', osVersion: 'x' }

describe('DirectGitHubTransport', () => {
  it('refuses to construct without the danger flag', () => {
    // @ts-expect-error intentionally omitting the required flag
    expect(() => new DirectGitHubTransport({ owner: 'o', repo: 'r', token: 't' })).toThrow(/dangerouslyUseClientToken/)
  })

  it('POSTs a formatted issue to GitHub and returns the number', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ number: 77 }), { status: 201 }))
    const t = new DirectGitHubTransport({ owner: 'acme', repo: 'feedback', token: 'ghp_x', dangerouslyUseClientToken: true, fetchImpl })
    const n = await t.submit(report, device)
    expect(n).toBe(77)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.github.com/repos/acme/feedback/issues')
    expect(init.headers.Authorization).toBe('Bearer ghp_x')
    const sent = JSON.parse(init.body)
    expect(sent.title).toBe('Dark mode')
    expect(sent.labels).toEqual(['feature-request', 'user-submitted'])
    expect(sent.body).toContain('**Device Information:**')
    expect(sent.body).toContain('👍 Votes: 0')
  })

  it('throws on a GitHub error status', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 401 }))
    const t = new DirectGitHubTransport({ owner: 'o', repo: 'r', token: 't', dangerouslyUseClientToken: true, fetchImpl })
    await expect(t.submit(report, device)).rejects.toMatchObject({ name: 'FeedbackSubmissionError', status: 401 })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/amir/Developer/appfeedback-web/packages/core && pnpm test 2>&1 | tail -10
```
Expected: unresolved import.

- [ ] **Step 3: Implement** — `packages/core/src/transports/directGitHubTransport.ts`:

```ts
import type { FeedbackTransport, FeedbackReport, DeviceInfo } from '../types'
import { formatIssueBody, labelsFor } from '../issueBodyFormatter'
import { FeedbackSubmissionError } from '../errors'

export interface DirectGitHubTransportConfig {
  owner: string
  repo: string
  token: string
  /** REQUIRED. Shipping a writable token in browser JS is world-readable —
   *  use RelayTransport in production. This flag exists to make the risk explicit. */
  dangerouslyUseClientToken: true
  fetchImpl?: typeof fetch
}

/** Dev/internal-only transport that calls GitHub directly with a client-held
 *  token. NEVER deploy on a public site — the token is world-readable. */
export class DirectGitHubTransport implements FeedbackTransport {
  constructor(private readonly config: DirectGitHubTransportConfig) {
    if (config.dangerouslyUseClientToken !== true) {
      throw new Error(
        'DirectGitHubTransport requires `dangerouslyUseClientToken: true`. It exposes a ' +
        'writable GitHub token in the browser (world-readable). Use RelayTransport in production.',
      )
    }
  }

  async submit(report: FeedbackReport, deviceInfo: DeviceInfo): Promise<number> {
    const doFetch = this.config.fetchImpl ?? fetch
    const url = `https://api.github.com/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repo)}/issues`
    const payload = {
      title: report.title,
      body: formatIssueBody(report, deviceInfo),
      labels: labelsFor(report.type),
    }

    let res: Response
    try {
      res = await doFetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify(payload),
      })
    } catch (e) {
      throw new FeedbackSubmissionError(`GitHub request failed: ${(e as Error).message}`)
    }

    if (!res.ok) {
      throw new FeedbackSubmissionError(`GitHub responded ${res.status}`, res.status)
    }
    const data = (await res.json()) as { number: number }
    return data.number
  }
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd /Users/amir/Developer/appfeedback-web/packages/core && pnpm test 2>&1 | tail -8
```
Expected: PASS.

- [ ] **Step 5: Update the barrel + commit**

Append to `packages/core/src/index.ts`:
```ts
export { FeedbackSubmissionError } from './errors'
export { RelayTransport, type RelayTransportConfig } from './transports/relayTransport'
export { DirectGitHubTransport, type DirectGitHubTransportConfig } from './transports/directGitHubTransport'
```

```bash
cd /Users/amir/Developer/appfeedback-web/packages/core && pnpm test 2>&1 | tail -5 && pnpm typecheck 2>&1 | tail -3
cd /Users/amir/Developer/appfeedback-web && git add -A && git commit -q -m "feat(core): DirectGitHubTransport (dev-only escape hatch) + transport exports"
```

---

### Task 3: Scaffold `@appfeedback/relay` package

**Files:** Create `packages/relay/package.json`, `packages/relay/tsconfig.json`.

- [ ] **Step 1: `packages/relay/package.json`**:

```json
{
  "name": "@appfeedback/relay",
  "version": "0.1.0",
  "description": "Portable server-side relay handler for AppFeedback (adopter-hosted).",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@appfeedback/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: `packages/relay/tsconfig.json`**:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Install (links the workspace dep)**

```bash
cd /Users/amir/Developer/appfeedback-web && pnpm install 2>&1 | tail -6
```
Expected: success; `@appfeedback/relay` now depends on the local `@appfeedback/core`.

---

### Task 4: `handleFeedback` core handler

**Files:** Create `packages/relay/src/handler.ts`. Test: `packages/relay/test/handler.test.ts`.

- [ ] **Step 1: Write the failing test** — `packages/relay/test/handler.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { handleFeedback, RelayError, type RelayRequest } from '../src/handler'

const base: RelayRequest = {
  type: 'bug', title: 'Crash', description: 'boom', contactEmail: null, extraFields: {},
  deviceInfo: { appName: 'A', appVersion: '1', buildNumber: '1', model: 'M', osName: 'Web', osVersion: 'x' },
}
const ghOk = () => vi.fn(async () => new Response(JSON.stringify({ number: 9, html_url: 'https://gh/o/r/issues/9' }), { status: 201 }))

describe('handleFeedback', () => {
  it('creates a GitHub issue and returns number + url', async () => {
    const fetchImpl = ghOk()
    const r = await handleFeedback(base, { githubToken: 't', owner: 'o', repo: 'r', fetchImpl })
    expect(r).toEqual({ issueNumber: 9, issueUrl: 'https://gh/o/r/issues/9' })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.github.com/repos/o/r/issues')
    expect(init.headers.Authorization).toBe('Bearer t')
    const sent = JSON.parse(init.body)
    expect(sent.labels).toEqual(['bug', 'user-submitted'])
    expect(sent.body).toContain('**Device Information:**')
  })

  it('rejects an invalid submission with 400', async () => {
    await expect(handleFeedback({ ...base, type: 'nope' as any }, { githubToken: 't', owner: 'o', repo: 'r', fetchImpl: ghOk() }))
      .rejects.toMatchObject({ name: 'RelayError', status: 400 })
  })

  it('rejects a failed captcha with 403', async () => {
    await expect(handleFeedback(base, { githubToken: 't', owner: 'o', repo: 'r', fetchImpl: ghOk(), verifyCaptcha: () => false }))
      .rejects.toMatchObject({ name: 'RelayError', status: 403 })
  })

  it('maps a GitHub failure to 502', async () => {
    const fetchImpl = vi.fn(async () => new Response('boom', { status: 422 }))
    await expect(handleFeedback(base, { githubToken: 't', owner: 'o', repo: 'r', fetchImpl }))
      .rejects.toMatchObject({ name: 'RelayError', status: 502 })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/amir/Developer/appfeedback-web/packages/relay && pnpm test 2>&1 | tail -10
```
Expected: unresolved import.

- [ ] **Step 3: Implement** — `packages/relay/src/handler.ts`:

```ts
import { formatIssueBody, labelsFor, type FeedbackReport, type DeviceInfo, type FeedbackType } from '@appfeedback/core'

export interface RelayRequest {
  type: FeedbackType
  title: string
  description: string
  contactEmail?: string | null
  extraFields?: Record<string, string>
  deviceInfo: DeviceInfo
  captchaToken?: string | null
}

export interface RelayConfig {
  githubToken: string
  owner: string
  repo: string
  /** Optional bot-mitigation check. Return false to reject (403). */
  verifyCaptcha?: (token: string | null) => Promise<boolean> | boolean
  fetchImpl?: typeof fetch
}

export interface RelayResult {
  issueNumber: number
  issueUrl: string
}

/** Error carrying the HTTP status an adapter should return. */
export class RelayError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'RelayError'
  }
}

const VALID_TYPES: ReadonlyArray<string> = ['bug', 'feature-request']

/** Validate → (CAPTCHA) → format → create GitHub issue. Holds the credential
 *  server-side; the browser never sees it. */
export async function handleFeedback(req: RelayRequest, config: RelayConfig): Promise<RelayResult> {
  if (
    !req || !VALID_TYPES.includes(req.type) ||
    typeof req.title !== 'string' || req.title.length === 0 ||
    typeof req.description !== 'string' ||
    !req.deviceInfo || typeof req.deviceInfo.osName !== 'string'
  ) {
    throw new RelayError('invalid submission', 400)
  }

  if (config.verifyCaptcha) {
    const ok = await config.verifyCaptcha(req.captchaToken ?? null)
    if (!ok) throw new RelayError('captcha verification failed', 403)
  }

  const report: FeedbackReport = {
    type: req.type,
    title: req.title,
    description: req.description,
    contactEmail: req.contactEmail ?? null,
    extraFields: req.extraFields ?? {},
  }
  const body = formatIssueBody(report, req.deviceInfo)
  const labels = labelsFor(req.type)

  const doFetch = config.fetchImpl ?? fetch
  const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/issues`
  let res: Response
  try {
    res = await doFetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.githubToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ title: req.title, body, labels }),
    })
  } catch (e) {
    throw new RelayError(`GitHub upstream request failed: ${(e as Error).message}`, 502)
  }
  if (!res.ok) throw new RelayError(`GitHub upstream error (${res.status})`, 502)

  const data = (await res.json()) as { number: number; html_url: string }
  return { issueNumber: data.number, issueUrl: data.html_url }
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd /Users/amir/Developer/appfeedback-web/packages/relay && pnpm test 2>&1 | tail -8
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/amir/Developer/appfeedback-web && git add -A && git commit -q -m "feat(relay): handleFeedback core handler (validate, captcha, format, create issue)"
```

---

### Task 5: Adapters (generic fetch + Firebase + Appwrite) + barrel

**Files:** Create `packages/relay/src/adapters/fetchHandler.ts`, `packages/relay/src/adapters/firebase.ts`, `packages/relay/src/adapters/appwrite.ts`, `packages/relay/src/index.ts`. Test: `packages/relay/test/fetchHandler.test.ts`.

- [ ] **Step 1: Write the failing test** — `packages/relay/test/fetchHandler.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { createFetchHandler } from '../src/adapters/fetchHandler'

const goodBody = JSON.stringify({
  type: 'bug', title: 'X', description: 'Y',
  deviceInfo: { appName: 'A', appVersion: '1', buildNumber: '1', model: 'M', osName: 'Web', osVersion: 'x' },
})
const ghOk = () => vi.fn(async () => new Response(JSON.stringify({ number: 5, html_url: 'u' }), { status: 201 }))

describe('createFetchHandler', () => {
  const cfg = (fetchImpl: typeof fetch) => ({ githubToken: 't', owner: 'o', repo: 'r', fetchImpl })

  it('200 + result on a valid POST', async () => {
    const h = createFetchHandler(cfg(ghOk()))
    const res = await h(new Request('https://relay/api', { method: 'POST', body: goodBody }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ issueNumber: 5, issueUrl: 'u' })
  })

  it('405 on non-POST', async () => {
    const res = await createFetchHandler(cfg(ghOk()))(new Request('https://relay/api', { method: 'GET' }))
    expect(res.status).toBe(405)
  })

  it('400 on invalid JSON', async () => {
    const res = await createFetchHandler(cfg(ghOk()))(new Request('https://relay/api', { method: 'POST', body: '{bad' }))
    expect(res.status).toBe(400)
  })

  it('maps RelayError status (400 invalid submission)', async () => {
    const res = await createFetchHandler(cfg(ghOk()))(new Request('https://relay/api', { method: 'POST', body: JSON.stringify({ type: 'x' }) }))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/amir/Developer/appfeedback-web/packages/relay && pnpm test 2>&1 | tail -10
```
Expected: unresolved import.

- [ ] **Step 3: Implement**

`packages/relay/src/adapters/fetchHandler.ts` (works on Cloudflare Workers, Vercel, Netlify, Deno, Bun — anywhere with web `Request`/`Response`):
```ts
import { handleFeedback, RelayError, type RelayConfig, type RelayRequest } from '../handler'

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** Build a `(Request) => Promise<Response>` handler for any web-standard runtime. */
export function createFetchHandler(config: RelayConfig): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)
    let req: RelayRequest
    try {
      req = (await request.json()) as RelayRequest
    } catch {
      return json({ error: 'invalid JSON' }, 400)
    }
    try {
      return json(await handleFeedback(req, config), 200)
    } catch (e) {
      if (e instanceof RelayError) return json({ error: e.message }, e.status)
      return json({ error: 'internal error' }, 500)
    }
  }
}
```

`packages/relay/src/adapters/firebase.ts`:
```ts
import { createFetchHandler } from './fetchHandler'
import type { RelayConfig } from '../handler'

/** Firebase Cloud Functions (2nd gen) onRequest-style handler. Wire env vars
 *  (GITHUB_TOKEN, OWNER, REPO) into the config when you deploy. Example:
 *
 *    import { onRequest } from 'firebase-functions/v2/https'
 *    import { firebaseHandler } from '@appfeedback/relay'
 *    export const feedback = onRequest(firebaseHandler({
 *      githubToken: process.env.GITHUB_TOKEN!, owner: 'o', repo: 'r',
 *    }))
 */
export function firebaseHandler(config: RelayConfig) {
  const handler = createFetchHandler(config)
  // Firebase passes Express-like req/res; bridge them to the web-standard handler.
  return async (req: { method: string; rawBody?: Buffer; body?: unknown }, res: { status(c: number): { json(b: unknown): void } }) => {
    const body = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body ?? {})
    const webReq = new Request('https://relay.local/feedback', { method: req.method, body: req.method === 'POST' ? body : undefined })
    const webRes = await handler(webReq)
    res.status(webRes.status).json(await webRes.json())
  }
}
```

`packages/relay/src/adapters/appwrite.ts`:
```ts
import { handleFeedback, RelayError, type RelayConfig, type RelayRequest } from '../handler'

/** Appwrite Functions handler. Reads the JSON body, returns res.json. Example:
 *
 *    import { appwriteHandler } from '@appfeedback/relay'
 *    export default appwriteHandler({
 *      githubToken: process.env.GITHUB_TOKEN!, owner: 'o', repo: 'r',
 *    })
 */
export function appwriteHandler(config: RelayConfig) {
  return async ({ req, res }: {
    req: { method: string; bodyJson?: unknown; body?: string }
    res: { json(data: unknown, status?: number): unknown }
  }) => {
    if (req.method !== 'POST') return res.json({ error: 'method not allowed' }, 405)
    let parsed: RelayRequest
    try {
      parsed = (req.bodyJson ?? JSON.parse(req.body ?? '{}')) as RelayRequest
    } catch {
      return res.json({ error: 'invalid JSON' }, 400)
    }
    try {
      return res.json(await handleFeedback(parsed, config), 200)
    } catch (e) {
      if (e instanceof RelayError) return res.json({ error: e.message }, e.status)
      return res.json({ error: 'internal error' }, 500)
    }
  }
}
```

`packages/relay/src/index.ts`:
```ts
export { handleFeedback, RelayError, type RelayRequest, type RelayConfig, type RelayResult } from './handler'
export { createFetchHandler } from './adapters/fetchHandler'
export { firebaseHandler } from './adapters/firebase'
export { appwriteHandler } from './adapters/appwrite'
```

- [ ] **Step 4: Run to verify it passes + typecheck**

```bash
cd /Users/amir/Developer/appfeedback-web/packages/relay && pnpm test 2>&1 | tail -8 && pnpm typecheck 2>&1 | tail -3
```
Expected: tests PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
cd /Users/amir/Developer/appfeedback-web && git add -A && git commit -q -m "feat(relay): generic fetch + Firebase + Appwrite adapters + barrel"
```

---

### Task 6: Final verification

```bash
cd /Users/amir/Developer/appfeedback-web && pnpm -r test 2>&1 | tail -15
cd /Users/amir/Developer/appfeedback-web && pnpm -r typecheck 2>&1 | tail -6
cd /Users/amir/Developer/appfeedback-web && git log --oneline | head -8 && git status --short
```
Expected: all packages' tests green (core conformance + transports; relay handler + adapters); typecheck clean; clean tree.

---

## Self-Review (plan author)

**Spec coverage (design §6, P2b-1 slice):** ✅ `RelayTransport` default (Task 1); ✅ `DirectGitHubTransport` behind `dangerouslyUseClientToken` (Task 2); ✅ `@appfeedback/relay` handler reusing `@appfeedback/core` formatter (Task 4); ✅ generic + Firebase + Appwrite adapters (Task 5); request/response shape matches `relay-contract.md` (type/title/description/contactEmail/extraFields/deviceInfo/captchaToken → {issueNumber, issueUrl}, error statuses 400/403/502/405). Deferred to P2b-2: `@appfeedback/widget`, `@appfeedback/react`, `navigator`-based `DeviceInfo.current()`; deferred to P2c: tsup dual build + npm publish; attachments (File→base64 upload) are a later addition.

**Mocked-fetch discipline:** every test injects `fetchImpl`; no real network. Node 22 provides `fetch`/`Request`/`Response` globally.

**Placeholder scan:** none; every step has complete code/commands.

**Type/name consistency:** `RelayTransport`/`RelayTransportConfig`, `DirectGitHubTransport`/`DirectGitHubTransportConfig`, `FeedbackSubmissionError`, `handleFeedback`/`RelayRequest`/`RelayConfig`/`RelayResult`/`RelayError`, `createFetchHandler`/`firebaseHandler`/`appwriteHandler` are used consistently; `@appfeedback/relay` imports `formatIssueBody`/`labelsFor`/types from `@appfeedback/core` (the names exported by its barrel in P2a/P2b-1).
