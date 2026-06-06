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
