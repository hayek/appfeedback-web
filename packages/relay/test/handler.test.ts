import { describe, it, expect, vi } from 'vitest'
import { handleFeedback, RelayError, type RelayRequest } from '../src/handler'

const base: RelayRequest = {
  type: 'bug', title: 'Crash', description: 'boom', contactEmail: null, extraFields: {},
  deviceInfo: { appName: 'A', appVersion: '1', buildNumber: '1', model: 'M', osName: 'Web', osVersion: 'x' },
}
const ghOk = () => vi.fn(async () => new Response(JSON.stringify({ number: 9, html_url: 'https://gh/o/r/issues/9' }), { status: 201 }))

describe('handleFeedback', () => {
  it('creates a GitHub issue and returns number + url', async () => {
    const fetchImpl = ghOk()
    const r = await handleFeedback(base, { githubToken: 't', owner: 'o', repo: 'r', fetchImpl })
    expect(r).toEqual({ issueNumber: 9, issueUrl: 'https://gh/o/r/issues/9' })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }]
    expect(url).toBe('https://api.github.com/repos/o/r/issues')
    expect(init.headers.Authorization).toBe('Bearer t')
    const sent = JSON.parse(init.body as string)
    expect(sent.labels).toEqual(['bug', 'user-submitted'])
    expect(sent.body).toContain('**Device Information:**')
  })

  it('rejects an invalid submission with 400', async () => {
    await expect(handleFeedback({ ...base, type: 'nope' as any }, { githubToken: 't', owner: 'o', repo: 'r', fetchImpl: ghOk() }))
      .rejects.toMatchObject({ name: 'RelayError', status: 400 })
  })

  it('rejects an empty description with 400', async () => {
    await expect(handleFeedback({ ...base, description: '' }, { githubToken: 't', owner: 'o', repo: 'r', fetchImpl: ghOk() }))
      .rejects.toMatchObject({ name: 'RelayError', status: 400 })
  })

  it('rejects a whitespace-only title with 400', async () => {
    await expect(handleFeedback({ ...base, title: '   \t\n ' }, { githubToken: 't', owner: 'o', repo: 'r', fetchImpl: ghOk() }))
      .rejects.toMatchObject({ name: 'RelayError', status: 400 })
  })

  it('rejects a whitespace-only description with 400', async () => {
    await expect(handleFeedback({ ...base, description: '  \n ' }, { githubToken: 't', owner: 'o', repo: 'r', fetchImpl: ghOk() }))
      .rejects.toMatchObject({ name: 'RelayError', status: 400 })
  })

  it('rejects a failed captcha with 403', async () => {
    await expect(handleFeedback(base, { githubToken: 't', owner: 'o', repo: 'r', fetchImpl: ghOk(), verifyCaptcha: () => false }))
      .rejects.toMatchObject({ name: 'RelayError', status: 403 })
  })

  it('maps a GitHub failure to 502', async () => {
    const fetchImpl = vi.fn(async () => new Response('boom', { status: 422 }))
    await expect(handleFeedback(base, { githubToken: 't', owner: 'o', repo: 'r', fetchImpl }))
      .rejects.toMatchObject({ name: 'RelayError', status: 502 })
  })

  it('preserves a GitHub 429 rate-limit as 429 (not 502)', async () => {
    const fetchImpl = vi.fn(async () => new Response('rate limited', { status: 429 }))
    await expect(handleFeedback(base, { githubToken: 't', owner: 'o', repo: 'r', fetchImpl }))
      .rejects.toMatchObject({ name: 'RelayError', status: 429 })
  })
})
