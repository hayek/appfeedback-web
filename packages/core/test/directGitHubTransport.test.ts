import { describe, it, expect, vi } from 'vitest'
import { DirectGitHubTransport } from '../src/transports/directGitHubTransport'
import type { FeedbackReport, DeviceInfo } from '../src/types'

const report: FeedbackReport = { type: 'feature-request', title: 'Dark mode', description: 'please' }
const device: DeviceInfo = { appName: 'A', appVersion: '1', buildNumber: '1', model: 'M', osName: 'Web', osVersion: 'x' }

describe('DirectGitHubTransport', () => {
  it('refuses to construct without the danger flag', () => {
    // @ts-expect-error intentionally omitting the required flag
    expect(() => new DirectGitHubTransport({ owner: 'o', repo: 'r', token: 't' })).toThrow(/dangerouslyUseClientToken/)
  })

  it('POSTs a formatted issue to GitHub and returns the number', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ number: 77 }), { status: 201 }))
    const t = new DirectGitHubTransport({ owner: 'acme', repo: 'feedback', token: 'ghp_x', dangerouslyUseClientToken: true, fetchImpl })
    const n = await t.submit(report, device)
    expect(n).toBe(77)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }]
    expect(url).toBe('https://api.github.com/repos/acme/feedback/issues')
    expect(init.headers.Authorization).toBe('Bearer ghp_x')
    const sent = JSON.parse(init.body as string)
    expect(sent.title).toBe('Dark mode')
    expect(sent.labels).toEqual(['feature-request', 'user-submitted'])
    expect(sent.body).toContain('**Device Information:**')
    expect(sent.body).toContain('👍 Votes: 0')
  })

  it('throws on a GitHub error status', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 401 }))
    const t = new DirectGitHubTransport({ owner: 'o', repo: 'r', token: 't', dangerouslyUseClientToken: true, fetchImpl })
    await expect(t.submit(report, device)).rejects.toMatchObject({ name: 'FeedbackSubmissionError', status: 401 })
  })
})
