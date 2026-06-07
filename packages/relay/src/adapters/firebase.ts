import { createFetchHandler, type FetchHandlerOptions } from './fetchHandler'
import type { RelayConfig } from '../handler'

/** Firebase Cloud Functions (2nd gen) onRequest-style handler. Wire env vars
 *  (GITHUB_TOKEN, OWNER, REPO) into the config when you deploy. Pass
 *  {@link FetchHandlerOptions} to enable CORS (e.g. `{ allowedOrigin: '*' }`).
 *  Example:
 *
 *    import { onRequest } from 'firebase-functions/v2/https'
 *    import { firebaseHandler } from '@appfeedback/relay'
 *    export const feedback = onRequest(firebaseHandler({
 *      githubToken: process.env.GITHUB_TOKEN!, owner: 'o', repo: 'r',
 *    }, { allowedOrigin: 'https://acme.com' }))
 */
export function firebaseHandler(config: RelayConfig, options?: FetchHandlerOptions) {
  const handler = createFetchHandler(config, options)
  // Firebase passes Express-like req/res; bridge them to the web-standard handler.
  return async (req: { method: string; headers?: Record<string, string | undefined>; rawBody?: { toString(encoding: string): string }; body?: unknown }, res: { status(c: number): { set(headers: Record<string, string>): { json(b: unknown): void; send(b?: unknown): void }; json(b: unknown): void; send(b?: unknown): void } }) => {
    const body = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body ?? {})
    const origin = req.headers?.origin ?? req.headers?.Origin
    const webReq = new Request('https://relay.local/feedback', {
      method: req.method,
      headers: origin ? { Origin: origin } : undefined,
      body: req.method === 'POST' ? body : undefined,
    })
    const webRes = await handler(webReq)
    // Forward CORS (and any other) response headers the relay set.
    const headers: Record<string, string> = {}
    webRes.headers.forEach((value, key) => { headers[key] = value })
    const out = res.status(webRes.status).set(headers)
    // 204 preflight has no body; otherwise relay always returns JSON.
    if (webRes.status === 204) out.send()
    else out.json(await webRes.json())
  }
}
