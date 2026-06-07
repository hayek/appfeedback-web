import { createFetchHandler } from '@appfeedback/relay'

/**
 * A complete, deployable AppFeedback relay on Cloudflare Workers.
 *
 * The browser SDK POSTs feedback here; this Worker holds your GitHub token
 * (never the browser) and creates the issue. The same `createFetchHandler`
 * runs unchanged on Deno, Bun, and Vercel/Netlify Edge — only the env-binding
 * wrapper differs. CORS (incl. the OPTIONS preflight) is handled by the relay
 * via the `allowedOrigin` option.
 */
export interface Env {
  /** Secret: a GitHub token with `issues:write` on the target repo. `wrangler secret put GITHUB_TOKEN`. */
  GITHUB_TOKEN: string
  /** Repo owner, e.g. "acme". Set in wrangler.toml [vars]. */
  REPO_OWNER: string
  /** Repo name, e.g. "feedback". Set in wrangler.toml [vars]. */
  REPO_NAME: string
  /** Allowed browser origin for CORS, e.g. "https://acme.com". Defaults to "*". */
  ALLOWED_ORIGIN?: string
  /** Optional Cloudflare Turnstile secret to verify a CAPTCHA token. `wrangler secret put TURNSTILE_SECRET`. */
  TURNSTILE_SECRET?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const handler = createFetchHandler(
      {
        githubToken: env.GITHUB_TOKEN,
        owner: env.REPO_OWNER,
        repo: env.REPO_NAME,
        verifyCaptcha: env.TURNSTILE_SECRET
          ? (token) => verifyTurnstile(token, env.TURNSTILE_SECRET as string)
          : undefined,
      },
      // Built-in CORS: answers the OPTIONS preflight and attaches
      // `Access-Control-Allow-Origin` to POST responses.
      { allowedOrigin: env.ALLOWED_ORIGIN ?? '*' },
    )

    return handler(request)
  },
}

async function verifyTurnstile(token: string | null, secret: string): Promise<boolean> {
  if (!token) return false
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token }),
  })
  const data = (await res.json()) as { success: boolean }
  return data.success === true
}
