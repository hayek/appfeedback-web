import { handleFeedback, RelayError, type RelayConfig, type RelayRequest } from '../handler'

/** Optional CORS configuration for {@link createFetchHandler}.
 *  Omit it entirely to keep same-origin behaviour (no CORS headers, OPTIONS → 405). */
export interface FetchHandlerOptions {
  /**
   * Browser origin(s) permitted to call this relay cross-origin.
   * - `'*'` allows any origin (echoes `*`).
   * - A single origin string or an array of origins: the request's `Origin`
   *   is echoed back only when it matches; otherwise no `Access-Control-Allow-Origin`
   *   is emitted (browser blocks the response).
   * - Omitted: no CORS headers at all, and `OPTIONS` returns 405 (same as before).
   */
  allowedOrigin?: string | string[]
}

function json(body: unknown, status: number, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  })
}

/** Resolve the `Access-Control-Allow-Origin` value for a request, or `null` if
 *  CORS is not configured / the request's origin is not allowed. */
function resolveAllowedOrigin(
  requestOrigin: string | null,
  allowedOrigin: string | string[] | undefined,
): string | null {
  if (allowedOrigin === undefined) return null
  if (allowedOrigin === '*') return '*'
  const allowed = Array.isArray(allowedOrigin) ? allowedOrigin : [allowedOrigin]
  if (requestOrigin !== null && allowed.includes(requestOrigin)) return requestOrigin
  return null
}

/** Build a `(Request) => Promise<Response>` handler for any web-standard runtime.
 *
 *  Pass {@link FetchHandlerOptions.allowedOrigin} to enable CORS: an `OPTIONS`
 *  preflight is answered with `204` + the CORS headers, and POST responses carry
 *  `Access-Control-Allow-Origin`. With no options the behaviour is unchanged
 *  (same-origin; `OPTIONS` → 405). */
export function createFetchHandler(
  config: RelayConfig,
  options?: FetchHandlerOptions,
): (request: Request) => Promise<Response> {
  const allowedOrigin = options?.allowedOrigin
  const corsEnabled = allowedOrigin !== undefined

  return async (request: Request): Promise<Response> => {
    const requestOrigin = request.headers.get('Origin')
    const acao = resolveAllowedOrigin(requestOrigin, allowedOrigin)
    const corsHeaders: Record<string, string> = acao !== null ? { 'Access-Control-Allow-Origin': acao } : {}
    // When the allow-origin value depends on the request Origin (anything but a
    // constant '*'), advertise `Vary: Origin` so shared caches don't serve one
    // origin's ACAO header to another.
    if (acao !== null && allowedOrigin !== '*') corsHeaders['Vary'] = 'Origin'

    // CORS preflight: only handle OPTIONS when CORS is configured.
    if (request.method === 'OPTIONS') {
      if (!corsEnabled) return json({ error: 'method not allowed' }, 405)
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, corsHeaders)
    let req: RelayRequest
    try {
      req = (await request.json()) as RelayRequest
    } catch {
      return json({ error: 'invalid JSON' }, 400, corsHeaders)
    }
    try {
      return json(await handleFeedback(req, config), 200, corsHeaders)
    } catch (e) {
      if (e instanceof RelayError) return json({ error: e.message }, e.status, corsHeaders)
      return json({ error: 'internal error' }, 500, corsHeaders)
    }
  }
}
