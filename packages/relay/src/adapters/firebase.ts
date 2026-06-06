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
  return async (req: { method: string; rawBody?: { toString(encoding: string): string }; body?: unknown }, res: { status(c: number): { json(b: unknown): void } }) => {
    const body = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body ?? {})
    const webReq = new Request('https://relay.local/feedback', { method: req.method, body: req.method === 'POST' ? body : undefined })
    const webRes = await handler(webReq)
    res.status(webRes.status).json(await webRes.json())
  }
}
