import { createFetchHandler, type FetchHandlerOptions } from './fetchHandler'
import type { RelayConfig } from '../handler'

/** Appwrite Functions handler. Bridges Appwrite's req/res to the web-standard
 *  {@link createFetchHandler} so it shares the same validation, wire format, and
 *  CORS handling. Pass {@link FetchHandlerOptions} to enable CORS (e.g.
 *  `{ allowedOrigin: '*' }`) — the OPTIONS preflight is then answered for you.
 *  Example:
 *
 *    import { appwriteHandler } from '@appfeedback/relay'
 *    export default appwriteHandler({
 *      githubToken: process.env.GITHUB_TOKEN!, owner: 'o', repo: 'r',
 *    }, { allowedOrigin: 'https://acme.com' })
 */
export function appwriteHandler(config: RelayConfig, options?: FetchHandlerOptions) {
  const handler = createFetchHandler(config, options)
  return async ({ req, res }: {
    req: { method: string; headers?: Record<string, string | undefined>; bodyJson?: unknown; bodyRaw?: string; body?: string }
    res: { json(data: unknown, status?: number, headers?: Record<string, string>): unknown; send(body: string, status?: number, headers?: Record<string, string>): unknown }
  }) => {
    // Build a standard Request so we reuse createFetchHandler's CORS + dispatch path.
    const origin = req.headers?.origin ?? req.headers?.Origin
    let body: string | undefined
    if (req.method === 'POST') {
      body = req.bodyRaw ?? req.body ?? (req.bodyJson !== undefined ? JSON.stringify(req.bodyJson) : '{}')
    }
    const webReq = new Request('https://relay.local/feedback', {
      method: req.method,
      headers: origin ? { Origin: origin } : undefined,
      body,
    })
    const webRes = await handler(webReq)
    const headers: Record<string, string> = {}
    webRes.headers.forEach((value, key) => { headers[key] = value })
    // 204 preflight has no JSON body; relay otherwise always returns JSON.
    if (webRes.status === 204) return res.send('', 204, headers)
    return res.json(await webRes.json(), webRes.status, headers)
  }
}
