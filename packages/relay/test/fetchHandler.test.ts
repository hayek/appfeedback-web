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

  describe('CORS', () => {
    it('without cors option: OPTIONS still 405 and no CORS header on POST', async () => {
      const h = createFetchHandler(cfg(ghOk()))
      const opt = await h(new Request('https://relay/api', { method: 'OPTIONS', headers: { Origin: 'https://app.example' } }))
      expect(opt.status).toBe(405)
      expect(opt.headers.get('Access-Control-Allow-Origin')).toBeNull()

      const post = await h(new Request('https://relay/api', { method: 'POST', body: goodBody, headers: { Origin: 'https://app.example' } }))
      expect(post.status).toBe(200)
      expect(post.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })

    it('OPTIONS → 204 with CORS headers when allowedOrigin is "*"', async () => {
      const h = createFetchHandler(cfg(ghOk()), { allowedOrigin: '*' })
      const res = await h(new Request('https://relay/api', { method: 'OPTIONS', headers: { Origin: 'https://app.example' } }))
      expect(res.status).toBe(204)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(res.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
      expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type')
      expect(res.headers.get('Access-Control-Max-Age')).toBe('86400')
    })

    it('POST response carries Access-Control-Allow-Origin when configured', async () => {
      const h = createFetchHandler(cfg(ghOk()), { allowedOrigin: '*' })
      const res = await h(new Request('https://relay/api', { method: 'POST', body: goodBody, headers: { Origin: 'https://app.example' } }))
      expect(res.status).toBe(200)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(await res.json()).toEqual({ issueNumber: 5, issueUrl: 'u' })
    })

    it('echoes a matching origin and omits the header for a non-allowed origin', async () => {
      const h = createFetchHandler(cfg(ghOk()), { allowedOrigin: ['https://app.example', 'https://other.example'] })

      const ok = await h(new Request('https://relay/api', { method: 'OPTIONS', headers: { Origin: 'https://app.example' } }))
      expect(ok.status).toBe(204)
      expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example')

      const blocked = await h(new Request('https://relay/api', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }))
      expect(blocked.status).toBe(204)
      expect(blocked.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })
  })
})
