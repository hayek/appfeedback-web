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

describe('mountFeedbackWidget accessibility', () => {
  it('exposes the type toggle as a radiogroup with named radios', () => {
    const { target } = mount({ submit: vi.fn(async () => 1) })
    const group = q(target, '.afb-types')
    expect(group.getAttribute('role')).toBe('radiogroup')
    expect(group.getAttribute('aria-label')).toBe('Feedback type')
    const radios = target.querySelectorAll('.afb-type')
    expect(radios.length).toBe(2)
    radios.forEach((r) => expect(r.getAttribute('role')).toBe('radio'))
  })

  it('reflects selection via aria-checked and toggles on click', () => {
    const { target } = mount({ submit: vi.fn(async () => 1) })
    const bug = q<HTMLButtonElement>(target, '.afb-type[data-type="bug"]')
    const feat = q<HTMLButtonElement>(target, '.afb-type[data-type="feature-request"]')
    // Default type is bug.
    expect(bug.getAttribute('aria-checked')).toBe('true')
    expect(feat.getAttribute('aria-checked')).toBe('false')
    // Roving tabindex: only the checked radio is tabbable.
    expect(bug.tabIndex).toBe(0)
    expect(feat.tabIndex).toBe(-1)

    feat.click()
    expect(bug.getAttribute('aria-checked')).toBe('false')
    expect(feat.getAttribute('aria-checked')).toBe('true')
    expect(feat.tabIndex).toBe(0)
    expect(bug.tabIndex).toBe(-1)
  })

  it('moves selection with arrow keys', () => {
    const { target } = mount({ submit: vi.fn(async () => 1) })
    const bug = q<HTMLButtonElement>(target, '.afb-type[data-type="bug"]')
    const feat = q<HTMLButtonElement>(target, '.afb-type[data-type="feature-request"]')
    bug.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(feat.getAttribute('aria-checked')).toBe('true')
    feat.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(bug.getAttribute('aria-checked')).toBe('true')
  })

  it('wraps the fields in a form so Enter submits', async () => {
    const submit = vi.fn<FeedbackTransport['submit']>(async () => 7)
    const { target } = mount({ submit })
    const form = q<HTMLFormElement>(target, 'form.afb-form')
    expect(form).toBeTruthy()
    expect(form.getAttribute('aria-label')).toBeTruthy()
    q<HTMLInputElement>(target, '.afb-title').value = 'X'
    q<HTMLTextAreaElement>(target, '.afb-description').value = 'Y'
    // Submitting the form (as Enter would) routes through the handler.
    form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }))
    await vi.waitFor(() => expect(submit).toHaveBeenCalledOnce())
  })

  it('labels every input and marks the required ones', () => {
    const { target } = mount({ submit: vi.fn(async () => 1) })
    const title = q(target, '.afb-title')
    const desc = q(target, '.afb-description')
    const email = q(target, '.afb-email')
    expect(title.getAttribute('aria-label')).toBe('Summary')
    expect(desc.getAttribute('aria-label')).toBe('What happened?')
    expect(email.getAttribute('aria-label')).toBe('Email (optional)')
    expect(title.getAttribute('aria-required')).toBe('true')
    expect(desc.getAttribute('aria-required')).toBe('true')
    // Optional email is not required.
    expect(email.getAttribute('aria-required')).toBeNull()
  })

  it('marks invalid required fields with aria-invalid and clears on input', () => {
    const { target } = mount({ submit: vi.fn(async () => 1) })
    const title = q<HTMLInputElement>(target, '.afb-title')
    const desc = q<HTMLTextAreaElement>(target, '.afb-description')
    q<HTMLButtonElement>(target, '.afb-submit').click()
    expect(title.getAttribute('aria-invalid')).toBe('true')
    expect(desc.getAttribute('aria-invalid')).toBe('true')

    // Correcting a field clears its invalid flag.
    title.value = 'Now filled'
    title.dispatchEvent(new Event('input', { bubbles: true }))
    expect(title.getAttribute('aria-invalid')).toBeNull()
    expect(desc.getAttribute('aria-invalid')).toBe('true')
  })

  it('clears aria-invalid once a valid submit goes through', async () => {
    const submit = vi.fn<FeedbackTransport['submit']>(async () => 1)
    const { target } = mount({ submit })
    const title = q<HTMLInputElement>(target, '.afb-title')
    const desc = q<HTMLTextAreaElement>(target, '.afb-description')
    // First, fail validation to set the flags.
    q<HTMLButtonElement>(target, '.afb-submit').click()
    expect(title.getAttribute('aria-invalid')).toBe('true')
    // Then fill in and submit successfully.
    title.value = 'A'
    desc.value = 'B'
    q<HTMLButtonElement>(target, '.afb-submit').click()
    await vi.waitFor(() => expect(submit).toHaveBeenCalledOnce())
    expect(title.getAttribute('aria-invalid')).toBeNull()
    expect(desc.getAttribute('aria-invalid')).toBeNull()
  })

  it('announces success politely and errors assertively', async () => {
    const status = (t: Element) => q(t, '.afb-status')

    // Success path: polite status region.
    {
      const { target } = mount({ submit: vi.fn<FeedbackTransport['submit']>(async () => 1) })
      q<HTMLInputElement>(target, '.afb-title').value = 'A'
      q<HTMLTextAreaElement>(target, '.afb-description').value = 'B'
      q<HTMLButtonElement>(target, '.afb-submit').click()
      await vi.waitFor(() => expect(status(target).getAttribute('data-state')).toBe('success'))
      expect(status(target).getAttribute('role')).toBe('status')
      expect(status(target).getAttribute('aria-live')).toBe('polite')
    }

    document.body.innerHTML = ''

    // Error path: assertive alert region.
    {
      const { target } = mount({ submit: vi.fn(async () => { throw new Error('nope') }) })
      q<HTMLInputElement>(target, '.afb-title').value = 'A'
      q<HTMLTextAreaElement>(target, '.afb-description').value = 'B'
      q<HTMLButtonElement>(target, '.afb-submit').click()
      await vi.waitFor(() => expect(status(target).getAttribute('data-state')).toBe('error'))
      expect(status(target).getAttribute('role')).toBe('alert')
      expect(status(target).getAttribute('aria-live')).toBe('assertive')
    }
  })

  it('announces a validation failure assertively', () => {
    const { target } = mount({ submit: vi.fn(async () => 1) })
    q<HTMLButtonElement>(target, '.afb-submit').click()
    const status = q(target, '.afb-status')
    expect(status.getAttribute('data-state')).toBe('invalid')
    expect(status.getAttribute('role')).toBe('alert')
    expect(status.getAttribute('aria-live')).toBe('assertive')
  })

  it('sets aria-busy on the submit button while in flight and clears it after', async () => {
    let resolve!: (n: number) => void
    const pending = new Promise<number>((r) => { resolve = r })
    const submit = vi.fn<FeedbackTransport['submit']>(() => pending)
    const { target } = mount({ submit })
    const btn = q<HTMLButtonElement>(target, '.afb-submit')
    q<HTMLInputElement>(target, '.afb-title').value = 'A'
    q<HTMLTextAreaElement>(target, '.afb-description').value = 'B'
    btn.click()
    await vi.waitFor(() => expect(submit).toHaveBeenCalledOnce())
    // In flight: busy + disabled.
    expect(btn.getAttribute('aria-busy')).toBe('true')
    expect(btn.disabled).toBe(true)
    // Resolve and confirm the busy flag is removed.
    resolve(1)
    await vi.waitFor(() => expect(btn.getAttribute('aria-busy')).toBeNull())
  })

  it('clears aria-busy when the submission fails', async () => {
    const submit = vi.fn(async () => { throw new Error('nope') })
    const { target } = mount({ submit })
    const btn = q<HTMLButtonElement>(target, '.afb-submit')
    q<HTMLInputElement>(target, '.afb-title').value = 'A'
    q<HTMLTextAreaElement>(target, '.afb-description').value = 'B'
    btn.click()
    await vi.waitFor(() => expect(q(target, '.afb-status').getAttribute('data-state')).toBe('error'))
    expect(btn.getAttribute('aria-busy')).toBeNull()
  })

  it('injects focus-visible styling', () => {
    const { target } = mount({ submit: vi.fn(async () => 1) })
    const style = q<HTMLStyleElement>(target, 'style')
    expect(style.textContent).toContain(':focus-visible')
  })

  it('does not steal focus on mount', () => {
    const { target } = mount({ submit: vi.fn(async () => 1) })
    // Nothing inside the widget should be the active element after mount.
    expect(target.contains(document.activeElement)).toBe(false)
  })
})
