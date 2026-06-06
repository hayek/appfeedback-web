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
