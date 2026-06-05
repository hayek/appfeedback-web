import { describe, it, expect } from 'vitest'
import { formatIssueBody, labelsFor, codePointOrder } from '../src/issueBodyFormatter'
import type { FeedbackReport, DeviceInfo } from '../src/types'

const device: DeviceInfo = {
  appName: 'A', appVersion: '1', buildNumber: '1', model: 'M', osName: 'macOS', osVersion: 'Version 15.1',
}

describe('issueBodyFormatter', () => {
  it('labels', () => {
    expect(labelsFor('bug')).toEqual(['bug', 'user-submitted'])
    expect(labelsFor('feature-request')).toEqual(['feature-request', 'user-submitted'])
  })
  it('minimal body', () => {
    const report: FeedbackReport = { type: 'bug', title: 't', description: 'Desc' }
    expect(formatIssueBody(report, device)).toBe(
      'Desc\n\n---\n**Device Information:**\nApp: A\nApp Version: 1 (1)\nDevice: M\nmacOS Version: Version 15.1\n\n---\n👍 Votes: 0',
    )
  })
  it('extra fields in code-point order (incl. prefix)', () => {
    const report: FeedbackReport = {
      type: 'bug', title: 't', description: 'Desc',
      extraFields: { Zeta: 'z', alpha: 'a', Beta: 'b', a: '1', ab: '2' },
    }
    const body = formatIssueBody(report, device)
    // code points: 'B'(66) < 'Z'(90) < 'a'(97); and 'a' (prefix) < 'ab'
    expect(body.indexOf('**Beta:**')).toBeLessThan(body.indexOf('**Zeta:**'))
    expect(body.indexOf('**Zeta:**')).toBeLessThan(body.indexOf('**a:**'))
    expect(body.indexOf('**a:**')).toBeLessThan(body.indexOf('**ab:**'))
  })
  it('codePointOrder handles non-BMP after BMP', () => {
    expect(codePointOrder('￿', '😀')).toBeLessThan(0) // U+FFFF < U+1F600
  })
})
