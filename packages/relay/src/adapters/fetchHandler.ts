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
