import { describe, it, expect, vi } from 'vitest'
import { firebaseHandler } from '../src/adapters/firebase'
import { appwriteHandler } from '../src/adapters/appwrite'

const goodPayload = {
  type: 'bug', title: 'X', description: 'Y',
  deviceInfo: { appName: 'A', appVersion: '1', buildNumber: '1', model: 'M', osName: 'Web', osVersion: 'x' },
}
const goodBody = JSON.stringify(goodPayload)
const ghOk = () => vi.fn(async () => new Response(JSON.stringify({ number: 5, html_url: 'u' }), { status: 201 }))
const cfg = (fetchImpl: typeof fetch) => ({ githubToken: 't', owner: 'o', repo: 'r', fetchImpl })

// Adapters forward Response headers via Headers.forEach, which lowercases keys —
// so look them up case-insensitively rather than assuming canonical casing.
const header = (headers: Record<string, string>, name: string): string | undefined => {
  const lc = name.toLowerCase()
  for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() === lc) return v
  return undefined
}

// --- Firebase: capture status / headers / json via an Express-like res stub. ---
function firebaseRes() {
  const captured = { status: 0, headers: {} as Record<string, string>, body: undefined as unknown }
  const api = {
    json(b: unknown) { captured.body = b },
    send(b?: unknown) { captured.body = b },
    set(headers: Record<string, string>) { Object.assign(captured.headers, headers); return api },
  }
  const res = { status(c: number) { captured.status = c; return api } }
  return { res, captured }
}

describe('firebaseHandler', () => {
  it('still works with no options (backward compatible)', async () => {
    const { res, captured } = firebaseRes()
    const rawBody = { toString: () => goodBody }
    await firebaseHandler(cfg(ghOk()))({ method: 'POST', rawBody }, res)
    expect(captured.status).toBe(200)
    expect(captured.body).toEqual({ issueNumber: 5, issueUrl: 'u' })
    // No CORS configured → no allow-origin header.
    expect(header(captured.headers, 'Access-Control-Allow-Origin')).toBeUndefined()
  })

  it('answers the OPTIONS preflight with CORS headers when allowedOrigin is set', async () => {
    const { res, captured } = firebaseRes()
    await firebaseHandler(cfg(ghOk()), { allowedOrigin: '*' })(
      { method: 'OPTIONS', headers: { origin: 'https://app.example' } },
      res,
    )
    expect(captured.status).toBe(204)
    expect(header(captured.headers, 'Access-Control-Allow-Origin')).toBe('*')
    expect(header(captured.headers, 'Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
    expect(captured.body).toBeUndefined()
  })

  it('attaches the echoed origin to a POST response', async () => {
    const { res, captured } = firebaseRes()
    const rawBody = { toString: () => goodBody }
    await firebaseHandler(cfg(ghOk()), { allowedOrigin: ['https://app.example'] })(
      { method: 'POST', headers: { origin: 'https://app.example' }, rawBody },
      res,
    )
    expect(captured.status).toBe(200)
    expect(header(captured.headers, 'Access-Control-Allow-Origin')).toBe('https://app.example')
  })
})

// --- Appwrite: capture status / headers / body via an Appwrite-like res stub. ---
function appwriteRes() {
  const captured = { status: 0, headers: {} as Record<string, string>, body: undefined as unknown }
  const res = {
    json(data: unknown, status = 200, headers: Record<string, string> = {}) {
      captured.body = data; captured.status = status; captured.headers = headers; return data
    },
    send(body: string, status = 200, headers: Record<string, string> = {}) {
      captured.body = body; captured.status = status; captured.headers = headers; return body
    },
  }
  return { res, captured }
}

describe('appwriteHandler', () => {
  it('still works with no options (backward compatible) using bodyJson', async () => {
    const { res, captured } = appwriteRes()
    await appwriteHandler(cfg(ghOk()))({ req: { method: 'POST', bodyJson: goodPayload }, res })
    expect(captured.status).toBe(200)
    expect(captured.body).toEqual({ issueNumber: 5, issueUrl: 'u' })
    expect(header(captured.headers, 'Access-Control-Allow-Origin')).toBeUndefined()
  })

  it('rejects non-POST with 405', async () => {
    const { res, captured } = appwriteRes()
    await appwriteHandler(cfg(ghOk()))({ req: { method: 'GET' }, res })
    expect(captured.status).toBe(405)
  })

  it('answers the OPTIONS preflight with CORS headers when allowedOrigin is set', async () => {
    const { res, captured } = appwriteRes()
    await appwriteHandler(cfg(ghOk()), { allowedOrigin: '*' })({
      req: { method: 'OPTIONS', headers: { origin: 'https://app.example' } }, res,
    })
    expect(captured.status).toBe(204)
    expect(header(captured.headers, 'Access-Control-Allow-Origin')).toBe('*')
    expect(header(captured.headers, 'Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
  })

  it('echoes a matching origin on a POST and omits it for a non-allowed one', async () => {
    {
      const { res, captured } = appwriteRes()
      await appwriteHandler(cfg(ghOk()), { allowedOrigin: ['https://app.example'] })({
        req: { method: 'POST', headers: { origin: 'https://app.example' }, body: goodBody }, res,
      })
      expect(captured.status).toBe(200)
      expect(header(captured.headers, 'Access-Control-Allow-Origin')).toBe('https://app.example')
    }
    {
      const { res, captured } = appwriteRes()
      await appwriteHandler(cfg(ghOk()), { allowedOrigin: ['https://app.example'] })({
        req: { method: 'POST', headers: { origin: 'https://evil.example' }, body: goodBody }, res,
      })
      expect(captured.status).toBe(200)
      expect(header(captured.headers, 'Access-Control-Allow-Origin')).toBeUndefined()
    }
  })
})
