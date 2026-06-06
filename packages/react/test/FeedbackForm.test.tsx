import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { FeedbackForm } from '../src/FeedbackForm'
import type { FeedbackTransport } from '@appfeedback/core'
import type { FeedbackReport, DeviceInfo } from '@appfeedback/core'

beforeEach(() => cleanup())

describe('FeedbackForm', () => {
  it('mounts the widget into the React tree', () => {
    const transport: FeedbackTransport = { submit: vi.fn(async () => 1) }
    const { container } = render(<FeedbackForm transport={transport} appName="Acme" appVersion="1.0" />)
    expect(container.querySelector('[data-appfeedback="widget"]')).toBeTruthy()
    expect(container.querySelector('.afb-submit')).toBeTruthy()
  })

  it('submits through the underlying widget', async () => {
    const submit = vi.fn<(report: FeedbackReport, deviceInfo: DeviceInfo) => Promise<number>>(async () => 7)
    const { container } = render(<FeedbackForm transport={{ submit }} appName="Acme" appVersion="1.0" />)
    ;(container.querySelector('.afb-title') as HTMLInputElement).value = 'T'
    ;(container.querySelector('.afb-description') as HTMLTextAreaElement).value = 'D'
    ;(container.querySelector('.afb-submit') as HTMLButtonElement).click()
    await vi.waitFor(() => expect(submit).toHaveBeenCalledOnce())
    expect(submit.mock.calls[0][0]).toMatchObject({ type: 'bug', title: 'T', description: 'D' })
  })

  it('unmounts the widget on React unmount', () => {
    const { container, unmount } = render(<FeedbackForm transport={{ submit: vi.fn(async () => 1) }} appName="Acme" appVersion="1.0" />)
    unmount()
    expect(container.querySelector('[data-appfeedback="widget"]')).toBeNull()
  })
})
