import { describe, it, expect, vi } from 'vitest'
import { RelayTransport } from '../src/transports/relayTransport'
import { FeedbackSubmissionError } from '../src/errors'
import type { FeedbackReport, DeviceInfo } from '../src/types'

const report: FeedbackReport = { type: 'bug', title: 'Crash', description: 'boom', contactEmail: 'a@b.com', extraFields: { k: 'v' } }
const device: DeviceInfo = { appName: 'A', appVersion: '1', buildNumber: '1', model: 'M', osName: 'Web', osVersion: 'x' }

function okFetch(body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }))
}

describe('RelayTransport', () => {
  it('POSTs the contract payload and returns the issue number', async () => {
    const fetchImpl = okFetch({ issueNumber: 123, issueUrl: 'https://gh/x/y/issues/123' })
    const t = new RelayTransport({ endpoint: 'https://relay.example/api', fetchImpl })
    const n = await t.submit(report, device)
    expect(n).toBe(123)
    expect(fetchImpl).toHaveBeenCalledOnce()
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://relay.example/api')
    expect(init.method).toBe('POST')
    const sent = JSON.parse(init.body as string)
    expect(sent).toMatchObject({
      type: 'bug', title: 'Crash', description: 'boom', contactEmail: 'a@b.com',
      extraFields: { k: 'v' }, deviceInfo: device, captchaToken: null,
    })
  })

  it('includes a captcha token when a provider is configured', async () => {
    const fetchImpl = okFetch({ issueNumber: 1, issueUrl: 'u' })
    const t = new RelayTransport({ endpoint: 'e', fetchImpl, getCaptchaToken: async () => 'tok-123' })
    await t.submit(report, device)
    const call1 = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(call1[1].body as string).captchaToken).toBe('tok-123')
  })

  it('throws FeedbackSubmissionError with the relay error message on non-2xx', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 }))
    const t = new RelayTransport({ endpoint: 'e', fetchImpl })
    await expect(t.submit(report, device)).rejects.toMatchObject({ name: 'FeedbackSubmissionError', status: 429, message: 'rate limited' })
  })
})
