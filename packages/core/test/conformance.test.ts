import { describe, it, expect } from 'vitest'
import formatCorpus from './fixtures/conformance/format-cases.json'
import parseCorpus from './fixtures/conformance/parse-cases.json'
import { formatIssueBody, labelsFor } from '../src/issueBodyFormatter'
import { parseIssueBody } from '../src/issueBodyParser'
import type { FeedbackReport, DeviceInfo, UploadedAttachment, FeedbackType } from '../src/types'

interface FormatCase {
  name: string
  report: { type: string; title: string; description: string; contactEmail: string | null; extraFields?: Record<string, string> }
  deviceInfo: DeviceInfo
  uploaded?: UploadedAttachment[]
  expectedBody: string
  expectedLabels?: string[]
}
interface ParseCase {
  name: string
  body: string
  expected: {
    description: string
    appName: string | null
    appVersion: string | null
    device: string | null
    osVersion: string | null
    email: string | null
    attachments?: { filename: string; mimeType: string; url: string; sizeBytes: number | null }[]
  }
}
const fmt = formatCorpus as unknown as { version: number; cases: FormatCase[] }
const prs = parseCorpus as unknown as { version: number; cases: ParseCase[] }

describe('conformance: format', () => {
  it('matches golden fixtures byte-for-byte', () => {
    expect(fmt.cases.length).toBeGreaterThan(0)
    for (const c of fmt.cases) {
      const report: FeedbackReport = {
        type: c.report.type as FeedbackType,
        title: c.report.title,
        description: c.report.description,
        contactEmail: c.report.contactEmail,
        extraFields: c.report.extraFields ?? {},
      }
      const body = formatIssueBody(report, c.deviceInfo, c.uploaded ?? [])
      expect(body, `format mismatch in '${c.name}'`).toBe(c.expectedBody)
      if (c.expectedLabels) {
        expect(labelsFor(c.report.type as FeedbackType), `labels in '${c.name}'`).toEqual(c.expectedLabels)
      }
    }
  })
})

describe('conformance: parse', () => {
  it('matches golden fixtures', () => {
    expect(prs.cases.length).toBeGreaterThan(0)
    for (const c of prs.cases) {
      const p = parseIssueBody(c.body)
      const e = c.expected
      expect(p.description, `description in '${c.name}'`).toBe(e.description)
      expect(p.appName, `appName in '${c.name}'`).toBe(e.appName)
      expect(p.appVersion, `appVersion in '${c.name}'`).toBe(e.appVersion)
      expect(p.device, `device in '${c.name}'`).toBe(e.device)
      expect(p.osVersion, `osVersion in '${c.name}'`).toBe(e.osVersion)
      expect(p.email, `email in '${c.name}'`).toBe(e.email)
      const exp = e.attachments ?? []
      expect(p.attachments.length, `attachment count in '${c.name}'`).toBe(exp.length)
      exp.forEach((ea, i) => {
        expect(p.attachments[i].filename, `att filename in '${c.name}'[${i}]`).toBe(ea.filename)
        expect(p.attachments[i].mimeType, `att mime in '${c.name}'[${i}]`).toBe(ea.mimeType)
        expect(p.attachments[i].url, `att url in '${c.name}'[${i}]`).toBe(ea.url)
        expect(p.attachments[i].sizeBytes, `att size in '${c.name}'[${i}]`).toBe(ea.sizeBytes)
      })
    }
  })
})
