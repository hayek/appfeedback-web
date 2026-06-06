import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountFeedbackWidget } from '../src/widget'
import type { FeedbackTransport } from '@appfeedback/core'

function mount(transport: FeedbackTransport) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const handle = mountFeedbackWidget(target, { transport, appName: 'Acme', appVersion: '1.0' })
  return { target, handle }
}
const q = <T extends Element>(t: Element, s: string) => t.querySelector(s) as T

beforeEach(() => { document.body.innerHTML = '' })

describe('mountFeedbackWidget', () => {
  it('renders the form scaffold', () => {
    const { target } = mount({ submit: vi.fn(async () => 1) })
    expect(q(target, '[data-appfeedback="widget"]')).toBeTruthy()
    expect(q(target, '.afb-title')).toBeTruthy()
    expect(q(target, '.afb-description')).toBeTruthy()
    expect(q(target, '.afb-submit')).toBeTruthy()
    expect(target.querySelectorAll('.afb-type').length).toBe(2)
  })

  it('submits a bug report and shows success', async () => {
    const submit = vi.fn<FeedbackTransport['submit']>(async () => 42)
    const { target } = mount({ submit })
    q<HTMLInputElement>(target, '.afb-title').value = 'Crash'
    q<HTMLTextAreaElement>(target, '.afb-description').value = 'It broke'
    q<HTMLInputElement>(target, '.afb-email').value = 'me@x.com'
    q<HTMLButtonElement>(target, '.afb-submit').click()
    await vi.waitFor(() => expect(submit).toHaveBeenCalledOnce())
    const [report, device] = submit.mock.calls[0]
    expect(report).toMatchObject({ type: 'bug', title: 'Crash', description: 'It broke', contactEmail: 'me@x.com' })
    expect(device.osName).toBe('Web')
    await vi.waitFor(() => expect(q(target, '.afb-status').getAttribute('data-state')).toBe('success'))
  })

  it('does not submit with empty title or description', () => {
    const submit = vi.fn(async () => 1)
    const { target } = mount({ submit })
    q<HTMLButtonElement>(target, '.afb-submit').click()
    expect(submit).not.toHaveBeenCalled()
    expect(q(target, '.afb-status').getAttribute('data-state')).toBe('invalid')
  })

  it('switches type to feature-request', async () => {
    const submit = vi.fn<FeedbackTransport['submit']>(async () => 1)
    const { target } = mount({ submit })
    q<HTMLButtonElement>(target, '.afb-type[data-type="feature-request"]').click()
    q<HTMLInputElement>(target, '.afb-title').value = 'Dark mode'
    q<HTMLTextAreaElement>(target, '.afb-description').value = 'please'
    q<HTMLButtonElement>(target, '.afb-submit').click()
    await vi.waitFor(() => expect(submit.mock.calls[0][0].type).toBe('feature-request'))
  })

  it('shows an error state when the transport rejects', async () => {
    const submit = vi.fn(async () => { throw new Error('nope') })
    const { target } = mount({ submit })
    q<HTMLInputElement>(target, '.afb-title').value = 'X'
    q<HTMLTextAreaElement>(target, '.afb-description').value = 'Y'
    q<HTMLButtonElement>(target, '.afb-submit').click()
    await vi.waitFor(() => expect(q(target, '.afb-status').getAttribute('data-state')).toBe('error'))
    expect(q<HTMLButtonElement>(target, '.afb-submit').disabled).toBe(false) // re-enabled to retry
  })

  it('omits empty email as null', async () => {
    const submit = vi.fn<FeedbackTransport['submit']>(async () => 1)
    const { target } = mount({ submit })
    q<HTMLInputElement>(target, '.afb-title').value = 'X'
    q<HTMLTextAreaElement>(target, '.afb-description').value = 'Y'
    q<HTMLButtonElement>(target, '.afb-submit').click()
    await vi.waitFor(() => expect(submit).toHaveBeenCalled())
    expect(submit.mock.calls[0][0].contactEmail).toBeNull()
  })

  it('unmount removes the widget', () => {
    const { target, handle } = mount({ submit: vi.fn(async () => 1) })
    handle.unmount()
    expect(target.querySelector('[data-appfeedback="widget"]')).toBeNull()
  })
})
